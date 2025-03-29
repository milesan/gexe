import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('AuthCallback: Handling callback');
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
  }, [navigate]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-display font-light text-stone-900 mb-4">Completing sign in...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-900 mx-auto"></div>
      </div>
    </div>
  );
} 