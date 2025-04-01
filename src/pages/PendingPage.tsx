import React from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Props {
  status?: 'pending' | 'rejected';
}

export function PendingPage({ status = 'pending' }: Props) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      console.log('PendingPage: Signing out user');
      await supabase.auth.signOut();
      
      // Force refresh the page to reset app state
      window.location.href = '/';
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
          
          <h1 className="text-3xl font-display font-light text-primary">
            {status === 'pending' ? 'Application Pending' : 'Application Not Accepted'}
          </h1>

          <p className="text-secondary leading-relaxed">
            {status === 'pending' ? (
              "Thank you for applying to The Garden. Your application is currently being reviewed. We'll notify you by email once a decision has been made."
            ) : (
              'Unfortunately, your application was not accepted at this time. We appreciate your interest in The Garden and wish you the best in your journey.'
            )}
          </p>

          <button
            onClick={handleSignOut}
            className="w-full bg-accent-primary text-white py-3 px-6 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}