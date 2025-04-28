import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Define the return type for clarity
interface UseSessionReturn {
  session: Session | null;
  isLoading: boolean;
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state, default true

  useEffect(() => {
    let mounted = true; // Prevent state updates on unmounted component
    console.log('useSession: useEffect started, isLoading=true');

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted) {
        console.log('useSession: getSession completed', { hasSession: !!initialSession });
        setSession(initialSession);
        // Don't set loading false here yet, wait for listener setup? Or maybe okay?
        // Let's set it here for now, onAuthStateChange will handle subsequent updates.
        // setIsLoading(false); 
      }
    }).catch(error => {
        console.error('useSession: Error in getSession:', error);
        // if (mounted) setIsLoading(false); // Also set loading false on error
    }).finally(() => {
        // Set loading false *after* initial check attempt is complete
        if (mounted) {
            console.log('useSession: getSession finally block, setting isLoading=false');
            setIsLoading(false);
        }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      // The listener might fire before getSession finishes, especially on initial load.
      // We need to ensure loading is only set to false once definitively settled.
      console.log('useSession: onAuthStateChange triggered', { event: _event, hasSession: !!currentSession });
      if (mounted) {
        setSession(currentSession);
        // If the auth state changes, we are no longer in the initial loading phase.
        // But getSession's finally block should handle the initial load case.
        // Let's ensure isLoading is false if we get an event AFTER the initial load.
        if (!isLoading) {
            // If already not loading, just update session.
        } else {
            // If we were still loading, this event means the state is now known.
             console.log('useSession: onAuthStateChange setting isLoading=false');
             setIsLoading(false);
        }
      }
    });

    return () => {
      console.log('useSession: Unsubscribing from auth changes');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Return the session state and the loading status
  return { session, isLoading };
}