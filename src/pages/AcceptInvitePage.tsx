import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AcceptInvitePageProps {
  isWhitelist?: boolean;
}

export function AcceptInvitePage({ isWhitelist = false }: AcceptInvitePageProps) {
  console.log('AcceptInvitePage: Component mounted', { isWhitelist });
  console.log('AcceptInvitePage: URL params', { 
    searchParams: window.location.search,
    pathname: window.location.pathname
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const requestMadeRef = useRef(false);

  useEffect(() => {
    console.log('AcceptInvitePage: useEffect triggered', { token, status, isWhitelist });

    const acceptInvitation = async () => {
      if (!token) {
        console.error('AcceptInvitePage: No token provided');
        setStatus('error');
        setErrorMessage('No invitation token provided');
        return;
      }

      if (requestMadeRef.current) {
        console.log('AcceptInvitePage: Request already made, skipping');
        return;
      }

      requestMadeRef.current = true;

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${isWhitelist ? 'verify-whitelist-token' : 'verify-acceptance-token'}`;
        console.log('AcceptInvitePage: Sending request to:', url, { token, isWhitelist });
        console.log('AcceptInvitePage: Processing token', { token });
        const response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          body: JSON.stringify({ token }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });
        console.log('Raw response:', {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

        console.log('AcceptInvitePage: Response status:', response.status);
        const responseBody = await response.text();
        console.log('AcceptInvitePage: Response body:', responseBody);

        if (!response.ok) {
          console.error('AcceptInvitePage: Request failed', { status: response.status, body: responseBody });
          setStatus('error');
          try {
            const errorData = JSON.parse(responseBody);
            setErrorMessage(errorData.error || `Request failed with status ${response.status}`);
          } catch (e) {
            setErrorMessage(`Request failed with status ${response.status}`);
          }
          return;
        }

        const responseData = JSON.parse(responseBody);
        if (responseData.error) {
          console.error('AcceptInvitePage: Token verification failed', { error: responseData.error });
          setStatus('error');
          setErrorMessage(responseData.error);
          return;
        }

        // Check for magic link (whitelist flow)
        if (responseData.data?.properties?.action_link) {
          console.log('AcceptInvitePage: Redirecting to magic link');
          window.location.href = responseData.data.properties.action_link;
          return;
        }
        
        // Check for session (acceptance flow)
        if (responseData.session) {
          console.log('AcceptInvitePage: Session received, setting in Supabase');
          
          // Set the session in Supabase client
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: responseData.session.access_token,
            refresh_token: responseData.session.refresh_token
          });
          
          if (setSessionError) {
            console.error('AcceptInvitePage: Failed to set session', setSessionError);
            setStatus('error');
            setErrorMessage('Failed to set user session');
            return;
          }
          
          console.log('AcceptInvitePage: Session set successfully, redirecting to home');
          // Redirect using React Router, adding state for seamless modal display
          navigate('/', { replace: true, state: { fromAcceptanceFlow: true } });
          return;
        }

        // If we get here, neither a magic link nor a session was found
        console.error('AcceptInvitePage: No magic link or session found in response');
        setStatus('error');
        setErrorMessage('Failed to get sign in link');
      } catch (error) {
        console.error('AcceptInvitePage: Unexpected error', error);
        setStatus('error');
        setErrorMessage('An unexpected error occurred');
      }
    };

    acceptInvitation();
  }, [searchParams, isWhitelist, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Processing your invitation...</h2>
          <p className="mt-2 text-sm text-gray-600">
            {isWhitelist ? 'Setting up your account...' : 'Verifying your invitation...'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Error</h2>
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          <p className="mt-2 text-sm text-gray-600">
            {isWhitelist
              ? 'There was a problem setting up your account. Please contact support.'
              : 'There was a problem with your invitation. Please try again or contact support.'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}