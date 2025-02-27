import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, Navigate } from 'react-router-dom';
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
import { AcceptInvitePage } from './pages/AcceptInvitePage';

export default function App() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we have a session
    const checkSession = async () => {
      try {
        console.log('App: Checking session');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('App: Session check complete', { hasSession: !!session });
        setIsLoading(false);
      } catch (error) {
        console.error('App: Error checking session:', error);
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

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

  if (isLoading) {
    console.log('App: Loading state');
    return <div>Loading...</div>;
  }

  // Show public routes while loading or no session
  if (loading || !session) {
    console.log('App: Showing public routes', { loading, hasSession: !!session, pathname: window.location.pathname });
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/accept" element={
                <>
                  {console.log('App: Rendering AcceptInvitePage route')}
                  <AcceptInvitePage />
                </>
              } />
              <Route path="/" element={<LandingPage />} />
              <Route path="/pending" element={<PendingPage />} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
              <Route path="/retro2" element={<Retro2Page />} />
              <Route
                path="/*"
                element={<Navigate to="/" replace />}
              />
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
    console.log('App: Rendering admin/approved view', { isAdmin, applicationStatus });
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/accept" element={<AcceptInvitePage />} />
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
  if (applicationStatus === 'pending') {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/*" element={<PendingPage />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // For users with no application or rejected
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pending" element={<PendingPage />} />
            <Route path="/confirmation" element={<ConfirmationPage />} />
            <Route path="/retro2" element={<Retro2Page />} />
            <Route
              path="/*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}