import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AcceptInvitePage() {
  console.log('AcceptInvitePage: Component mounted');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    console.log('AcceptInvitePage: useEffect triggered', { token, status });
    
    const acceptInvitation = async () => {
      if (!token) {
        console.error('AcceptInvitePage: No token provided');
        setStatus('error');
        setErrorMessage('No invitation token provided');
        return;
      }

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-acceptance-token`;
        console.log('AcceptInvitePage: Sending request to:', url, { token });
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

        console.log('AcceptInvitePage: Response status:', response.status);
        const responseBody = await response.text();
        console.log('AcceptInvitePage: Response body:', responseBody);

        if (!response.ok) {
          console.error('AcceptInvitePage: Request failed', { status: response.status, body: responseBody });
          setStatus('error');
          setErrorMessage(`Request failed with status ${response.status}`);
          return;
        }

        const { session, error } = JSON.parse(responseBody);
        if (error) {
          console.error('AcceptInvitePage: Token verification failed', { error });
          setStatus('error');
          setErrorMessage(error);
          return;
        }
        await supabase.auth.setSession(session);
        const { error: userUpdateError } = await supabase.auth.updateUser({
          data: {
            is_whitelisted: true,
            has_seen_welcome: false,
          },
        });

        if (userUpdateError) {
          console.error('AcceptInvitePage: Error updating user metadata:', userUpdateError);
        }

        console.log('AcceptInvitePage: Successfully processed token and signed in user');
        setStatus('success');
        window.location.href = '/';
      } catch (error) {
        console.error('AcceptInvitePage: Unexpected error', error);
        setStatus('error');
        setErrorMessage('An unexpected error occurred');
      }
    };

    acceptInvitation();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Processing your invitation...</h2>
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
        </div>
      </div>
    );
  }

  return null;
}