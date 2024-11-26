import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PasswordCheckModal({ isOpen, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (password.toLowerCase() === 'confluence') {
        // Update user metadata to mark as approved
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            has_applied: true,
            application_status: 'approved'
          }
        });

        if (updateError) throw updateError;

        // Refresh session to get new metadata
        await supabase.auth.refreshSession();
        
        onSuccess();
      } else {
        setError('Incorrect password');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-black border-2 border-[#FFBF00]/30 max-w-md w-full p-8 relative"
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
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[#FFBF00]/60 hover:text-[#FFBF00]"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <h2 className="text-[#FFBF00] text-2xl font-display mb-2">Do you have a password?</h2>
              <p className="text-[#FFBF00]/60 text-sm">Enter it below or click "No" to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/30 p-3 text-[#FFBF00] border-2 border-[#FFBF00]/30 focus:outline-none focus:ring-2 focus:ring-[#FFBF00]/50 placeholder-[#FFBF00]/30"
                  placeholder="Enter password"
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
                {error && (
                  <p className="mt-2 text-red-500 text-sm">{error}</p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-black text-[#FFBF00] border-2 border-[#FFBF00]/30 p-3 hover:bg-[#FFBF00]/10 transition-colors font-display"
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
                  No
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#FFBF00] text-black p-3 hover:bg-[#FFBF00]/90 transition-colors font-display disabled:opacity-50 disabled:cursor-not-allowed"
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
                  {loading ? 'Checking...' : 'Submit'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}