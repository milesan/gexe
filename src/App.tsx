import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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

// --- AppRouterLogic Component (Handles routing logic) ---
interface AppRouterLogicProps {
  session: ReturnType<typeof useSession>;
  loading: boolean;
  isWhitelisted: boolean;
  showWelcomeModal: boolean;
  handleCloseWelcomeModal: () => void;
}

function AppRouterLogic({ 
  session, 
  loading, 
  isWhitelisted, 
  showWelcomeModal, 
  handleCloseWelcomeModal 
}: AppRouterLogicProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Post-Callback Redirect Logic
  useEffect(() => {
    console.log('AppRouterLogic: Callback Redirect Check', { hasSession: !!session, pathname: location.pathname });
    if (session && location.pathname === '/auth/callback') {
      console.log('AppRouterLogic: Detected session on callback path, redirecting to /...');
      navigate('/', { replace: true });
    }
  }, [session, location, navigate]);

  // Early exit for loading or no session (Public Routes)
  if (loading || !session) {
    console.log('AppRouterLogic: Rendering Public Routes', { loading, hasSession: !!session, pathname: location.pathname });
    return (
      <Routes>
        <Route path="/accept" element={<AcceptInvitePage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
        <Route path="/whitelist-signup" element={<WhitelistSignupPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
        <Route path="/retro2" element={<Retro2Page />} />
        <Route path="/auth/callback" element={<AuthCallback />} /> 
        {/* Simplified AuthCallback route element */}
        <Route path="/*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Authenticated Routes Logic
  const user = session.user;
  const metadata = user?.user_metadata;
  
  const isAdmin = user?.email === 'andre@thegarden.pt' ||
                  user?.email === 'redis213@gmail.com' ||
                  user?.email === 'dawn@thegarden.pt' ||
                  user?.email === 'simone@thegarden.pt' ||
                  user?.email === 'samjlloa@gmail.com' ||
                  user?.email === 'redis213+testadmin@gmail.com';
  const hasApplied = metadata?.has_applied === true;
  const isWhitelistedUser = metadata?.is_whitelisted === true;
  const hasCompletedWhitelistSignup = metadata?.has_completed_whitelist_signup === true;
  const isApproved = metadata?.approved === true || metadata?.application_status === 'approved';
  const applicationStatus = metadata?.application_status || 'pending';
  
  console.log(`AppRouterLogic: Evaluating Authenticated Routes for ${user?.email}`, { 
      isAdmin, isApproved, isWhitelisted, isWhitelistedUser, hasCompletedWhitelistSignup, hasApplied, applicationStatus 
  });

  if (isAdmin) {
    console.log('AppRouterLogic: Rendering Admin Routes');
    return (
      <Routes>
        <Route path="/accept" element={<AcceptInvitePage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
        <Route path="/*" element={<AuthenticatedApp />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
      </Routes>
    );
  }

  if (isApproved) {
     console.log('AppRouterLogic: Rendering Approved User Routes');
     return (
      <>
        <WhitelistWelcomeModal isOpen={showWelcomeModal} onClose={handleCloseWelcomeModal} />
        <Routes>
          <Route path="/accept" element={<AcceptInvitePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
          <Route path="/*" element={<AuthenticatedApp />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
        </Routes>
      </>
    );
  }

  if ((isWhitelisted || isWhitelistedUser) && !hasCompletedWhitelistSignup) {
    console.log('AppRouterLogic: Rendering Whitelist Signup Redirect');
    return (
      <Routes>
        <Route path="/whitelist-signup" element={<WhitelistSignupPage />} />
        <Route path="/*" element={<Navigate to="/whitelist-signup" replace />} />
      </Routes>
    );
  }

  if ((isWhitelisted || isWhitelistedUser) && hasCompletedWhitelistSignup) {
    console.log('AppRouterLogic: Rendering Whitelisted User Routes');
    return (
      <>
        <WhitelistWelcomeModal isOpen={showWelcomeModal} onClose={handleCloseWelcomeModal} />
        <Routes>
          <Route path="/accept" element={<AcceptInvitePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
          <Route path="/*" element={<AuthenticatedApp />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
        </Routes>
      </>
    );
  }

  if (!hasApplied) {
    console.log('AppRouterLogic: Rendering Application Flow Routes');
    return (
      <Routes>
        <Route path="/" element={<Retro2Page />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
        <Route path="/retro2" element={<Retro2Page />} />
        <Route path="/*" element={<Navigate to="/retro2" replace />} />
      </Routes>
    );
  }

  // Default for applied but not approved/whitelisted/admin
  console.log('AppRouterLogic: Rendering Pending/Rejected Routes');
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pending" replace />} />
      <Route path="/pending" element={<PendingPage status={applicationStatus as 'pending' | 'rejected'} />} />
      <Route path="/confirmation" element={<ConfirmationPage />} />
      <Route path="/retro2" element={<Retro2Page />} />
      <Route path="/*" element={<Navigate to="/pending" replace />} />
    </Routes>
  );
}

// --- Main App Component (Handles State and Contexts) ---
export default function App() {
  const session = useSession();
  const [loading, setLoading] = useState(true); 
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Initial session check effect
  useEffect(() => {
    setIsLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('App: Initial getSession complete', { hasSession: !!session });
      setIsLoading(false);
    }).catch(error => {
       console.error('App: Error during initial getSession:', error);
       setIsLoading(false);
    });
  }, []);

  // User status check effect (runs when session changes)
  useEffect(() => {
    let mounted = true;
    // setLoading(true); // REMOVED: Don't set loading=true on every session check
    
    const checkUserStatus = async () => {
      if (!session?.user) {
        console.log('App: No user session, skipping status check.');
        setIsWhitelisted(false);
        if (mounted) setLoading(false);
        return;
      }
      
      try {
        console.log(`App: Checking user status for ${session.user.email}`);
        const { data: isWhitelistedResult, error: whitelistError } = await supabase
          .rpc('is_whitelisted', { user_email: session.user.email });

        if (whitelistError) {
            console.error('Error checking whitelist status:', whitelistError);
            setIsWhitelisted(false);
        } else {
            console.log('App: Whitelist RPC result:', isWhitelistedResult);
            if (mounted) setIsWhitelisted(!!isWhitelistedResult);
        }
        
        const metadata = session.user.user_metadata;
        const hasSeenWelcome = metadata?.has_seen_welcome === true;
        const isApproved = metadata?.approved === true || metadata?.application_status === 'approved';

        console.log('App: User status check results:', { isWhitelisted: !!isWhitelistedResult, isApproved, hasSeenWelcome });

        if (isApproved && !hasSeenWelcome) {
          if (mounted) setShowWelcomeModal(true);
        } else {
          if (mounted) setShowWelcomeModal(false);
        }

      } catch (err) {
        console.error('Error in checkUserStatus:', err);
        if (mounted) setIsWhitelisted(false); 
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkUserStatus();

    return () => { mounted = false; };
  }, [session]);

  // Screen width effect
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    console.log(`App: Initial screen width ${window.innerWidth}px. Resize listener added.`);
    return () => {
      window.removeEventListener('resize', handleResize);
      console.log('App: Resize listener removed.');
    };
  }, []);

  const handleCloseWelcomeModal = async () => {
    setShowWelcomeModal(false);
    if (session?.user) {
      try {
        const { error } = await supabase.auth.updateUser({ data: { has_seen_welcome: true } });
        if (error) console.error('Error updating user metadata:', error);
        else console.log('Successfully updated has_seen_welcome to true');
      } catch (err) {
        console.error('Error in handleCloseWelcomeModal:', err);
      }
    }
  };

  // --- Screen Width Check --- (can remain here)
  /*
  if (screenWidth < 800) { ... }
  */

  // Render Loading, or Router + Logic Component
  if (isLoading) {
    console.log('App: Initial loading state (isLoading=true)');
    return <div className="text-stone-600 font-mono">Loading...</div>;
  }

  console.log('App: Rendering Router and AppRouterLogic');
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <AppRouterLogic 
            session={session} 
            loading={loading} // Pass the loading state related to session/status checks
            isWhitelisted={isWhitelisted} 
            showWelcomeModal={showWelcomeModal} 
            handleCloseWelcomeModal={handleCloseWelcomeModal} 
          />
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}