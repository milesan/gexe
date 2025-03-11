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
        "4000": formData.firstName,  // First name
        "5000": formData.lastName,   // Last name
        "10000": formData.contact.value,  // Contact value
        "11000": `${formData.contact.type}: ${formData.contact.value}`,  // Contact with type
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
            email: user.email
          }
        ], { onConflict: 'id' })
        .select()
        .single();

      if (profileError) throw profileError;
      console.log('✅ Profile created/updated:', profileData);

      // Update user metadata
      console.log('🔄 Updating user metadata...');
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          has_completed_whitelist_signup: true
        }
      });

      if (updateError) throw updateError;

      // Refresh the session to reflect the changes
      console.log('🔄 Refreshing session...');
      const { error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) throw sessionError;

      console.log('🎉 Whitelist signup completed successfully!');
      navigate('/');

    } catch (error) {
      console.error('❌ Error in whitelist signup:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-[#FFBF00]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <Terminal className="w-12 h-12 mx-auto mb-4" />
            <h1 className="text-3xl font-display mb-2">Welcome to The Garden</h1>
            <p className="text-[#FFBF00]/60">Just a few details to complete your account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 text-red-500 rounded-lg text-sm">
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
                  className="w-full bg-white/5 border border-[#FFBF00]/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FFBF00]/40"
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
                  className="w-full bg-white/5 border border-[#FFBF00]/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FFBF00]/40"
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
                  className="bg-white/5 border border-[#FFBF00]/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FFBF00]/40"
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
                  className="w-full bg-white/5 border border-[#FFBF00]/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FFBF00]/40"
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
                  className="w-full bg-white/5 border border-[#FFBF00]/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#FFBF00]/40"
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
                className="w-4 h-4 rounded border-[#FFBF00]/20 bg-white/5"
              />
              <label className="text-sm text-[#FFBF00]/60">
                We value data privacy. By checking this box, you consent to The Garden storing and reviewing your data for this residency.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFBF00] text-black py-3 rounded-lg hover:bg-[#FFBF00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Complete Signup'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
} 