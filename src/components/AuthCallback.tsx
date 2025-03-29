import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('AuthCallback: Handling callback');
        
        // Get the hash from the URL
        const hash = window.location.hash;
        if (hash) {
          console.log('AuthCallback: Found hash in URL');
          // Parse the hash parameters
          const params = new URLSearchParams(hash.replace('#', '?'));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('AuthCallback: Setting session from URL tokens');
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (setSessionError) {
              console.error('AuthCallback: Error setting session:', setSessionError);
              navigate('/');
              return;
            }
            
            // Clean up the URL by removing the hash
            window.location.hash = '';
          }
        }

        // Verify the session was set correctly
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthCallback: Error getting session:', error);
          navigate('/');
          return;
        }

        if (session) {
          console.log('AuthCallback: Session found, redirecting to main app');
          navigate('/');
        } else {
          console.log('AuthCallback: No session found, redirecting to landing page');
          navigate('/');
        }
      } catch (err) {
        console.error('AuthCallback: Unexpected error:', err);
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate, location]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-display font-light text-stone-900 mb-4">Completing sign in...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-900 mx-auto"></div>
      </div>
    </div>
  );
} 