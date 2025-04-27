import React, { useState, useEffect } from 'react';
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
import { supabase } from './lib/supabase';
import { useSession } from './hooks/useSession';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { WhitelistSignupPage } from './pages/WhitelistSignupPage';
import { normalizeToUTCDate } from './utils/dates';
import { AuthCallback } from './components/AuthCallback';
import { MainAppLayout } from './components/MainAppLayout';

// Configure logging early to silence logs in production
configureLogging();

// --- AppRouterLogic Component (Handles routing logic) ---
interface AppRouterLogicProps {
  session: ReturnType<typeof useSession>;
  isWhitelisted: boolean;
}

function AppRouterLogic({ 
  session, 
  isWhitelisted, 
}: AppRouterLogicProps) {
  const location = useLocation();
  const navigate = useNavigate();
  console.log('AppRouterLogic: Render START', { pathname: location.pathname, hasSession: !!session });

  // --- Logged Out State ---
  if (!session) {
    console.log('AppRouterLogic: Rendering PUBLIC routes BLOCK', { pathname: location.pathname });
    return (
      <Routes>
        {/* Routes accessible ONLY when logged OUT */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/accept" element={<AcceptInvitePage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
        <Route path="/auth/callback" element={<AuthCallback />} /> 
        {/* Removed /whitelist-signup, /pending, /confirmation, /retro2 from public */}
        {/* Redirect any other unknown path to the landing page when logged out */}
        <Route path="/*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // --- Logged In State ---
  console.log('AppRouterLogic: Rendering AUTHENTICATED routes BLOCK');
  
  // *** NEW: Handle redirect away from /auth/callback AFTER session is confirmed ***
  if (location.pathname === '/auth/callback') {
    console.log('AppRouterLogic: Authenticated user on /auth/callback, redirecting to / to trigger final routing.');
    return <Navigate to="/" replace />;
  }

  // If we reach here, session is guaranteed to exist AND we are NOT on /auth/callback.
  const user = session.user;
  const metadata = user?.user_metadata;
  
  // ... (keep all your existing checks: isAdminCheck, hasAppliedCheck, etc.) ...
  const isAdminCheck = user?.email === 'andre@thegarden.pt' ||
                  user?.email === 'redis213@gmail.com' ||
                  user?.email === 'dawn@thegarden.pt' ||
                  user?.email === 'simone@thegarden.pt' ||
                  user?.email === 'samjlloa@gmail.com' ||
                  user?.email === 'redis213+testadmin@gmail.com';
  const hasAppliedCheck = metadata?.has_applied === true;
  const isWhitelistedUserCheck = metadata?.is_whitelisted === true; // Check metadata directly
  const hasCompletedWhitelistSignupCheck = metadata?.has_completed_whitelist_signup === true;
  const isApprovedCheck = metadata?.approved === true || metadata?.application_status === 'approved';
  const applicationStatusValue = metadata?.application_status || 'pending';


  console.log(`AppRouterLogic: Evaluating Authenticated Routes for ${user?.email}`, { 
      isAdmin: isAdminCheck, 
      isApproved: isApprovedCheck, 
      // isWhitelistedProp: isWhitelisted, // Prop passed down - Consider removing if metadata is reliable
      isWhitelistedMeta: isWhitelistedUserCheck, // From metadata
      hasCompletedWhitelistSignup: hasCompletedWhitelistSignupCheck, 
      hasApplied: hasAppliedCheck, 
      applicationStatus: applicationStatusValue,
      rawMetadata: metadata // Log the whole metadata object
  });

  // --- Admin Routes --- Wrap elements with MainAppLayout
  if (isAdminCheck) {
    console.log('AppRouterLogic: Rendering Admin Routes with Layout');
    return (
      <Routes>
        {/* Pages outside the main app structure don't need the layout */}
        <Route path="/accept" element={<AcceptInvitePage />} /> 
        <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
        {/* Wrap ConfirmationPage */}
        <Route path="/confirmation" element={<MainAppLayout><ConfirmationPage /></MainAppLayout>} /> 
        {/* Wrap AuthenticatedApp */}
        <Route path="/*" element={<MainAppLayout><AuthenticatedApp /></MainAppLayout>} /> 
      </Routes>
    );
  }

  // Approved users go to the main app
  if (isApprovedCheck) {
     console.log('AppRouterLogic: Rendering Approved User Routes with Layout');
     return (
        <Routes>
          <Route path="/accept" element={<AcceptInvitePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
          {/* Wrap ConfirmationPage */}
          <Route path="/confirmation" element={<MainAppLayout><ConfirmationPage /></MainAppLayout>} />
          {/* Wrap AuthenticatedApp */}
          <Route path="/*" element={<MainAppLayout><AuthenticatedApp /></MainAppLayout>} />
        </Routes>
    );
  }

  // Whitelisted users who NEED to complete signup
  // Use the metadata check primarily.
  if (isWhitelistedUserCheck && !hasCompletedWhitelistSignupCheck) {
    console.log('AppRouterLogic: Rendering Whitelist Signup REQUIRED Routes (No Layout)');
    return (
      <Routes>
        {/* Only allow access to the signup page itself */}
        <Route path="/whitelist-signup" element={<WhitelistSignupPage />} />
        {/* Redirect any other path FOR THIS USER STATE to the signup page */}
        <Route path="/*" element={<Navigate to="/whitelist-signup" replace />} />
      </Routes>
    );
  }

  // Whitelisted users who HAVE completed signup (treat like approved)
  if (isWhitelistedUserCheck && hasCompletedWhitelistSignupCheck) {
    console.log('AppRouterLogic: Rendering Whitelisted User (Completed Signup) Routes with Layout');
    return (
        <Routes>
          <Route path="/accept" element={<AcceptInvitePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
          {/* Wrap ConfirmationPage */}
          <Route path="/confirmation" element={<MainAppLayout><ConfirmationPage /></MainAppLayout>} />
          {/* Wrap AuthenticatedApp */}
          <Route path="/*" element={<MainAppLayout><AuthenticatedApp /></MainAppLayout>} />
        </Routes>
    );
  }
  
  // Users who haven't applied yet are sent to the application flow
  if (!hasAppliedCheck) {
    console.log('AppRouterLogic: Rendering Application Flow Routes (No Layout)');
    return (
      <Routes>
        {/* Define the routes for the application process */}
        <Route path="/retro2" element={<Retro2Page />} /> 
        {/* Assuming /retro2 is the start? Redirect root and others there. */}
        <Route path="/" element={<Navigate to="/retro2" replace />} /> 
        <Route path="/pending" element={<PendingPage />} /> {/* Maybe needed during application? */}
        <Route path="/*" element={<Navigate to="/retro2" replace />} /> 
      </Routes>
    );
  }

  // Default for authenticated users who don't fit other categories 
  // (e.g., applied but pending/rejected, not whitelisted)
  console.log('AppRouterLogic: Rendering Pending/Rejected Routes (No Layout)');
  return (
    <Routes>
      {/* Send them to the pending page */}
      <Route path="/pending" element={<PendingPage status={applicationStatusValue as 'pending' | 'rejected'} />} />
      {/* Redirect root and any other path to pending */}
      <Route path="/" element={<Navigate to="/pending" replace />} /> 
      <Route path="/*" element={<Navigate to="/pending" replace />} />
    </Routes>
  );
}

// --- NEW Component to handle hooks inside Router context ---
// Remove RouteHandler entirely
// function RouteHandler() { ... }

// --- Main App Component (Handles State and Contexts) ---
export default function App() {
  const session = useSession();
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Initial session check effect
  useEffect(() => {
    setIsLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('App: Initial getSession complete', { hasSession: !!session });
    }).catch(error => {
       console.error('App: Error during initial getSession:', error);
    }).finally(() => {
        setIsLoading(false);
    });
  }, []);

  // User status check effect (runs when session changes)
  useEffect(() => {
    let mounted = true;

    const checkUserStatus = async () => {
      if (!session?.user) {
        console.log('App: No user session, skipping status check.');
        setIsWhitelisted(false);
        if (mounted) setIsLoading(false);
        return;
      }
      
      try {
        console.log(`App: Checking user status for ${session.user.email}`);
        const { data: isWhitelistedResult, error: whitelistError } = await supabase
          .rpc('is_whitelisted', { user_email: session.user.email });

        if (whitelistError) {
            console.error('Error checking whitelist status:', whitelistError);
            if (mounted) setIsWhitelisted(false);
        } else {
            console.log('App: Whitelist RPC result:', isWhitelistedResult);
            if (mounted) setIsWhitelisted(!!isWhitelistedResult);
        }

      } catch (err) {
        console.error('Error in checkUserStatus:', err);
        if (mounted) setIsWhitelisted(false); 
      } finally {
        if (mounted) setIsLoading(false);
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
          {/* Render RouteHandler INSIDE Router */}
          {/* <RouteHandler /> */}
          {/* Render AppRouterLogic INSIDE Router */}
          <AppRouterLogic 
            session={session} 
            isWhitelisted={isWhitelisted} 
          />
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}