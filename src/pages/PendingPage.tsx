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
    <div className="min-h-screen bg-black text-retro-accent font-mono flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-black rounded-sm border-4 border-retro-accent/30 p-8"
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
            <h1 className="text-3xl font-display font-light text-retro-accent">
              Application Pending
            </h1>
          )}

          <p className="text-retro-accent/80 text-sm font-mono leading-relaxed">
            {status === 'pending' ? (
              "Thank you for applying to The Garden. Your application is currently being reviewed. We'll notify you by email once a decision has been made."
            ) : (
              'All full, try again next year <3'
            )}
          </p>

          <div className="flex flex-col sm:flex-row w-full space-y-4 sm:space-y-0 sm:space-x-4 mt-6">
            {status === 'pending' && (
              <a
                href="https://www.youtube.com/watch?v=9EYgKqjocO0"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:flex-1 bg-retro-accent text-black hover:bg-accent-secondary font-mono py-3 px-6 rounded-sm transition-colors text-center"
                style={{
                  clipPath: `polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))`
                }}
              >
                Continue
              </a>
            )}
            <button
              onClick={handleSignOut}
              className={`w-full ${status === 'pending' ? 'sm:flex-1' : ''} bg-retro-accent text-black hover:bg-accent-secondary font-mono py-3 px-6 rounded-sm transition-colors`}
              style={{
                clipPath: `polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))`
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
