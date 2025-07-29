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
import { BugReportFAB } from './components/BugReportFAB';
import { useUserPermissions } from './hooks/useUserPermissions';

// Configure logging early to enable debugging logs
configureLogging(false, true);  // Force enable logging for debugging

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
  
  // Use the proper hook instead of sync function
  const { isAdmin: isAdminCheck, isLoading: permissionsLoading } = useUserPermissions(session);
  


  // --- Logged Out State ---
  if (!session) {
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

  // Show loading while permissions are being checked
  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  // --- Logged In State ---
  
  // Handle redirect away from /auth/callback AFTER session is confirmed
  if (location.pathname === '/auth/callback') {
    return <Navigate to="/" replace />;
  }

  // If we reach here, session is guaranteed to exist AND we are NOT on /auth/callback.
  const user = session.user;
  const metadata = user?.user_metadata; // Keep metadata for OTHER checks (admin, approved, etc.)
  
  // Keep checks that STILL rely on metadata or application status
  const hasAppliedCheck = metadata?.has_applied === true;
  const isApprovedCheck = metadata?.approved === true || metadata?.application_status === 'approved';
  const applicationStatusValue = metadata?.application_status || 'pending';



  // --- Admin Routes ---
  if (isAdminCheck) {
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
    console.log('AppRouterLogic: User has not applied. Routing to application flow.');
    return (
      <Routes>
        <Route path="/retro2" element={<Retro2Page />} />
        <Route path="/" element={<Retro2Page />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/*" element={<Retro2Page />} />
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
  const [isLoadingWhitelistStatus, setIsLoadingWhitelistStatus] = useState<boolean>(true); // Loading state for our RPC calls
  // --- NEW State for Application Record Status ---
  const [hasApplicationRecord, setHasApplicationRecord] = useState<boolean | null>(null);
  const [isLoadingApplicationStatus, setIsLoadingApplicationStatus] = useState<boolean>(true);

  // Extract user ID for stable dependency
  const userId = session?.user?.id;
  const userEmail = session?.user?.email; // Extract email for RPC calls

  // --- Whitelist/Welcome Status Check Effect ---
  useEffect(() => {
    console.log('App: Whitelist status check effect triggered', { 
      sessionLoading, 
      userEmail, 
      userId,
      hasUser: !!(userEmail && userId)
    });

    // Only run if session is loaded and we have a user email AND id
    if (!sessionLoading && userEmail && userId) {
      console.log('App: Starting whitelist status check for user', { userEmail, userId });
      // Start loading for the combined check
      setIsLoadingWhitelistStatus(true); 
      setIsLoadingApplicationStatus(true); // We can keep this or use a single new loading state
      let mounted = true;

      const checkCombinedStatus = async () => {
        try {
          console.log('App: Calling get_user_app_entry_status_v2 RPC', { userId, userEmail });
          const { data: statusData, error: rpcError } = await supabase.rpc('get_user_app_entry_status_v2', {
            p_user_id: userId,
            p_email: userEmail
          });

          if (!mounted) return; // Component unmounted during async call

          if (rpcError) {
            console.error('App: Error calling get_user_app_entry_status_v2 RPC:', rpcError);
            setIsWhitelisted(false);
            setNeedsWelcomeCheckResult(false);
            setHasApplicationRecord(false);
          } else if (statusData) {
            console.log('App: RPC returned status data', { 
              isWhitelisted: statusData.is_whitelisted,
              needsWelcome: statusData.needs_welcome,
              hasApplicationRecord: statusData.has_application_record
            });
            setIsWhitelisted(statusData.is_whitelisted);
            setNeedsWelcomeCheckResult(statusData.needs_welcome); // Use the 'needs_welcome' field
            setHasApplicationRecord(statusData.has_application_record);
          } else {
            // Should not happen if RPCError is not set, but good to handle
            console.warn('App: get_user_app_entry_status_v2 RPC returned no data and no error.');
            setIsWhitelisted(false);
            setNeedsWelcomeCheckResult(false);
            setHasApplicationRecord(false);
          }
        } catch (err) {
          console.error('App: Exception during get_user_app_entry_status_v2 call:', err);
          if (mounted) {
            setIsWhitelisted(false);
            setNeedsWelcomeCheckResult(false);
            setHasApplicationRecord(false);
          }
        } finally {
          if (mounted) {
            console.log('App: Setting loading states to false');
            setIsLoadingWhitelistStatus(false); 
            setIsLoadingApplicationStatus(false);
          }
        }
      };

      checkCombinedStatus();

      return () => { 
        mounted = false; 
      };
    // If session loaded but no user/id, reset all status and loading states
    } else if (!sessionLoading && (!userEmail || !userId)) {
      console.log('App: No user data available, resetting status states');
      setIsWhitelisted(null);
      setNeedsWelcomeCheckResult(null);
      setHasApplicationRecord(null);
      setIsLoadingWhitelistStatus(false); 
      setIsLoadingApplicationStatus(false); 
    } else {
       console.log('App: Session still loading or no user data, resetting status states');
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
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // --- Combined Loading Logic ---
  // Wait for session AND the whitelist status check AND application status check (if a user exists)
  const isLoading = sessionLoading || (!!userEmail && (isLoadingWhitelistStatus || isLoadingApplicationStatus));
  
  console.log('App: Combined loading state', {
    sessionLoading,
    userEmail,
    isLoadingWhitelistStatus,
    isLoadingApplicationStatus,
    isLoading
  });

  if (isLoading) { 

    // --- BEGIN ADDED FUNCTION ---
    const handleSignOut = async () => {
      try {
        // Attempt to sign out globally (invalidate server session)
        const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
        if (globalError) {
          console.warn('[App] Global sign out from loading screen failed or session already invalid:', globalError.message);
        }
      } catch (err) {
        console.error('[App] Unexpected error during global sign out from loading screen:', err);
      }

      try {
        // Always attempt to sign out locally (clear client-side session)
        const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
        if (localError) {
          console.error('[App] Local sign out from loading screen failed:', localError.message);
        }
      } catch (err) {
        console.error('[App] Unexpected error during local sign out from loading screen:', err);
      }
      // Session state will change, leading to re-route or different view
    };
    // --- END ADDED FUNCTION ---

    // --- MODIFIED LOADING SCREEN ---
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-stone-400 font-mono">
        <div className="text-lg mb-4">Loading...</div>
        <button
          onClick={handleSignOut}
          className="mb-8 px-4 py-2 text-sm font-medium rounded-sm border border-stone-600 hover:bg-stone-700 hover:text-stone-200 transition-colors"
        >
          Sign Out
        </button>
        {/* BugReportFAB is positioned fixed, so it doesn't need to be in flow here particularly */}
        <BugReportFAB /> 
      </div>
    );
    // --- END MODIFIED LOADING SCREEN ---
  }

  // --- Render App ---
  console.log('App: Rendering AppContent with state:', { 
    isLoading, 
    session: !!session, 
    isWhitelisted, 
    needsWelcomeCheckResult, 
    hasApplicationRecord, 
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
}

function AppContent({ 
  session, 
  isLoading, 
  isWhitelisted, // This prop will now come from metadata via get_user_app_entry_status_v2
  needsWelcomeCheckResult, // This prop is the crucial 'needs_welcome' from get_user_app_entry_status_v2
  hasApplicationRecord,
  setNeedsWelcomeCheckResult, // This setter is for the parent App.tsx state
}: AppContentProps) {
  
  console.log('AppContent: Component rendered with props', {
    hasSession: !!session,
    isLoading,
    isWhitelisted,
    needsWelcomeCheckResult,
    hasApplicationRecord
  });
  
  const location = useLocation(); 
  const navigate = useNavigate();
  const user = session?.user; // Get user object for easier access to ID and metadata

  const [isWelcomeModalActuallyVisible, setIsWelcomeModalActuallyVisible] = useState<boolean>(false);
  // Renaming for clarity from the previous WhitelistSignupPage.tsx change
  const [triggerWelcomeModalFromNavFlag, setTriggerWelcomeModalFromNavFlag] = useState(false); 
  // Add a flag to track if this is the initial load
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  // Removed triggerWelcomeModalFromAcceptance as it's not the current focus, can be added back if needed

  // Effect to detect navigation from WhitelistSignupPage
  useEffect(() => {
    console.log('AppContent: Navigation state effect triggered', { 
      locationState: location.state,
      pathname: location.pathname,
      hasJustCompletedSignup: location.state?.justCompletedWhitelistSignup,
      fromAcceptanceFlow: location.state?.fromAcceptanceFlow
    });

    // Check for the specific flag we set in WhitelistSignupPage
    if (location.state?.justCompletedWhitelistSignup) {
      console.log('AppContent: Detected navigation from WhitelistSignupPage (justCompletedWhitelistSignup: true).');
      setTriggerWelcomeModalFromNavFlag(true);
      // Clear the flag from navigation state to prevent re-triggering
      const { justCompletedWhitelistSignup, ...restState } = location.state;
      navigate(location.pathname, { state: restState, replace: true });
    }

    // Check for navigation from AcceptInvitePage (acceptance flow)
    if (location.state?.fromAcceptanceFlow) {
      console.log('AppContent: Detected navigation from AcceptInvitePage (fromAcceptanceFlow: true).');
      setTriggerWelcomeModalFromNavFlag(true);
      // Clear the flag from navigation state to prevent re-triggering
      const { fromAcceptanceFlow, ...restState } = location.state;
      navigate(location.pathname, { state: restState, replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  // --- Effect to decide when to show the Welcome Modal (and mark as seen) ---
  useEffect(() => {
    console.log('AppContent: Welcome modal effect triggered', {
      hasUser: !!user,
      isLoading,
      hasCompletedInitialLoad,
      isWhitelisted,
      needsWelcomeCheckResult,
      hasApplicationRecord,
      triggerWelcomeModalFromNavFlag,
      isWelcomeModalActuallyVisible
    });

    // Guard: Don't do anything if user is not available
    if (!user) {
      console.log('AppContent: No user available, hiding modal if visible');
      if (isWelcomeModalActuallyVisible) setIsWelcomeModalActuallyVisible(false); // Hide if somehow visible
      return;
    }

    // Mark initial load as complete once we have user data
    if (!hasCompletedInitialLoad && !isLoading) {
      console.log('AppContent: Marking initial load as complete');
      setHasCompletedInitialLoad(true);
    }

    let shouldShowModal = false;
    if (triggerWelcomeModalFromNavFlag) {
      console.log('AppContent: Should show modal due to navigation flag');
      shouldShowModal = true;
    } else if (
      !isLoading &&
      hasCompletedInitialLoad && // Only show after initial load to prevent flash
      needsWelcomeCheckResult === true && // Use prop from RPC
      hasApplicationRecord === true                 // CRUCIAL: They have completed the signup step
    ) {
      console.log('AppContent: Should show modal due to status conditions');
      shouldShowModal = true;
    } else {
      console.log('AppContent: Modal conditions not met', {
        isLoading,
        hasCompletedInitialLoad,
        needsWelcomeCheckResult,
        hasApplicationRecord
      });
    }

    if (shouldShowModal && !isWelcomeModalActuallyVisible) {
      console.log('AppContent: Showing welcome modal');
      setIsWelcomeModalActuallyVisible(true);
      // Mark as seen immediately when we decide to show it
      supabase.auth.updateUser({ data: { has_seen_welcome: true } })
        .then(({ error: updateError }) => {
          if (updateError) {
            console.error('AppContent: Error updating user metadata (has_seen_welcome):', updateError);
          } else {
            // DO NOT update state here, as it causes the modal to flash and hide.
            // The modal should only close on user action.
            // setNeedsWelcomeCheckResult(false); 
            if (user && user.user_metadata) { // Refresh local copy of metadata if possible
              user.user_metadata.has_seen_welcome = true;
            }
          }
        });
    } else if (!shouldShowModal && isWelcomeModalActuallyVisible) {
      console.log('AppContent: Hiding welcome modal');
      setIsWelcomeModalActuallyVisible(false);
    }
  }, [
    user, // Add user as a dependency
    isLoading, 
    hasApplicationRecord, 
    needsWelcomeCheckResult, 
    triggerWelcomeModalFromNavFlag, 
    isWelcomeModalActuallyVisible,
    hasCompletedInitialLoad,
    setNeedsWelcomeCheckResult // Already a dependency
  ]);

  // --- Welcome Modal Close Handler ---
  const handleWelcomeModalClose = useCallback(async () => {
    // Update UI state synchronously to hide modal and prevent re-appearance.
    setIsWelcomeModalActuallyVisible(false);
    setNeedsWelcomeCheckResult(false); 
    setTriggerWelcomeModalFromNavFlag(false); // Reset the nav flag trigger

    // The primary metadata update happens when the modal is first shown.
    // This is a fallback call to ensure the metadata is set if the user closes the modal
    // very quickly before the first async update completes. We don't need to await it.
    if (user && user.user_metadata?.has_seen_welcome !== true) {
      supabase.auth.updateUser({ data: { has_seen_welcome: true } })
        .then(({ error }) => {
          if (error) {
            console.error('Error updating has_seen_welcome (on close fallback):', error);
          } else {
            // No need to set state again here, just update local user object if needed.
            if (user.user_metadata) user.user_metadata.has_seen_welcome = true;
          }
        })
        .catch(err => {
            console.error('Exception updating has_seen_welcome (on close fallback):', err);
        });
    }
  }, [user, setNeedsWelcomeCheckResult]); 

  // --- Rendering Logic --- 
  // isLoading check for initial load. If nav flag is set, modal logic will handle visibility.
  if (isLoading && !triggerWelcomeModalFromNavFlag) { 
    return <div className="text-stone-600 font-mono">Loading...</div>;
  }
  
  return (
    <>
      <AppRouterLogic 
          session={session} 
          isWhitelisted={isWhitelisted} // from metadata
          needsWelcomeCheck={needsWelcomeCheckResult} // from metadata
          hasApplicationRecord={hasApplicationRecord}
      />
      {isWelcomeModalActuallyVisible && (
        <WhitelistWelcomeModal 
          isOpen={true} 
          onClose={handleWelcomeModalClose} 
        />
      )}
    </>
  );
}