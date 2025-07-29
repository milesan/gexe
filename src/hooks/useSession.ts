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

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted) {
        setSession(initialSession);
      }
    }).catch(error => {
        console.error('useSession: Error in getSession:', error);
    }).finally(() => {
        // Set loading false *after* initial check attempt is complete
        if (mounted) {
            setIsLoading(false);
        }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        // If the auth state changes, we are no longer in the initial loading phase.
        if (isLoading) {
            setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Return the session state and the loading status
  return { session, isLoading };
}