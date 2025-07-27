import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface WhitelistFormData {
  firstName: string;
  lastName: string;
  contact: {
    type: 'whatsapp' | 'telegram' | 'signal';
    value: string;
  };
  avatar?: File;
  dataConsent: boolean;
}

export function WhitelistSignupPage() {
  const [formData, setFormData] = useState<WhitelistFormData>({
    firstName: '',
    lastName: '',
    contact: {
      type: 'whatsapp',
      value: ''
    },
    dataConsent: false
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    console.log('WhitelistSignupPage: Signing out user...');

    try {
      // Attempt to sign out globally (invalidate server session)
      console.log('WhitelistSignupPage: Attempting global sign out...');
      const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
      if (globalError) {
        console.warn('WhitelistSignupPage: Global sign out failed or session already invalid:', globalError.message);
      } else {
        console.log('WhitelistSignupPage: Global sign out successful.');
      }
    } catch (err) {
      console.error('WhitelistSignupPage: Unexpected error during global sign out:', err);
    }

    try {
      // Always attempt to sign out locally (clear client-side session)
      console.log('WhitelistSignupPage: Performing local sign out...');
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
      if (localError) {
        console.error('WhitelistSignupPage: Local sign out failed:', localError.message);
      } else {
        console.log('WhitelistSignupPage: Local sign out successful.');
      }
    } catch (err) {
      console.error('WhitelistSignupPage: Unexpected error during local sign out:', err);
    }
    
    // After all sign-out attempts, navigate.
    console.log('WhitelistSignupPage: Navigating to / after sign out process.');
    navigate('/');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setFormData(prev => ({
      ...prev,
      avatar: file
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('🔄 Starting whitelist signup submission...');
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      console.log('👤 Current user:', user);

      // Upload avatar if provided
      let avatarUrl = null;
      if (formData.avatar) {
        console.log('📤 Uploading avatar...');
        const fileName = `${Date.now()}-${formData.avatar.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        
        const { error: uploadError } = await supabase.storage
          .from('application-photos')
          .upload(`photos/${fileName}`, formData.avatar, { 
            upsert: true,
            contentType: formData.avatar.type
          });

        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('application-photos')
          .getPublicUrl(`photos/${fileName}`);
          
        avatarUrl = publicUrl;
        console.log('✅ Avatar uploaded:', avatarUrl);
      }

      // Create application record with all user data
      console.log('📋 Creating application record...');
      const applicationData: Record<string, any> = {
        "39f455d1-0de8-438f-8f34-10818eaec15e": formData.firstName,  // First name
        "246d0acf-25cd-4e4e-9434-765e6ea679cb": formData.lastName,   // Last name
        "862413b2-5753-4020-bffc-4c8fd71b0568": formData.contact.value,  // Contact value
        "74edfb7a-458e-4dca-bed5-90dd5ccc1bb7": `${formData.contact.type}: ${formData.contact.value}`,  // Contact with type
      };

      // Add avatar if uploaded
      if (avatarUrl) {
        applicationData["14000"] = [{ url: avatarUrl }];  // Photos
      }

      const { error: applicationError } = await supabase
        .from('applications')
        .insert([
          {
            user_id: user.id,
            data: applicationData,
            status: 'approved'  // Since they're whitelisted
          }
        ]);

      if (applicationError) throw applicationError;
      console.log('✅ Application record created');

      // Create or update basic profile
      console.log('📋 Updating profile...');
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert([
          { 
            id: user.id,
            email: user.email,
            first_name: formData.firstName,
            last_name: formData.lastName
          }
        ], { onConflict: 'id' })
        .select()
        .single();

      if (profileError) throw profileError;
      console.log('✅ Profile created/updated:', profileData);

      // --- NEW: Update user metadata --- 
      const metadataToSet = { 
        has_applied: true,       // Mark as applied
        application_status: 'approved', // Mark as approved (since whitelisted)
        is_whitelisted: true,        // Explicitly mark as whitelisted in metadata
        has_seen_welcome: false,      // Set to false to trigger welcome modal (or let App.tsx handle this)
        has_completed_whitelist_signup: true // ***** THIS IS THE KEY FLAG *****
      };
      console.log('🔄 WhitelistSignupPage: Attempting to update user metadata with:', metadataToSet);
      
      const { data: updatedUserData, error: updateError } = await supabase.auth.updateUser({
        data: metadataToSet
      });

      if (updateError) {
        console.error('❌ CRITICAL Error updating user metadata in WhitelistSignupPage:', updateError);
        setError(`CRITICAL: Failed to update user metadata. ${updateError.message}`); // Show to user
        setLoading(false); // Stop loading
        return; // Halt the process
      } else {
        console.log('✅ WhitelistSignupPage: User metadata update successful. Response from Supabase:', updatedUserData);
        // Check if the response contains the updated metadata as expected
        if (updatedUserData?.user?.user_metadata?.has_completed_whitelist_signup === true) {
          console.log('✅ WhitelistSignupPage: Confirmed has_completed_whitelist_signup is true in the response.');
        } else {
          console.warn('⚠️ WhitelistSignupPage: has_completed_whitelist_signup was NOT true in the updateUser response. Actual metadata:', updatedUserData?.user?.user_metadata);
        }
      }
      // --- END NEW METADATA UPDATE ---

      // --- NEW: Update whitelist table --- 
      console.log(`🔄 Updating whitelist table for ${user.email}...`);
      const { error: whitelistUpdateError } = await supabase
        .from('whitelist') // Ensure this table name is correct
        .update({ has_created_account: true }) // Ensure this column name is correct
        .eq('email', user.email);

      if (whitelistUpdateError) {
        // Log error, but potentially continue? Decide if this is critical.
        console.error('❌ Error updating whitelist table:', whitelistUpdateError);
      } else {
        console.log('✅ Whitelist table updated successfully.');
      }
      // --- END WHITELIST UPDATE ---

      // Refresh the session to reflect the changes
      console.log('🔄 Refreshing session...');
      // It's generally good practice to refresh the session after metadata updates if subsequent logic depends on it immediately.
      const { error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) {
           console.warn('⚠️ WhitelistSignupPage: Error refreshing session after signup (might be ok):', sessionError);
      }

      console.log('🎉 Whitelist signup data submission completed successfully! Navigating to / route.');
      navigate('/', { replace: true, state: { fromWhitelistSignup: true, justCompletedWhitelistSignup: true } });

    } catch (error) {
      console.error('❌ Error in whitelist signup:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-retro-accent">
        <div className="absolute top-4 right-4">
          <button
            onClick={handleSignOut}
            className="bg-retro-accent/10 text-retro-accent px-4 py-2 rounded-sm hover:bg-retro-accent/10 transition-colors text-sm font-body border border-retro-accent/30"
          >
            Sign Out
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md overflow-y-auto max-h-[90vh] p-1"
        >
          <div className="text-center mb-8">
            <Terminal className="w-12 h-12 mx-auto mb-4" />
            <h1 className="text-3xl font-display mb-2">Welcome to The Garden</h1>
            <p className="text-retro-accent/70">Just a few details to complete your account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 text-red-500 rounded-sm text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2">First Name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    firstName: e.target.value
                  }))}
                  className="w-full bg-black p-3 text-retro-accent focus:outline-none focus:ring-2 focus:ring-retro-accent/50 placeholder-retro-accent/30 border-4 border-retro-accent/30"
                  style={{
                    clipPath: `polygon(
                      0 4px, 4px 4px, 4px 0,
                      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                      calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                      0 calc(100% - 4px)
                    )`
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    lastName: e.target.value
                  }))}
                  className="w-full bg-black p-3 text-retro-accent focus:outline-none focus:ring-2 focus:ring-retro-accent/50 placeholder-retro-accent/30 border-4 border-retro-accent/30"
                  style={{
                    clipPath: `polygon(
                      0 4px, 4px 4px, 4px 0,
                      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                      calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                      0 calc(100% - 4px)
                    )`
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Contact Method</label>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={formData.contact.type}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    contact: {
                      ...prev.contact,
                      type: e.target.value as any
                    }
                  }))}
                  className="bg-black p-3 text-retro-accent focus:outline-none focus:ring-2 focus:ring-retro-accent/50 placeholder-retro-accent/30 border-4 border-retro-accent/30 [&>option]:bg-zinc-900 [&>option]:text-white"
                  style={{
                    clipPath: `polygon(
                      0 4px, 4px 4px, 4px 0,
                      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                      calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                      0 calc(100% - 4px)
                    )`
                  }}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="signal">Signal</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Your number/username"
                  value={formData.contact.value}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    contact: {
                      ...prev.contact,
                      value: e.target.value
                    }
                  }))}
                    className="w-full bg-black p-3 text-retro-accent focus:outline-none focus:ring-2 focus:ring-retro-accent/50 placeholder-retro-accent/30 border-4 border-retro-accent/30"
                  style={{
                    clipPath: `polygon(
                      0 4px, 4px 4px, 4px 0,
                      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                      calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                      0 calc(100% - 4px)
                    )`
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Profile Photo (Optional)</label>
              <div className="flex items-center gap-4">
                {avatarPreview && (
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="w-full bg-black p-3 text-retro-accent focus:outline-none focus:ring-2 focus:ring-retro-accent/50 placeholder-retro-accent/30 border-4 border-retro-accent/30"
                  style={{
                    clipPath: `polygon(
                      0 4px, 4px 4px, 4px 0,
                      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                      calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                      0 calc(100% - 4px)
                    )`
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                required
                checked={formData.dataConsent}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  dataConsent: e.target.checked
                }))}
                className="w-4 h-4 rounded border-retro-accent/30 bg-white/5"
              />
              <label className="text-sm text-retro-accent/70">
                We value data privacy. By checking this box, you consent to The Garden storing your data for the purpose of this residency or event.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-retro-accent text-black py-3 rounded-sm hover:bg-retro-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Complete Signup'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
} 