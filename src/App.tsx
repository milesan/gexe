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
import { AuthCallback } from './components/AuthCallback';

// Configure logging early to silence logs in production
configureLogging();

export default function App() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Effect to track screen width
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
      console.log(`App: Screen resized to ${window.innerWidth}px`);
    };

    window.addEventListener('resize', handleResize);
    console.log(`App: Initial screen width ${screenWidth}px. Resize listener added.`);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      console.log('App: Resize listener removed.');
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

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

  // --- Screen Width Check ---
  /*
  if (screenWidth < 800) {
    console.log('App: Screen width < 800px, showing mobile message.');
    return (
      <div 
        className="min-h-screen flex items-center justify-center text-center p-4 font-mono"
        style={{
          backgroundImage: `linear-gradient(rgba(31, 41, 55, 0.95), rgba(31, 41, 55, 0.95)), url(https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//fern-background-tiling-2.png)`,
          backgroundSize: 'auto',
          backgroundRepeat: 'repeat',
          backgroundPosition: 'center',
        }}
      >
        <div>
          <p className="text-2xl text-[#bf884d] font-['VT323'] mb-4 animate-pulse">The Garden Awaits...</p>
          <p className="text-gray-300 mb-2">Please view on a larger screen for the full experience.</p>
          <p className="text-gray-400 text-sm">A dedicated mobile path is currently cultivating.</p>
        </div>
      </div>
    );
  }
  */
  // --- End Screen Width Check ---

  if (isLoading) {
    console.log('App: Loading state');
    return <div className="text-stone-600 font-mono">Loading...</div>;
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
                path="/auth/callback"
                element={
                  <AuthCallback />
                }
              />
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
    session?.user?.email === 'samjlloa@gmail.com' ||
    session?.user?.email === 'redis213+testadmin@gmail.com';
  const hasApplied = session?.user?.user_metadata?.has_applied === true;
  const isWhitelistedUser = session?.user?.user_metadata?.is_whitelisted === true;
  const hasCompletedWhitelistSignup = session?.user?.user_metadata?.has_completed_whitelist_signup === true;
  const isApproved = session?.user?.user_metadata?.approved === true || 
                     session?.user?.user_metadata?.application_status === 'approved';
  // Read application status, default to 'pending' if not present
  const applicationStatus = session?.user?.user_metadata?.application_status || 'pending';
  
  console.log('App: Checking user status:', { 
    isWhitelisted, 
    isWhitelistedUser,
    isApproved,
    hasApplied, 
    hasCompletedWhitelistSignup,
    isAdmin,
    applicationStatus, // Log the status we read
    metadata: session?.user?.user_metadata
  });

  // --- Decision Logs Start ---
  console.log(`App: Evaluating routing conditions for user ${session?.user?.email}`, {
    isAdmin,
    isApproved,
    isWhitelisted,
    isWhitelistedUser,
    hasCompletedWhitelistSignup,
    hasApplied,
    applicationStatus,
  });

  // If user is admin, show full app immediately
  console.log("App: Checking isAdmin...");
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
  console.log("App: Checking isApproved...");
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
  console.log("App: Checking isWhitelisted/isWhitelistedUser AND !hasCompletedWhitelistSignup...");
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
  console.log("App: Checking isWhitelisted/isWhitelistedUser AND hasCompletedWhitelistSignup...");
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
  console.log("App: Checking !hasApplied...");
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
  console.log("App: Entering final block for applied but not approved/whitelisted/admin users.");
  console.log('App: User has applied but is not whitelisted or admin, showing pending/rejected status');
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/pending" replace />} />
            <Route path="/pending" element={<PendingPage status={applicationStatus as 'pending' | 'rejected'} />} />
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