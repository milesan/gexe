import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Upload, X, Search, X as ClearSearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFrontendUrl } from '../../lib/environment';
import { usePagination, DOTS } from '../../hooks/usePagination';

interface WhitelistEntry {
  id: string;
  email: string;
  created_at: string;
  has_account: boolean;
  last_sign_in_at: string | null;
  has_finished_signup: boolean;
  notes?: string | null;
}

export function Whitelist() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntriesCount, setTotalEntriesCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  // Add new state for deletion confirmation modal
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<WhitelistEntry | null>(null);

  const ITEMS_PER_PAGE = 15;

  const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): void => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func(...args), waitFor);
    };
  };

  useEffect(() => {
    console.log(' Initializing Whitelist component and setting up realtime subscription');
    // loadWhitelist(); // Initial load will be handled by the useEffect below that depends on currentPage

    const channel = supabase
      .channel('whitelist-changes') // Use a more specific channel name
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whitelist_user_details' // Listen to the view we are actually querying
        },
        (payload) => {
          console.log(' Realtime update received on whitelist_user_details:', payload);
          // Reload the current page of data
          // No need to check if payload.new or payload.old matches current entries explicitly,
          // as the view might change in ways that affect the current page (e.g. reordering if sort changes, or count changes)
          loadWhitelist();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription to whitelist_user_details established');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('❌ Realtime subscription error/closed:', { status, err });
          setError(`Realtime connection error: ${status}. Data may be stale.`);
        }
      });

    return () => {
      console.log(' Cleaning up realtime subscription to whitelist_user_details');
      supabase.removeChannel(channel);
    };
  }, []); // This effect only runs on mount and unmount for subscription management

  // Effect for loading data when currentPage changes or on initial load
  useEffect(() => {
    loadWhitelist();
  }, [currentPage, activeSearchQuery]);

  const loadWhitelist = async () => {
    console.log('📥 Loading whitelist data for page:', currentPage, 'Search:', activeSearchQuery);
    try {
      setLoading(true);
      window.scrollTo(0, 0);

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

      console.log('🔍 Executing Supabase query for whitelist_user_details...');
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // First query the view for user details
      let query = supabase
        .from('whitelist_user_details')
        .select('*', { count: 'exact' });

      if (activeSearchQuery) {
        query = query.ilike('email', `%${activeSearchQuery}%`);
      }
      
      const { data, error: queryError, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      console.log('📊 Raw Supabase response:', { data, error: queryError, count });

      if (queryError) throw queryError;
      
      // Fetch notes from whitelist table
      let entriesWithNotes = data || [];
      if (data && data.length > 0) {
        const emails = data.map(entry => entry.email);
        const { data: whitelistData, error: whitelistError } = await supabase
          .from('whitelist')
          .select('email, notes')
          .in('email', emails);
        
        if (!whitelistError && whitelistData) {
          // Create a map of email to notes
          const notesMap = new Map(whitelistData.map(w => [w.email, w.notes]));
          
          // Merge notes into entries
          entriesWithNotes = data.map(entry => ({
            ...entry,
            notes: notesMap.get(entry.email) || null
          }));
        }
      }
      
      console.log('✅ Whitelist data loaded:', entriesWithNotes.length, 'entries. Total count:', count);
      setEntries(entriesWithNotes);
      setTotalEntriesCount(count || 0);
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

    // Normalize email to lowercase to match Supabase Auth behavior
    const normalizedEmail = newEmail.toLowerCase().trim();

    console.log('➕ Adding to whitelist:', { email: normalizedEmail, notes: newNotes });
    try {
      setIsAdding(true);
      const { data, error } = await supabase
        .from('whitelist')
        .insert({ email: normalizedEmail, notes: newNotes })
        .select()
        .single();

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          throw new Error(`Email "${normalizedEmail}" is already in the whitelist`);
        }
        throw error;
      }
      
      console.log('✅ Successfully added to whitelist');

      // NOTE: Removed setup-whitelisted-auth-user call - auth users will be created on-demand when they first log in
      
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

  const openDeleteConfirmModal = (entry: WhitelistEntry) => {
    setEntryToDelete(entry);
    setShowDeleteConfirmModal(true);
  };

  const closeDeleteConfirmModal = () => {
    setEntryToDelete(null);
    setShowDeleteConfirmModal(false);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-whitelist-entry', {
        body: { id: entryToDelete.id }
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Failed to delete whitelist entry');

      console.log('Successfully removed from whitelist');
      await loadWhitelist();
      closeDeleteConfirmModal();
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
        .map(line => line.trim().toLowerCase())
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
      
      if (data && data.length > 0) {
        console.log(`✅ Successfully uploaded ${data.length} CSV entries.`);
        // NOTE: Removed setup-whitelisted-auth-user calls - auth users will be created on-demand when they first log in
      }
      
      console.log('✅ Successfully uploaded CSV data');
      setShowUpload(false);
      // Reset to page 1 after CSV upload as content has changed significantly
      if (currentPage === 1) {
        await loadWhitelist(); // Reload if already on page 1
      } else {
        setCurrentPage(1); // Change page, which triggers loadWhitelist via useEffect
      }
    } catch (err) {
      console.error(' Error uploading CSV:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload CSV');
    }
  };

  const paginationRange = usePagination({
    currentPage,
    totalCount: totalEntriesCount,
    siblingCount: 1,
    pageSize: ITEMS_PER_PAGE
  });
  const totalPageCount = Math.ceil(totalEntriesCount / ITEMS_PER_PAGE);

  const triggerSearch = useCallback(() => {
    setActiveSearchQuery(searchTerm.trim());
    if (currentPage !== 1) {
        setCurrentPage(1);
    } else {
        // If already on page 1, loadWhitelist won't be triggered by currentPage change, so call it directly
        // This is covered by activeSearchQuery changing in the loadWhitelist useEffect dependency array
    }
  }, [searchTerm, currentPage]);

  const debouncedSearch = useCallback(debounce(triggerSearch, 500), [triggerSearch]);

  useEffect(() => {
    // Only call debouncedSearch if searchTerm has actually changed 
    // and is different from the currently active search query (to avoid initial call or redundant calls)
    if (searchTerm.trim() !== activeSearchQuery) {
        debouncedSearch();
    }
  }, [searchTerm, activeSearchQuery, debouncedSearch]);

  const handleManualSearch = () => {
    setActiveSearchQuery(searchTerm.trim());
    if(currentPage !== 1) setCurrentPage(1);
    // if on page 1, activeSearchQuery change in useEffect for loadWhitelist will trigger it.
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearchQuery('');
    if(currentPage !== 1) setCurrentPage(1);
    // if on page 1, activeSearchQuery change (to empty) in useEffect for loadWhitelist will trigger it.
  };

  if (loading && entries.length === 0 && currentPage === 1 && !activeSearchQuery) { // Show full page loader only on initial load of page 1
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-6 p-4 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-sm">
          {error}
        </div>
      )}

      <div className="bg-[var(--color-bg-surface)] p-6 rounded-sm  mb-6">
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

        <div className="flex flex-col sm:flex-row gap-4 font-mono text-sm">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 p-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-sm focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)]"
          />
          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 p-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-sm focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)]"
          />
          <button
            onClick={addToWhitelist}
            disabled={isAdding || !newEmail}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-sm transition-colors ${
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

      {/* Search Bar */}
      <div className="mb-6 flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search by email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter') handleManualSearch(); }}
          className="flex-grow px-3 py-2 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm"
        />
        <button
          onClick={handleManualSearch}
          className="p-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-primary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)]"
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>
        {activeSearchQuery && (
          <button
            onClick={handleClearSearch}
            className="p-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-error)] hover:bg-[var(--color-error-bg-hover)] border border-[var(--color-border)]"
            title="Clear Search"
          >
            <ClearSearchIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4 relative">
        {loading && entries.length > 0 && currentPage !==1 && ( // Show subtle loading indicator when reloading list, but not on initial full load
          <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-2 z-10">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-accent-primary)]"></div>
          </div>
        )}
        {!loading && entries.length === 0 && (
           <div className="text-center py-10 text-[var(--color-text-secondary)] font-mono">
            {activeSearchQuery 
              ? `No entries found matching "${activeSearchQuery}".`
              : "No entries in the whitelist yet."}
          </div>
        )}
        {entries.map((entry) => (
                     <motion.div
             key={entry.id}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
             className="bg-[var(--color-bg-surface)] p-4 rounded-sm border border-[var(--color-border)] flex justify-between items-start gap-3 group"
           >
             <div className="flex-1 min-w-0">
               <div className="font-medium text-[var(--color-text-primary)] truncate">{entry.email}</div>
               <div className="flex flex-col sm:flex-row sm:gap-4 mt-2 text-sm">
                 {entry.has_finished_signup ? (
                   <span className="text-emerald-600">Signup Completed</span>
                 ) : (
                   <span className="text-[var(--color-text-secondary)]">Signup Not Completed</span>
                 )}
                 {entry.last_sign_in_at && (
                   <span className="text-[var(--color-text-secondary)]">
                     Last sign in: {new Date(entry.last_sign_in_at).toISOString().slice(0, 10)}
                   </span>
                 )}
               </div>
               {entry.notes && (
                 <div className="mt-2 text-sm text-[var(--color-text-secondary)] italic">
                   Note: {entry.notes}
                 </div>
               )}
             </div>
             <button
               onClick={() => openDeleteConfirmModal(entry)}
               className="opacity-0 group-hover:opacity-100 p-2 rounded-sm bg-slate-600 text-white hover:bg-red-600 transition-all flex-shrink-0"
               title="Delete whitelist entry"
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
              className="bg-[var(--color-bg-surface)] rounded-sm max-w-md w-full p-6"
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

      {/* Pagination Controls */}
      {totalEntriesCount > ITEMS_PER_PAGE && (
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="font-mono text-sm text-[var(--color-text-secondary)] order-2 sm:order-1">
            {`Page ${currentPage} of ${totalPageCount > 0 ? totalPageCount : 1}`}
            {totalEntriesCount > 0 && !activeSearchQuery &&
              ` (Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, totalEntriesCount)} of ${totalEntriesCount})`
            }
            {totalEntriesCount > 0 && activeSearchQuery &&
              ` (Found ${totalEntriesCount} matching "${activeSearchQuery}")`
            }
            {totalEntriesCount === 0 && activeSearchQuery && ` (No matches for "${activeSearchQuery}")`}
            {totalEntriesCount === 0 && !activeSearchQuery && ` (No entries)`}
          </div>

                     {totalPageCount > 0 && (
             <div className="flex items-center space-x-1 order-1 sm:order-2">
               {/* Mobile: Simple Prev/Next */}
               <div className="flex sm:hidden items-center space-x-1">
                 <button
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                   disabled={currentPage === 1 || loading}
                   className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
                 >
                   Prev
                 </button>
                 <span className="px-2 py-1.5 text-[var(--color-text-secondary)] font-mono text-xs">
                   {currentPage} / {totalPageCount}
                 </span>
                 <button
                   onClick={() => setCurrentPage(prev => Math.min(totalPageCount, prev + 1))}
                   disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
                   className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
                 >
                   Next
                 </button>
               </div>
               
               {/* Desktop: Full pagination */}
               <div className="hidden sm:flex items-center space-x-1">
                 <button
                   onClick={() => setCurrentPage(1)}
                   disabled={currentPage === 1 || loading}
                   className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
                 >
                   First
                 </button>
                 <button
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                   disabled={currentPage === 1 || loading}
                   className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
                 >
                   Prev
                 </button>
                 {paginationRange?.map((pageNumber, index) => {
                   if (pageNumber === DOTS) {
                     return <span key={`${pageNumber}-${index}`} className="px-3 py-1.5 text-[var(--color-text-secondary)] font-mono text-xs">...</span>;
                   }
                   const pageNum = pageNumber as number;
                   return (
                     <button
                       key={`${pageNumber}-${index}`}
                       onClick={() => setCurrentPage(pageNum)}
                       disabled={loading}
                       className={`px-3 py-1.5 rounded-sm font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                         currentPage === pageNum
                           ? 'bg-emerald-900 text-white'
                           : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)]'
                       }`}
                     >
                       {pageNumber}
                     </button>
                   );
                 })}
                 <button
                   onClick={() => setCurrentPage(prev => Math.min(totalPageCount, prev + 1))}
                   disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
                   className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
                 >
                   Next
                 </button>
                 <button
                   onClick={() => setCurrentPage(totalPageCount)}
                   disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
                   className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
                 >
                   Last
                 </button>
               </div>
             </div>
           )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirmModal && entryToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[var(--color-bg-surface)] rounded-sm max-w-md w-full p-6 relative z-[101]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-lg font-medium text-[var(--color-text-primary)]">Confirm Deletion</h3>
                <button
                  onClick={closeDeleteConfirmModal}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-[var(--color-text-secondary)] mb-4">
                Are you sure you want to remove "{entryToDelete.email}" from the whitelist?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={closeDeleteConfirmModal}
                  className="px-4 py-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors font-mono"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-sm bg-red-600 text-white hover:bg-red-700 transition-colors font-mono"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
