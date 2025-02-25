import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { PendingPage } from './pages/PendingPage';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { Retro2Page } from './pages/Retro2Page';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useSession } from './hooks/useSession';
import { WhitelistWelcomeModal } from './components/WhitelistWelcomeModal';

function AcceptancePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (!token) {
      setError('Invalid acceptance link');
      return;
    }

    const verifyToken = async () => {
      try {
        const { error: verifyError } = await supabase.functions.invoke('verify-acceptance-token', {
          body: { token }
        });

        if (verifyError) throw verifyError;
        setShowWelcome(true);
      } catch (err) {
        console.error('Error accepting invitation:', err);
        setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      }
    };

    verifyToken();
  }, [token]);

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return (
    <WhitelistWelcomeModal 
      isOpen={showWelcome} 
      onClose={() => window.location.href = '/app'} 
    />
  );
}

export default function App() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    const checkUserStatus = async () => {
      try {
        // If no session, show public routes
        if (!session?.user) {
          if (mounted) setLoading(false);
          return;
        }

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;

        // Get user metadata
        const userMetadata = user?.user_metadata || {};
        setMetadata(userMetadata);
      } catch (err) {
        console.error('Error checking user status:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkUserStatus();

    return () => {
      mounted = false;
    };
  }, [session]);

  // Show public routes while loading or no session
  if (loading || !session) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Get user metadata with proper type checking
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' || session?.user?.email === 'redis213@gmail.com';
  const hasApplied = metadata?.has_applied === true;
  const applicationStatus = metadata?.application_status;

  // If user is admin or has an approved application, show full app
  if (isAdmin || applicationStatus === 'approved') {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/*" element={<AuthenticatedApp />} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // If they haven't applied yet, show Retro2 application page
  if (!hasApplied) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="*" element={<Retro2Page />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // If they've applied but application is pending or rejected
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pending" element={<PendingPage />} />
            <Route path="/confirmation" element={<ConfirmationPage />} />
            <Route path="/retro2" element={<Retro2Page />} />
            <Route path="/accept" element={<AcceptancePage />} />
            <Route
              path="/*"
              element={
                <ErrorBoundary>
                  <AuthenticatedApp />
                </ErrorBoundary>
              }
            />
          </Routes>
        </Router>
        <PendingPage status={applicationStatus} />
      </ThemeProvider>
    </ErrorBoundary>
  );
}