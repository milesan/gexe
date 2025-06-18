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
import { FireflyPortal } from './components/FireflyPortal';

// Configure logging early to silence logs in production
configureLogging(false, true);  // Enable logging in production temporarily

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
  
  // Log received props for debugging routing issues
  console.log('AppRouterLogic: Render START', { 
    pathname: location.pathname, 
    hasSession: !!session, 
    isWhitelistedProp: isWhitelisted, //test
    needsWelcomeCheckProp: needsWelcomeCheck, 
    hasApplicationRecordProp: hasApplicationRecord, // Log the new prop
    isAdminCheck,
    permissionsLoading
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

  // Show loading while permissions are being checked
  if (permissionsLoading) {
    console.log('AppRouterLogic: Loading permissions...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-accent-primary"></div>
      </div>
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
    // Only run if session is loaded and we have a user email AND id
    if (!sessionLoading && userEmail && userId) {
      console.log(`App: Session loaded for ${userEmail}. Checking combined app entry status...`);
      // Start loading for the combined check
      setIsLoadingWhitelistStatus(true); 
      setIsLoadingApplicationStatus(true); // We can keep this or use a single new loading state
      let mounted = true;

      const checkCombinedStatus = async () => {
        try {
          console.log(`App: checkCombinedStatus - Calling get_user_app_entry_status_v2 for userId: ${userId}, email: ${userEmail}`);
          
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
            console.log('App: get_user_app_entry_status_v2 RPC result:', statusData);
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
            setIsLoadingWhitelistStatus(false); 
            setIsLoadingApplicationStatus(false);
            console.log('App: Finished checking combined app entry status.');
          }
        }
      };

      checkCombinedStatus();

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

    // --- BEGIN ADDED FUNCTION ---
    const handleSignOut = async () => {
      console.log('[App] Signing out user from loading screen...');

      try {
        // Attempt to sign out globally (invalidate server session)
        console.log('[App] Attempting global sign out from loading screen...');
        const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
        if (globalError) {
          console.warn('[App] Global sign out from loading screen failed or session already invalid:', globalError.message);
        } else {
          console.log('[App] Global sign out from loading screen successful.');
        }
      } catch (err) {
        console.error('[App] Unexpected error during global sign out from loading screen:', err);
      }

      try {
        // Always attempt to sign out locally (clear client-side session)
        console.log('[App] Performing local sign out from loading screen...');
        const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
        if (localError) {
          console.error('[App] Local sign out from loading screen failed:', localError.message);
        } else {
          console.log('[App] Local sign out from loading screen successful.');
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
        {/* Add FireflyPortal here - it renders outside the React tree */}
        <FireflyPortal />
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
    // Check for the specific flag we set in WhitelistSignupPage
    if (location.state?.justCompletedWhitelistSignup) {
      console.log('AppContent: Detected navigation from WhitelistSignupPage (justCompletedWhitelistSignup: true).');
      setTriggerWelcomeModalFromNavFlag(true);
      // Clear the flag from navigation state to prevent re-triggering
      const { justCompletedWhitelistSignup, ...restState } = location.state;
      navigate(location.pathname, { state: restState, replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  // --- Effect to decide when to show the Welcome Modal (and mark as seen) ---
  useEffect(() => {
    // Guard: Don't do anything if user is not available
    if (!user) {
      if (isWelcomeModalActuallyVisible) setIsWelcomeModalActuallyVisible(false); // Hide if somehow visible
      return;
    }

    // Mark initial load as complete once we have user data
    if (!hasCompletedInitialLoad && !isLoading) {
      setHasCompletedInitialLoad(true);
    }

    console.log('AppContent Welcome Modal Effect Check:', {
      isLoading,
      isWhitelisted,
      hasApplicationRecord,
      needsWelcomeCheckResult, // from get_user_app_entry_status_v2 (metadata)
      triggerWelcomeModalFromNavFlag, // from navigation state
      isWelcomeModalActuallyVisible,
      hasCompletedInitialLoad,
      userId: user.id
    });

    let shouldShowModal = false;
    if (triggerWelcomeModalFromNavFlag) {
      shouldShowModal = true;
      console.log('AppContent: Modal decision: YES (triggered by navigation flag from signup page).');
    } else if (
      !isLoading &&
      hasCompletedInitialLoad && // Only show after initial load to prevent flash
      isWhitelisted === true && // Use prop from RPC, not stale metadata
      needsWelcomeCheckResult === true && // Use prop from RPC
      hasApplicationRecord === true                 // CRUCIAL: They have completed the signup step
    ) {
      shouldShowModal = true;
      console.log('AppContent: Modal decision: YES (DB conditions met: is_whitelisted, needs_welcome, AND has_application_record).');
    } else {
      console.log('AppContent: Modal decision: NO.');
      // Add some logging for why it might be no, if relevant conditions were met
      if (!isLoading && isWhitelisted === true && needsWelcomeCheckResult === true && hasApplicationRecord === false) {
        console.log('AppContent: Modal deferred because user still needs to complete signup (hasApplicationRecord is false).');
      }
      if (!hasCompletedInitialLoad && needsWelcomeCheckResult === true) {
        console.log('AppContent: Modal deferred because initial load not complete (preventing flash).');
      }
    }

    if (shouldShowModal && !isWelcomeModalActuallyVisible) {
      console.log('AppContent: Showing Welcome Modal.');
      setIsWelcomeModalActuallyVisible(true);
      // Mark as seen immediately when we decide to show it
      console.log(`AppContent: Attempting to update user metadata (has_seen_welcome: true) for user ${user.id} (on show).`);
      supabase.auth.updateUser({ data: { has_seen_welcome: true } })
        .then(({ data: updateData, error: updateError }) => {
          if (updateError) {
            console.error('AppContent: Error updating user metadata (has_seen_welcome):', updateError);
          } else {
            console.log('AppContent: Successfully updated user metadata (has_seen_welcome: true).');
            // DO NOT update state here, as it causes the modal to flash and hide.
            // The modal should only close on user action.
            // setNeedsWelcomeCheckResult(false); 
            if (user && user.user_metadata) { // Refresh local copy of metadata if possible
              user.user_metadata.has_seen_welcome = true;
            }
          }
        });
    } else if (!shouldShowModal && isWelcomeModalActuallyVisible) {
      console.log('AppContent: Hiding Welcome Modal.');
      setIsWelcomeModalActuallyVisible(false);
    }
  }, [
    user, // Add user as a dependency
    isLoading, 
    isWhitelisted, 
    hasApplicationRecord, 
    needsWelcomeCheckResult, 
    triggerWelcomeModalFromNavFlag, 
    isWelcomeModalActuallyVisible,
    hasCompletedInitialLoad,
    setNeedsWelcomeCheckResult // Already a dependency
  ]);

  // --- Welcome Modal Close Handler ---
  const handleWelcomeModalClose = useCallback(async () => {
    console.log('AppContent: Closing Welcome Modal. Immediately updating state.');
    // Update UI state synchronously to hide modal and prevent re-appearance.
    setIsWelcomeModalActuallyVisible(false);
    setNeedsWelcomeCheckResult(false); 
    setTriggerWelcomeModalFromNavFlag(false); // Reset the nav flag trigger

    // The primary metadata update happens when the modal is first shown.
    // This is a fallback call to ensure the metadata is set if the user closes the modal
    // very quickly before the first async update completes. We don't need to await it.
    if (user && user.user_metadata?.has_seen_welcome !== true) {
      console.log(`AppContent: Calling supabase.auth.updateUser as a fallback on close for user ${user.id}.`);
      supabase.auth.updateUser({ data: { has_seen_welcome: true } })
        .then(({ error }) => {
          if (error) {
            console.error('Error updating has_seen_welcome (on close fallback):', error);
          } else {
            console.log('AppContent: Successfully updated has_seen_welcome (on close fallback).');
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
    console.log('AppContent: Still in loading state passed from App.tsx.'); 
    return <div className="text-stone-600 font-mono">Loading...</div>;
  }

  console.log('AppContent: Rendering. isWelcomeModalActuallyVisible:', isWelcomeModalActuallyVisible);
  
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