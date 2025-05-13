import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function SignUpHeader() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
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