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
    console.log('PendingPage: Signing out user...');

    try {
      // Attempt to sign out globally (invalidate server session)
      console.log('PendingPage: Attempting global sign out...');
      const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
      if (globalError) {
        console.warn('PendingPage: Global sign out failed or session already invalid:', globalError.message);
      } else {
        console.log('PendingPage: Global sign out successful.');
      }
    } catch (err) {
      console.error('PendingPage: Unexpected error during global sign out:', err);
    }

    try {
      // Always attempt to sign out locally (clear client-side session)
      console.log('PendingPage: Performing local sign out...');
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
      if (localError) {
        console.error('PendingPage: Local sign out failed:', localError.message);
      } else {
        console.log('PendingPage: Local sign out successful.');
      }
    } catch (err) {
      console.error('PendingPage: Unexpected error during local sign out:', err);
    }
    
    // After all sign-out attempts, navigate.
    console.log('PendingPage: Navigating to / after sign out process.');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-black text-retro-accent font-mono flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-black rounded-sm border-4 border-retro-accent/30 p-8 mb-6"
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
        <div className="flex flex-col items-center text-center space-y-6">
          <div
            className="w-12 h-12"
            style={{
              backgroundColor: 'var(--color-garden-matrix)',
              maskImage: 'url(https://raw.githubusercontent.com/milesan/synesthesia/refs/heads/main/Enso%20Zen%20Soto%20Symbol.png)',
              WebkitMaskImage: 'url(https://raw.githubusercontent.com/milesan/synesthesia/refs/heads/main/Enso%20Zen%20Soto%20Symbol.png)',
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
              opacity: 0.9 
            }}
          ></div>
          
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

      {status === 'pending' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-md w-full bg-black rounded-sm border-2 border-retro-accent/50 p-6"
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
          <p className="text-retro-accent/80 text-sm font-mono leading-relaxed text-center">
            If a low-income subsidy could support your participation, please let us know{' '}
            <a 
              href="https://www.notion.so/gardening/1e981af59c8680e6a791c2a185d350fe" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="underline hover:text-retro-accent"
            >
              here
            </a>
            .
          </p>
        </motion.div>
      )}
    </div>
  );
}
