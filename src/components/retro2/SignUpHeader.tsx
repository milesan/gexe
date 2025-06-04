import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function SignUpHeader() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    console.log('SignUpHeader: Signing out...');

    try {
      // Attempt to sign out globally (invalidate server session)
      console.log('SignUpHeader: Attempting global sign out...');
      const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
      if (globalError) {
        console.warn('SignUpHeader: Global sign out failed or session already invalid:', globalError.message);
      } else {
        console.log('SignUpHeader: Global sign out successful.');
      }
    } catch (err) {
      console.error('SignUpHeader: Unexpected error during global sign out:', err);
    }

    try {
      // Always attempt to sign out locally (clear client-side session)
      console.log('SignUpHeader: Performing local sign out...');
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
      if (localError) {
        console.error('SignUpHeader: Local sign out failed:', localError.message);
      } else {
        console.log('SignUpHeader: Local sign out successful.');
      }
    } catch (err) {
      console.error('SignUpHeader: Unexpected error during local sign out:', err);
    }
    
    // After all sign-out attempts, navigate.
    console.log('SignUpHeader: Navigating to / after sign out process.');
    navigate('/'); // Navigate to landing after sign out
  };

  return (
    <div className="sticky top-0 z-50 bg-black border-b border-retro-accent/20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between py-4">
          {/* Consider making "The Garden" a link to the start of the signup flow or landing page if needed */}
          <h1 className="text-xl sm:text-2xl font-lettra-bold">The Garden</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-retro-accent/10 hover:bg-retro-accent/20 transition-colors rounded"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
} 