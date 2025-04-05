import React from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Props {
  status?: 'pending' | 'rejected';
}

export function PendingPage({ status = 'pending' }: Props) {
  console.log(`PendingPage: Rendering with status - ${status}`);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      console.log('PendingPage: Signing out user');
      await supabase.auth.signOut();
      
      // Use navigate for smoother transition
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-surface rounded-2xl shadow-sm border border p-8"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          <img 
            src="https://raw.githubusercontent.com/milesan/synesthesia/refs/heads/main/Enso%20Zen%20Soto%20Symbol.png"
            alt="Enso Logo"
            className="w-12 h-12"
            style={{ 
              filter: 'brightness(0) invert(0.75) sepia(0.6) saturate(400%) hue-rotate(360deg)',
              opacity: 0.9
            }}
          />
          
          {status === 'pending' && (
            <h1 className="text-3xl font-display font-light text-primary">
              Application Pending
            </h1>
          )}

          <p className="text-secondary text-sm font-regular leading-relaxed">
            {status === 'pending' ? (
              "Thank you for applying to The Garden. Your application is currently being reviewed. We'll notify you by email once a decision has been made."
            ) : (
              'All full, try again next year <3'
            )}
          </p>

          <button
            onClick={handleSignOut}
            className="w-full bg-accent-primary font-regular text-stone-800 py-3 px-6 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}