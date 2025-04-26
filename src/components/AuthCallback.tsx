import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
// import { useLocation } from 'react-router-dom'; // No longer needed
// import { supabase } from '../lib/supabase'; // No longer needed

export function AuthCallback() {
  const navigate = useNavigate();
  const session = useSession();
  // const location = useLocation(); // No longer needed

  useEffect(() => {
    // --- Add Log on Effect Run ---
    console.log('AuthCallback: useEffect running.');

    // Supabase client handles the session automatically via onAuthStateChange in App.tsx
    // This component just needs to exist and show a loading state.
    // console.log('AuthCallback: Rendering loading screen while Supabase handles auth...');

    // --- New Logic --- 
    console.log('AuthCallback: Checking session state...');
    if (session) {
      console.log('AuthCallback: Session detected, navigating to /');
      navigate('/', { replace: true }); // Navigate away once session is confirmed
    } else {
      console.log('AuthCallback: No session yet, waiting...');
    }
    // Depend on session so this runs when session state changes
  }, [session, navigate]); // Update dependencies

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-display font-light text-stone-900 mb-4">Completing sign in...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-900 mx-auto"></div>
      </div>
    </div>
  );
} 