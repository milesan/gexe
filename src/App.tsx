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
    // Handle auth callback from URL
    const handleAuthCallback = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          console.log('App: Setting session from URL tokens');
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          // Remove the hash to clean up the URL
          window.location.hash = '';
        }
      }
    };

    handleAuthCallback();
  }, []);

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

        // Get user metadata and check whitelist status
        const userMetadata = user?.user_metadata || {};
        const { data: whitelistStatus } = await supabase.rpc('get_whitelist_status');
        
        // If whitelisted but metadata doesn't show it, refresh the page to get updated metadata
        if (whitelistStatus && !userMetadata.is_whitelisted) {
          window.location.reload();
          return;
        }

        setMetadata({
          ...userMetadata,
          is_whitelisted: whitelistStatus
        });
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
              <Route path="/accept-invite" element={
                <>
                  {console.log('App: Rendering AcceptInvitePage route for whitelist')}
                  <AcceptInvitePage isWhitelist={true} />
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
  console.log('App: Checking whitelist status:', { metadata, isWhitelisted: metadata?.is_whitelisted });
  const isWhitelisted = metadata?.is_whitelisted === true;

  // If user is admin, whitelisted, or has an approved application, show full app
  if (isAdmin || isWhitelisted || applicationStatus === 'approved') {
    console.log('App: Rendering admin/approved/whitelisted view', { isAdmin, isWhitelisted, applicationStatus });
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/accept" element={<AcceptInvitePage />} />
              <Route path="/accept-invite" element={
                <>
                  {console.log('App: Rendering AcceptInvitePage route for whitelist')}
                  <AcceptInvitePage isWhitelist={true} />
                </>
              } />
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