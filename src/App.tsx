import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, Navigate } from 'react-router-dom';
// Import and configure logging
import { configureLogging } from './utils/logging';
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
import { WhitelistSignupPage } from './pages/WhitelistSignupPage';
import { normalizeToUTCDate } from './utils/dates';
import { WhitelistWelcomeModal } from './components/WhitelistWelcomeModal';

// Configure logging early to silence logs in production
configureLogging();

export default function App() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => normalizeToUTCDate(new Date()));
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

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

        const { data: isWhitelisted, error: whitelistError } = await supabase
          .rpc('is_whitelisted', { user_email: session.user.email })
        console.log('User email:', session.user.email)
        
        // Check if the user has completed whitelist signup
        const hasCompletedSignup = session.user.user_metadata?.has_completed_whitelist_signup === true;
        const hasSeenWelcome = session.user.user_metadata?.has_seen_welcome === true;
        const isApproved = session.user.user_metadata?.approved === true || 
                          session.user.user_metadata?.application_status === 'approved';
        
        console.log('App: User whitelist status:', { 
          isWhitelisted, 
          hasCompletedSignup,
          isApproved,
          hasSeenWelcome,
          metadata: session.user.user_metadata 
        });
        
        // Show welcome modal for approved users who haven't seen it yet
        if (isApproved && !hasSeenWelcome) {
          setShowWelcomeModal(true);
        }
        
        setIsWhitelisted(!!isWhitelisted || isApproved);
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

  const handleCloseWelcomeModal = async () => {
    setShowWelcomeModal(false);
    
    // Update user metadata to mark welcome modal as seen
    if (session?.user) {
      try {
        const { error } = await supabase.auth.updateUser({
          data: { has_seen_welcome: true }
        });
        
        if (error) {
          console.error('Error updating user metadata:', error);
        } else {
          console.log('Successfully updated has_seen_welcome to true');
        }
      } catch (err) {
        console.error('Error in handleCloseWelcomeModal:', err);
      }
    }
  };

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
              <Route path="/accept" element={<AcceptInvitePage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
              <Route path="/whitelist-signup" element={<WhitelistSignupPage />} />
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
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' ||
    session?.user?.email === 'redis213@gmail.com' ||
    session?.user?.email === 'dawn@thegarden.pt' ||
    session?.user?.email === 'simone@thegarden.pt' ||
    session?.user?.email === 'samjlloa@gmail.com';
  const hasApplied = session?.user?.user_metadata?.has_applied === true;
  const isWhitelistedUser = session?.user?.user_metadata?.is_whitelisted === true;
  const hasCompletedWhitelistSignup = session?.user?.user_metadata?.has_completed_whitelist_signup === true;
  const isApproved = session?.user?.user_metadata?.approved === true || 
                     session?.user?.user_metadata?.application_status === 'approved';
  
  console.log('App: Checking user status:', { 
    isWhitelisted, 
    isWhitelistedUser,
    isApproved,
    hasApplied, 
    hasCompletedWhitelistSignup,
    isAdmin,
    metadata: session?.user?.user_metadata
  });

  // If user is admin, show full app immediately
  if (isAdmin) {
    console.log('App: User is admin, showing full app');
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/accept" element={<AcceptInvitePage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
              <Route path="/*" element={<AuthenticatedApp />} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // If user is approved, treat them as whitelisted
  if (isApproved) {
    console.log('App: User is approved, treating as whitelisted');
    
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <WhitelistWelcomeModal isOpen={showWelcomeModal} onClose={handleCloseWelcomeModal} />
            <Routes>
              <Route path="/accept" element={<AcceptInvitePage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
              <Route path="/*" element={<AuthenticatedApp />} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // If user is whitelisted but hasn't completed signup, show signup page
  if ((isWhitelisted || isWhitelistedUser) && !hasCompletedWhitelistSignup) {
    console.log('App: Showing whitelist signup page');
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/whitelist-signup" element={<WhitelistSignupPage />} />
              <Route path="/*" element={<Navigate to="/whitelist-signup" replace />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // If user is whitelisted and has completed signup, show full app
  if ((isWhitelisted || isWhitelistedUser) && hasCompletedWhitelistSignup) {
    console.log('App: Rendering whitelisted view');
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <WhitelistWelcomeModal isOpen={showWelcomeModal} onClose={handleCloseWelcomeModal} />
            <Routes>
              <Route path="/accept" element={<AcceptInvitePage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
              <Route path="/*" element={<AuthenticatedApp />} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // For users with no application or rejected
  if (!hasApplied) {
    console.log('App: User has not applied yet, showing application flow');
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Retro2Page />} />
              <Route path="/pending" element={<PendingPage />} />
              <Route path="/confirmation" element={<ConfirmationPage />} />
              <Route path="/retro2" element={<Retro2Page />} />
              <Route
                path="/*"
                element={<Navigate to="/retro2" replace />}
              />
            </Routes>
          </Router>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // For users who have applied but aren't whitelisted or admin
  console.log('App: User has applied but is not whitelisted or admin, showing pending status');
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/pending" replace />} />
            <Route path="/pending" element={<PendingPage />} />
            <Route path="/confirmation" element={<ConfirmationPage />} />
            <Route path="/retro2" element={<Retro2Page />} />
            <Route
              path="/*"
              element={<Navigate to="/pending" replace />}
            />
          </Routes>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}