import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { WhitelistWelcomeModal } from '../components/WhitelistWelcomeModal';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    const acceptInvitation = async () => {
      const token = searchParams.get('token');
      console.log('AcceptInvitePage: Processing token', { token });
      if (!token) {
        setStatus('error');
        setErrorMessage('No token provided');
        return;
      }

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-acceptance-token`;
        console.log('AcceptInvitePage: Sending request to:', url);
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
        setShowWelcomeModal(true);
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

  return (
    <WhitelistWelcomeModal
      isOpen={showWelcomeModal}
      onClose={() => {
        window.location.href = '/';
      }}
    />
  );
}