import React, { useState, useEffect, useCallback } from 'react';
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
import { WhitelistWelcomeModal } from './components/WhitelistWelcomeModal';

// Configure logging early to silence logs in production
configureLogging();

// --- AppRouterLogic Component (Handles routing logic) ---
interface AppRouterLogicProps {
  session: ReturnType<typeof useSession>['session'];
  isWhitelisted: boolean | null; // Can be null initially
  needsWelcomeCheck: boolean | null; // Can be null initially
  hasApplicationRecord: boolean | null; // Add prop
}

function AppRouterLogic({ 
  session, 
  isWhitelisted,
  needsWelcomeCheck,
  hasApplicationRecord, // Receive prop
}: AppRouterLogicProps) {
  const location = useLocation();
  const navigate = useNavigate();
  // Log received props for debugging routing issues
  console.log('AppRouterLogic: Render START', { 
    pathname: location.pathname, 
    hasSession: !!session, 
    isWhitelistedProp: isWhitelisted, //test
    needsWelcomeCheckProp: needsWelcomeCheck, 
    hasApplicationRecordProp: hasApplicationRecord // Log the new prop
  });

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
        {/* Redirect any other unknown path to the landing page when logged out */}
        <Route path="/*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // --- Logged In State ---
  console.log('AppRouterLogic: Rendering AUTHENTICATED routes BLOCK');
  
  // Handle redirect away from /auth/callback AFTER session is confirmed
  if (location.pathname === '/auth/callback') {
    console.log('AppRouterLogic: Authenticated user on /auth/callback, redirecting to / to trigger final routing.');
    return <Navigate to="/" replace />;
  }

  // If we reach here, session is guaranteed to exist AND we are NOT on /auth/callback.
  const user = session.user;
  const metadata = user?.user_metadata; // Keep metadata for OTHER checks (admin, approved, etc.)
  
  // Keep checks that STILL rely on metadata or application status
  const isAdminCheck = user?.email === 'andre@thegarden.pt' ||
                  user?.email === 'redis213@gmail.com' ||
                  user?.email === 'dawn@thegarden.pt' ||
                  user?.email === 'simone@thegarden.pt' ||
                  user?.email === 'samjlloa@gmail.com' ||
                  user?.email === 'redis213+testadmin@gmail.com';
  const hasAppliedCheck = metadata?.has_applied === true;
  const isApprovedCheck = metadata?.approved === true || metadata?.application_status === 'approved';
  const applicationStatusValue = metadata?.application_status || 'pending';

  // Use props for whitelist/welcome status passed down from App.tsx
  console.log(`AppRouterLogic: Evaluating Authenticated Routes for ${user?.email}`, { 
      isAdmin: isAdminCheck, 
      isApproved: isApprovedCheck, 
      isWhitelisted: isWhitelisted, // FROM PROP
      needsWelcomeCheck: needsWelcomeCheck, // FROM PROP
      hasApplied: hasAppliedCheck, // From metadata (still used?)
      applicationStatus: applicationStatusValue, // From metadata (still used?)
      hasApplicationRecord: hasApplicationRecord, // FROM PROP
      rawMetadata: metadata 
  });

  // --- Admin Routes ---
  if (isAdminCheck) {
    console.log('AppRouterLogic: Rendering Admin Routes with Layout');
    return (
      <Routes>
        <Route path="/accept" element={<AcceptInvitePage />} /> 
        <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
        <Route path="/confirmation" element={<MainAppLayout><ConfirmationPage /></MainAppLayout>} /> 
        <Route path="/*" element={<MainAppLayout><AuthenticatedApp /></MainAppLayout>} /> 
      </Routes>
    );
  }

  // --- Approved User Routes ---
  if (isApprovedCheck) {
     console.log('AppRouterLogic: Rendering Approved User Routes with Layout');
     return (
        <Routes>
          <Route path="/accept" element={<AcceptInvitePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage isWhitelist={true} />} />
          <Route path="/confirmation" element={<MainAppLayout><ConfirmationPage /></MainAppLayout>} />
          <Route path="/*" element={<MainAppLayout><AuthenticatedApp /></MainAppLayout>} />
        </Routes>
    );
  }

  // --- NEW: Whitelisted User NEEDS Signup ---
  // (isWhitelisted=true, hasApplicationRecord=false) -> Force signup page
  if (isWhitelisted === true && hasApplicationRecord === false) {
    console.log('AppRouterLogic: Whitelisted user MISSING application record. Forcing /whitelist-signup.');
    return (
      <Routes>
        <Route path="/whitelist-signup" element={<WhitelistSignupPage />} />
        {/* Redirect root and any other path to the signup page */}
        <Route path="/" element={<Navigate to="/whitelist-signup" replace />} />
        <Route path="/*" element={<Navigate to="/whitelist-signup" replace />} />
      </Routes>
    );
  }
  
  // --- Non-Whitelisted User Routing ---
  // (These apply only if isWhitelisted is false or null)

  // Users who haven't applied yet
  if (!hasAppliedCheck) {
    console.log('AppRouterLogic: User has not applied. Forcing /retro2.');
    return (
      <Routes>
        <Route path="/retro2" element={<Retro2Page />} /> 
        <Route path="/" element={<Navigate to="/retro2" replace />} /> 
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/*" element={<Navigate to="/retro2" replace />} /> 
      </Routes>
    );
  }

  // Default: Applied but pending/rejected (and not whitelisted)
  console.log('AppRouterLogic: Default routing to /pending.');
  return (
    <Routes>
      <Route path="/pending" element={<PendingPage status={applicationStatusValue as 'pending' | 'rejected'} />} />
      <Route path="/" element={<Navigate to="/pending" replace />} /> 
      <Route path="/*" element={<Navigate to="/pending" replace />} />
    </Routes>
  );
}

// --- Main App Component (Handles State and Contexts) ---
export default function App() {
  const { session, isLoading: sessionLoading } = useSession();
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  
  // --- NEW State for Whitelist/Welcome Status ---
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [needsWelcomeCheckResult, setNeedsWelcomeCheckResult] = useState<boolean | null>(null); // Raw result from RPC
  const [showWelcomeModalState, setShowWelcomeModalState] = useState<boolean>(false); // Controls modal visibility *after* loading
  const [isLoadingWhitelistStatus, setIsLoadingWhitelistStatus] = useState<boolean>(true); // Loading state for our RPC calls
  // --- NEW State for Application Record Status ---
  const [hasApplicationRecord, setHasApplicationRecord] = useState<boolean | null>(null);
  const [isLoadingApplicationStatus, setIsLoadingApplicationStatus] = useState<boolean>(true);

  // Extract user ID for stable dependency
  const userId = session?.user?.id;
  const userEmail = session?.user?.email; // Extract email for RPC calls

  // --- Whitelist/Welcome Status Check Effect ---
  useEffect(() => {
    // Only run if session is loaded and we have a user email AND id
    if (!sessionLoading && userEmail && userId) {
      console.log(`App: Session loaded for ${userEmail}. Checking whitelist/welcome/application status...`);
      // Start loading for both checks
      setIsLoadingWhitelistStatus(true); 
      setIsLoadingApplicationStatus(true); 
      let mounted = true;

      const checkStatus = async () => {
        try {
          // Log the userId being used for the check
          console.log(`App: checkStatus - Preparing checks for userId: ${userId}`);
          
          // Call checks in parallel: is_whitelisted, check_whitelist_welcome, and application existence
          const [wlResult, welcomeResult, appCheckResult] = await Promise.all([
            supabase.rpc('is_whitelisted', { user_email: userEmail }),
            supabase.rpc('check_whitelist_welcome', { p_email: userEmail }), // Ensure param name matches SQL function
            supabase.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId) // Check if record exists for user_id
          ]);

          if (!mounted) return; // Component unmounted during async call

          // --- Process is_whitelisted result ---
          if (wlResult.error) {
            console.error('Error checking whitelist status:', wlResult.error);
            setIsWhitelisted(false); // Assume not whitelisted on error
          } else {
            console.log('App: is_whitelisted RPC result:', wlResult.data);
            setIsWhitelisted(!!wlResult.data);
          }
          setIsLoadingWhitelistStatus(false); // Whitelist check done

          // --- Process check_whitelist_welcome result ---
          if (welcomeResult.error) {
            console.error('Error checking welcome status:', welcomeResult.error);
            setNeedsWelcomeCheckResult(false); // Assume welcome not needed on error
          } else {
            console.log('App: check_whitelist_welcome RPC result:', welcomeResult.data);
            // check_whitelist_welcome returns true if user needs welcome (whitelisted AND has_seen_welcome=false)
            setNeedsWelcomeCheckResult(!!welcomeResult.data); 
          }
          // Note: Welcome check loading is implicitly handled by the overall flow, no separate state needed

          // --- Process application existence check result ---
          // Log the raw result from the application check query
          console.log('App: checkStatus - Raw appCheckResult:', JSON.stringify(appCheckResult)); 
          
          if (appCheckResult.error) {
             console.error('Error checking application existence:', appCheckResult.error);
             setHasApplicationRecord(false); // Assume no record on error
          } else {
             console.log('App: Application existence check successful, count:', appCheckResult.count);
             // Calculate the boolean result
             const doesRecordExist = appCheckResult.count !== null && appCheckResult.count > 0;
             // Log the calculated boolean before setting state
             console.log(`App: checkStatus - Calculated doesRecordExist: ${doesRecordExist}`);
             setHasApplicationRecord(doesRecordExist); 
          }
          setIsLoadingApplicationStatus(false); // Application check done

        } catch (err) {
          console.error('Error in checkStatus parallel calls:', err);
          if (mounted) {
            setIsWhitelisted(false);
            setNeedsWelcomeCheckResult(false);
            setHasApplicationRecord(false);
            setIsLoadingWhitelistStatus(false); // Ensure loading stops on error
            setIsLoadingApplicationStatus(false);
          }
        } finally {
          if (mounted) {
            // Combine loading state updates here if needed, though individual setters above work
            console.log('App: Finished checking all statuses.');
          }
        }
      };

      checkStatus();

      return () => { 
        mounted = false; 
        console.log('App: Unmounting status check effect or user changed.')
      };
    // If session loaded but no user/id, reset all status and loading states
    } else if (!sessionLoading && (!userEmail || !userId)) {
      console.log('App: Session loaded, but no user email/id found. Resetting status.');
      setIsWhitelisted(null);
      setNeedsWelcomeCheckResult(null);
      setHasApplicationRecord(null);
      setIsLoadingWhitelistStatus(false); 
      setIsLoadingApplicationStatus(false); 
    } else {
       console.log('App: Waiting for session to load...');
       // Reset status while session is loading
       setIsWhitelisted(null);
       setNeedsWelcomeCheckResult(null);
       setHasApplicationRecord(null);
       setIsLoadingWhitelistStatus(true);
       setIsLoadingApplicationStatus(true);
    }
  // Depend on sessionLoading, userEmail, and userId
  }, [sessionLoading, userEmail, userId]); 

  // --- Screen Width Effect --- (Keep as is)
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    console.log(`App: Initial screen width ${window.innerWidth}px. Resize listener added.`);
    return () => {
      window.removeEventListener('resize', handleResize);
      console.log('App: Resize listener removed.');
    };
  }, []);

  // --- Combined Loading Logic ---
  // Wait for session AND the whitelist status check AND application status check (if a user exists)
  const isLoading = sessionLoading || (!!userEmail && (isLoadingWhitelistStatus || isLoadingApplicationStatus));

  if (isLoading) { 
    console.log('App: Loading...', { sessionLoading, isLoadingWhitelistStatus, isLoadingApplicationStatus }); 
    return <div className="text-stone-600 font-mono">Loading...</div>;
  }

  // --- Render App ---
  console.log('App: Rendering AppContent with state:', { 
    isLoading, 
    session: !!session, 
    isWhitelisted, 
    needsWelcomeCheckResult, 
    hasApplicationRecord, 
    showWelcomeModalState 
  });

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {/* Router needs to be here for hooks in App */} 
        <Router> 
           {/* Content that uses hooks needs to be inside Router */}
           <AppContent 
              session={session} 
              isLoading={isLoading}
              isWhitelisted={isWhitelisted}
              needsWelcomeCheckResult={needsWelcomeCheckResult}
              hasApplicationRecord={hasApplicationRecord}
              setNeedsWelcomeCheckResult={setNeedsWelcomeCheckResult}
              showWelcomeModalState={showWelcomeModalState}
              setShowWelcomeModalState={setShowWelcomeModalState}
           />
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// --- NEW Inner Component to contain logic using router hooks ---
interface AppContentProps {
  session: ReturnType<typeof useSession>['session'];
  isLoading: boolean;
  isWhitelisted: boolean | null;
  needsWelcomeCheckResult: boolean | null;
  hasApplicationRecord: boolean | null;
  setNeedsWelcomeCheckResult: React.Dispatch<React.SetStateAction<boolean | null>>;
  showWelcomeModalState: boolean;
  setShowWelcomeModalState: React.Dispatch<React.SetStateAction<boolean>>;
}

function AppContent({ 
  session, 
  isLoading, 
  isWhitelisted, 
  needsWelcomeCheckResult, 
  hasApplicationRecord,
  setNeedsWelcomeCheckResult,
  showWelcomeModalState, 
  setShowWelcomeModalState 
}: AppContentProps) {
  
  // Hooks are called inside component wrapped by Router
  const location = useLocation(); 
  const navigate = useNavigate();
  const userEmail = session?.user?.email; // Get email from session prop

  // --- Effect to decide when to show the Welcome Modal ---
  useEffect(() => {
    // Log the state values checked by this effect right when it runs
    console.log('AppContent Welcome Modal Effect Check:', { 
      isLoading, 
      isWhitelisted, 
      hasApplicationRecord, 
      needsWelcomeCheckResult 
    });
    
    // Use props for state checks
    if (!isLoading && 
        isWhitelisted === true && 
        hasApplicationRecord === true &&
        needsWelcomeCheckResult === true) {
      console.log('AppContent: Conditions met to show Welcome Modal.');
      // Only set to true if it's currently false to avoid re-renders
      if (!showWelcomeModalState) { 
          setShowWelcomeModalState(true);
      }
    } else {
      // Hide modal if conditions aren't met OR if modal is already hidden/closed
      if (showWelcomeModalState) { 
           console.log('AppContent: Conditions no longer met, hiding Welcome Modal.');
           setShowWelcomeModalState(false);
      }
    }
    // Depend on status props, loading state, and modal state/setter
  }, [isLoading, isWhitelisted, hasApplicationRecord, needsWelcomeCheckResult, showWelcomeModalState, setShowWelcomeModalState]);

  // --- Welcome Modal Close Handler ---
  // (Moved into AppContent - needs navigate and setters)
  const handleWelcomeModalClose = useCallback(async () => {
    console.log('AppContent: Closing Welcome Modal and marking as seen.');
    setShowWelcomeModalState(false); // Use setter prop

    if (userEmail) {
      try {
        console.log(`AppContent: Calling mark_whitelist_welcome_seen RPC for ${userEmail}...`);
        const { error } = await supabase.rpc('mark_whitelist_welcome_seen', { p_email: userEmail }); 
        if (error) {
          console.error('Error calling mark_whitelist_welcome_seen:', error);
          navigate('/', { replace: true }); // Navigate away even if RPC failed
        } else {
          console.log('AppContent: Successfully marked welcome as seen via RPC.');
          setNeedsWelcomeCheckResult(false); // Use setter prop
          navigate('/', { replace: true }); // Navigate to root
        }
      } catch (err) {
        console.error('Exception calling mark_whitelist_welcome_seen:', err);
        navigate('/', { replace: true }); // Navigate away on exception
      }
    } else {
       console.warn('AppContent: Cannot mark welcome seen, user email not available.');
       navigate('/', { replace: true }); // Still navigate away
    }
  // Depend on navigate and setters passed as props
  }, [userEmail, navigate, setShowWelcomeModalState, setNeedsWelcomeCheckResult]); 

  // --- Rendering Logic ---
  if (isLoading) { 
    console.log('AppContent: Loading...'); 
    return <div className="text-stone-600 font-mono">Loading...</div>;
  }

  console.log('AppContent: Rendering Router Logic and Modal');
  
  return (
    <>
      <WhitelistWelcomeModal 
        isOpen={showWelcomeModalState} 
        onClose={handleWelcomeModalClose} // Pass the locally defined handler
      />
      <AppRouterLogic 
          session={session} 
          isWhitelisted={isWhitelisted}
          needsWelcomeCheck={needsWelcomeCheckResult}
          hasApplicationRecord={hasApplicationRecord}
      />
    </>
  );
}