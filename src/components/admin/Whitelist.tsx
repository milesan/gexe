import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFrontendUrl } from '../../lib/environment';

interface WhitelistEntry {
  id: string;
  email: string;
  notes: string;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  has_seen_welcome: boolean;
  has_created_account: boolean;
  account_created_at: string | null;
  has_booked: boolean;
  first_booking_at: string | null;
  last_booking_at: string | null;
  total_bookings: number;
}

export function Whitelist() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    console.log(' Initializing Whitelist component');
    loadWhitelist();

    const subscription = supabase
      .channel('whitelist')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'whitelist' 
        }, 
        (payload) => {
          console.log(' Realtime update received:', payload);
          loadWhitelist();
        }
      )
      .subscribe();

    console.log(' Realtime subscription established');

    return () => {
      console.log(' Cleaning up realtime subscription');
      subscription.unsubscribe();
    };
  }, []);

  const loadWhitelist = async () => {
    console.log('📥 Loading whitelist data...');
    try {
      setLoading(true);

      // Check auth state
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('🔑 Current auth state:', { user, error: authError });
      
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }

      // Check if table exists and its contents
      console.log('🔍 Checking database schema...');
      const { data: schemaData, error: schemaError } = await supabase
        .rpc('debug_db_info');

      console.log('📊 Schema info:', { data: schemaData, error: schemaError });

      console.log('🔍 Executing Supabase query...');
      const { data, error: queryError } = await supabase
        .from('whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('📊 Raw Supabase response:', { data, error: queryError });

      if (queryError) throw queryError;
      console.log('✅ Whitelist data loaded:', data?.length, 'entries');
      setEntries(data || []);
    } catch (err) {
      console.error('❌ Error loading whitelist:', err);
      setError(err instanceof Error ? err.message : 'Failed to load whitelist');
    } finally {
      setLoading(false);
    }
  };

  const addToWhitelist = async () => {
    if (!newEmail || isAdding) {
      console.warn('⚠️ Attempted to add empty email to whitelist or button was clicked while processing');
      return;
    }

    console.log('➕ Adding to whitelist:', { email: newEmail, notes: newNotes });
    try {
      setIsAdding(true);
      const { data, error } = await supabase
        .from('whitelist')
        .insert({ email: newEmail, notes: newNotes })
        .select()
        .single();

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          throw new Error(`Email "${newEmail}" is already in the whitelist`);
        }
        throw error;
      }
      
      console.log('✅ Successfully added to whitelist');

      // Send acceptance email
      // console.log('📧 Sending acceptance email to:', newEmail);
      // const { error: emailError } = await supabase.functions.invoke('send-whitelist-email', {
      //   body: { 
      //     email: newEmail,
      //     whitelistId: data.id,
      //     frontendUrl: getFrontendUrl()
      //   }
      // });

      // if (emailError) {
      //   console.error('❌ Error sending acceptance email:', emailError);
      //   setError('Added to whitelist but failed to send acceptance email');
      // } else {
      //   console.log('✅ Successfully sent acceptance email');
      // }
      
      setNewEmail('');
      setNewNotes('');
      await loadWhitelist();
    } catch (err) {
      console.error('❌ Error adding to whitelist:', err);
      setError(err instanceof Error ? err.message : 'Failed to add to whitelist');
    } finally {
      setIsAdding(false);
    }
  };

  const removeFromWhitelist = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-whitelist-entry', {
        body: { id }
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Failed to delete whitelist entry');

      console.log('Successfully removed from whitelist');
      await loadWhitelist();
    } catch (err) {
      console.error('Error removing from whitelist:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove from whitelist');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.warn(' No file selected for upload');
      return;
    }

    console.log(' Processing CSV file:', file.name);
    try {
      const text = await file.text();
      const emails = text.split('\n')
        .map(line => line.trim())
        .filter(email => email && email.includes('@'));
      
      console.log(' Found', emails.length, 'valid email addresses in CSV');

      // First check which emails are already whitelisted
      const { data: existingEntries, error: checkError } = await supabase
        .from('whitelist')
        .select('email')
        .in('email', emails);

      if (checkError) throw checkError;

      const existingEmails = new Set(existingEntries?.map(e => e.email) || []);
      const newEmails = emails.filter(email => !existingEmails.has(email));

      if (existingEmails.size > 0) {
        console.log(' Skipping', existingEmails.size, 'already whitelisted emails:', Array.from(existingEmails));
        setError(`Skipped ${existingEmails.size} already whitelisted email(s). Adding ${newEmails.length} new email(s).`);
      }

      if (newEmails.length === 0) {
        console.log(' No new emails to add');
        setShowUpload(false);
        return;
      }

      const { data, error } = await supabase
        .from('whitelist')
        .insert(
          newEmails.map(email => ({
            email,
            notes: 'Added via CSV upload'
          }))
        )
        .select();

      if (error) throw error;
      
      // // Send acceptance emails to all newly whitelisted users
      // console.log(' Sending acceptance emails to', newEmails.length, 'users');
      // for (const entry of data) {
      //   const { error: emailError } = await supabase.functions.invoke('send-whitelist-email', {
      //     body: { 
      //       email: entry.email,
      //       whitelistId: entry.id,
      //       frontendUrl: getFrontendUrl()
      //     }
      //   });
      //   if (emailError) {
      //     console.error(' Error sending acceptance email to', entry.email, ':', emailError);
      //   }
      // }
      
      console.log(' Successfully uploaded CSV data'); // Removed "and sent emails"
      setShowUpload(false);
      await loadWhitelist();
    } catch (err) {
      console.error(' Error uploading CSV:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload CSV');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-6 p-4 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-[var(--color-bg-surface)] p-6 rounded-lg border border-[var(--color-border)] mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-display font-medium text-[var(--color-text-primary)]">Add to Whitelist</h3>
          <button
            onClick={() => setShowUpload(true)}
            className="flex font-mono text-sm items-center gap-2 text-[var(--color-accent-secondary)] hover:text-[var(--color-accent-secondary-hover)]"
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
        </div>

        <div className="flex gap-4 font-mono text-sm">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 p-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)]"
          />
          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 p-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)]"
          />
          <button
            onClick={addToWhitelist}
            disabled={isAdding || !newEmail}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isAdding || !newEmail
                ? 'bg-[var(--color-button-disabled-bg)] text-[var(--color-button-disabled-text)] cursor-not-allowed'
                : 'bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] hover:bg-[var(--color-button-primary-bg-hover)]'
            }`}
          >
            <Plus className="w-4 h-4 font-mono text-sm" />
            {isAdding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[var(--color-bg-surface)] p-4 rounded-lg border border-[var(--color-border)] flex justify-between items-center"
          >
            <div>
              <div className="font-medium text-[var(--color-text-primary)]">{entry.email}</div>
              {entry.notes && (
                <div className="text-sm text-[var(--color-text-secondary)] mt-1">{entry.notes}</div>
              )}
              <div className="flex gap-4 mt-2">
                {entry.has_created_account ? (
                  <span className="text-sm text-emerald-600">Has Account</span>
                ) : (
                  <span className="text-sm text-[var(--color-text-secondary)]">No Account Yet</span>
                )}
                {entry.has_seen_welcome && (
                  <span className="text-sm text-emerald-600">Has Seen Welcome</span>
                )}
                {entry.last_login && (
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Last login: {new Date(entry.last_login).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => removeFromWhitelist(entry.id)}
              className="p-2 text-[var(--color-text-error)] hover:bg-[var(--color-bg-error-hover)] rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[var(--color-bg-surface)] rounded-lg max-w-md w-full p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-lg font-medium text-[var(--color-text-primary)]">Upload CSV</h3>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-[var(--color-text-secondary)] mb-4">
                Upload a CSV file containing one email address per line.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="w-full text-[var(--color-text-secondary)]"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
