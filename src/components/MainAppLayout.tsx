import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, Euro } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';
// Assuming a ThemeContext exists and provides a useTheme hook
// import { useTheme } from '../contexts/ThemeContext'; 
import { Footer } from './Footer';
import { BugReportFAB } from './BugReportFAB';
import { useUserPermissions } from '../hooks/useUserPermissions'; // <-- Import the new hook
import { HoverClickPopover } from './HoverClickPopover';
import { useCredits } from '../hooks/useCredits';

// Basic debounce function (Consider moving to a utils file if not already there)
function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

interface MainAppLayoutProps {
  children: React.ReactNode;
}

export function MainAppLayout({ children }: MainAppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  // THEME FUNCTIONALITY - Placeholder, replace with your actual theme hook/context
  const [theme, setTheme] = useState<'dark' | 'light'>('dark'); // Default or load from context/localStorage
  const { session, isLoading: sessionLoading } = useSession(); // <-- Destructure session and loading state
  const { isAdmin, hasHousekeeping, isLoading: permissionsLoading } = useUserPermissions(session); // <-- Use the new hook
  const { credits } = useCredits(); // <-- Use the credits hook
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminPage = location.pathname === '/admin'; // <-- Add this line
  const isHousekeepingPage = location.pathname === '/housekeeping'; // <-- Add this line



  // Calculate loading state but don't return early yet
  const isLoading = sessionLoading || permissionsLoading;

  // Routes that should trigger scroll-to-top when navigated to
  const scrollToTopRoutes = ['/confirmation', '/my-bookings'];



  // Scroll to top effect for specific routes
  useEffect(() => {
    if (scrollToTopRoutes.includes(location.pathname)) {
      // Small delay to ensure content is rendered
      const timeoutId = setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname]);

  // Scroll handler logic
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const isAtTop = currentScrollY <= 10; 

    if (isAtTop) {
        setShowHeader(true);
    } else if (currentScrollY > lastScrollY && !isMobileMenuOpen) { 
        setShowHeader(false);
    } else if (currentScrollY < lastScrollY) { 
        setShowHeader(true);
    }
    setLastScrollY(currentScrollY); 
  }, [lastScrollY, isMobileMenuOpen]);

  const debouncedScrollHandler = useCallback(debounce(handleScroll, 50), [handleScroll]);

  useEffect(() => {
    // checkWhitelistStatus(); // Remove call
    window.addEventListener('scroll', debouncedScrollHandler);
    return () => {
      window.removeEventListener('scroll', debouncedScrollHandler);
    };
  }, [debouncedScrollHandler]);

  // THEME MANAGEMENT - Placeholder, replace with your actual theme logic
  useEffect(() => {
    // Example: Load theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setTheme('light');
      document.documentElement.classList.add('light-mode');
    } else {
      // Ensure dark mode is default if nothing saved or invalid value
      setTheme('dark');
      document.documentElement.classList.remove('light-mode');
    }
  }, []);

  useEffect(() => {
    // Apply theme changes to the documentElement for global CSS rules
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };
  // END THEME MANAGEMENT Placeholder

  const handleSignOut = async () => {
    console.log('MainAppLayout: Signing out...');

    try {
      // Attempt to sign out globally (invalidate server session)
      console.log('MainAppLayout: Attempting global sign out...');
      const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
      if (globalError) {
        // Log the error, but don't let it stop the process.
        // This is expected if the session was already invalid on the server.
        console.warn('MainAppLayout: Global sign out failed or session already invalid:', globalError.message);
      } else {
        console.log('MainAppLayout: Global sign out successful.');
      }
    } catch (err) {
      // Catch any unexpected errors during the global sign out attempt
      console.error('MainAppLayout: Unexpected error during global sign out:', err);
    }

    try {
      // Always attempt to sign out locally (clear client-side session)
      // This is the crucial part to ensure the user is not "stuck".
      console.log('MainAppLayout: Performing local sign out...');
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
      if (localError) {
        // This would be more unusual, an error clearing local state.
        console.error('MainAppLayout: Local sign out failed:', localError.message);
      } else {
        console.log('MainAppLayout: Local sign out successful.');
      }
    } catch (err) {
      console.error('MainAppLayout: Unexpected error during local sign out:', err);
    }
    
    // After all sign-out attempts, navigate.
    console.log('MainAppLayout: Navigating to / after sign out process.');
    navigate('/');
  };

  // Navigation helper for header links (avoids prop drilling from AuthenticatedApp)
  const handleHeaderNavigation = (path: string) => {
      console.log('[MainAppLayout] handleHeaderNavigation called with path:', path);
      navigate(path);
      setIsMobileMenuOpen(false); // Close mobile menu on navigation
  };

  // Show loading screen if either session or permissions are loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-stone-400 font-mono">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col"
      style={{
        position: "relative",
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        backgroundImage: theme === 'light'
          ? `linear-gradient(rgba(250, 250, 249, 0.92), rgba(250, 250, 249, 0.92)), url(https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//fern-bg-sam-blurred.png)`
          : `url(https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//fern-bg-sam-blurred.png)`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
        backgroundColor: theme === 'light' ? '#FAFAF9' : '#121212'
      }}
    >
      {/* === Header Start === */}
      <header className={`fixed top-0 left-0 right-0 z-50 border-border/50 transition-all duration-300 ease-in-out ${!showHeader ? '-translate-y-full' : ''} ${theme === 'light' ? 'border-b border-border/50' : ''} ${(isAdminPage || isHousekeepingPage) ? 'bg-black/50' : ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-10 sm:h-14">
            <button
              // Navigate to root, AuthenticatedApp will handle the '/' route
              onClick={() => handleHeaderNavigation('/')} 
              className="text-primary flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div>
                <h1 className="text-xl sm:text-2xl font-lettra-bold text-primary">The Garden</h1>
              </div>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-sm hover:bg-[var(--color-bg-surface-hover)] transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-secondary" /> : <Menu className="w-6 h-6 text-secondary" />}
            </button>

            {/* Desktop navigation */}
            <div className="hidden lg:flex items-center gap-6">
              {/* THEME TOGGLE BUTTON - Re-enabled here */}
              {/* <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-[var(--color-button-secondary-bg)] text-secondary hover:text-primary hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button> */}
              
              {/* Credits Display */}
              {credits > 0 && (
                <HoverClickPopover
                  triggerContent={
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-dark border border-shade-1 rounded-sm">
                      <Euro className="w-4 h-4 text-primary" />
                      <span className="text-sm font-lettra text-primary">{credits}</span>
                    </div>
                  }
                  contentClassName="tooltip-content !font-mono text-sm z-50"
                  arrowClassName="tooltip-arrow"
                  popoverContentNode={
                    <div className="text-center">
                      <div>{credits} magic tokens ✨</div>
                    </div>
                  }
                />
              )}
              
              <nav className="flex gap-6 items-center">
                <button
                  onClick={() => handleHeaderNavigation('/my-bookings')}
                  className={`p-1.5 font-lettra text-sm transition-colors border border-shade-1 bg-surface-dark rounded-sm text-primary ${location.pathname === '/my-bookings' ? 'font-medium' : 'hover:opacity-80'}`}
                >
                  MY ACCOUNT
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleHeaderNavigation('/admin')}
                    className={`p-1.5 text-sm transition-colors uppercase font-lettra text-primary border border-shade-1 bg-surface-dark rounded-sm ${location.pathname === '/admin' ? 'font-medium' : 'hover:opacity-80'}`}
                  >
                    ADMIN PANEL
                  </button>
                )}
                {hasHousekeeping && !isAdmin && (
                  <button
                    onClick={() => handleHeaderNavigation('/housekeeping')}
                    className={`p-1.5 text-sm transition-colors uppercase font-lettra text-primary border border-shade-1 bg-surface-dark rounded-sm ${location.pathname === '/housekeeping' ? 'font-medium' : 'hover:opacity-80'}`}
                  >
                    HOUSEKEEPING
                  </button>
                )}
              </nav>
              <button
                onClick={handleSignOut}
                className="p-1.5 transition-colors text-sm uppercase font-lettra text-primary hover:opacity-80"
              >
                SIGN OUT
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div
            className={`lg:hidden transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}
          >
            {/* Apply background, padding, shadow, rounding, and dividers */}
            <div className={`px-4 rounded-b-lg shadow-lg divide-y divide-border/50 ${theme === 'light' ? 'bg-white border-t border-border' : 'bg-surface'}`}>
              {/* THEME TOGGLE BUTTON - Re-enabled here */}
              {/* <button
                onClick={() => { toggleTheme(); setIsMobileMenuOpen(false); }} // Close menu on theme toggle
                className="flex items-center gap-2 w-full text-left px-4 py-2 rounded-sm text-secondary hover:bg-[var(--color-bg-surface-hover)] transition-colors text-sm"
              >
                {theme === 'dark' ? 
                  (<><Sun className="w-4 h-4" /><span>Switch to Light Mode</span></>) : 
                  (<><Moon className="w-4 h-4" /><span>Switch to Dark Mode</span></>)
                }
              </button> */}
              
              {/* Credits Display */}
              {credits > 0 && (
                <HoverClickPopover
                  triggerContent={
                    <div className="flex items-center gap-2 py-3">
                      <Euro className="w-4 h-4 text-primary" />
                      <span className="text-sm font-lettra text-primary">{credits} credits</span>
                    </div>
                  }
                  contentClassName="tooltip-content !font-mono text-sm z-50"
                  arrowClassName="tooltip-arrow"
                  popoverContentNode={
                    <div className="text-center">
                      <div>{credits} magic tokens ✨</div>
                    </div>
                  }
                />
              )}
              
              <button
                onClick={() => handleHeaderNavigation('/my-bookings')}
                className={`w-full text-left py-3 font-lettra transition-colors text-sm text-primary ${location.pathname === '/my-bookings' ? 'font-medium' : 'hover:opacity-80'}`}
              >
                MY ACCOUNT
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleHeaderNavigation('/admin')}
                  className={`w-full text-left py-3 transition-colors text-sm uppercase font-lettra text-primary ${location.pathname === '/admin' ? 'font-medium' : 'hover:opacity-80'}`}
                >
                  ADMIN PANEL
                </button>
              )}
              {hasHousekeeping && !isAdmin && (
                <button
                  onClick={() => handleHeaderNavigation('/housekeeping')}
                  className={`w-full text-left py-3 transition-colors text-sm uppercase font-lettra text-primary ${location.pathname === '/housekeeping' ? 'font-medium' : 'hover:opacity-80'}`}
                >
                  HOUSEKEEPING
                </button>
              )}
              <button
                onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }} // Close menu on sign out
                className="w-full text-left py-3 transition-colors text-sm uppercase font-lettra text-primary hover:opacity-80"
              >
                SIGN OUT
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* === Header End === */}

      {/* Add padding to main content to prevent overlap with fixed header */}
      {/* Children will be rendered here - this is where the page-specific content goes */}
      <main className="relative flex-grow pt-10 sm:pt-14">
        {children}
      </main>

      {/* === Footer Start === */}
      <Footer
        // Pass location to Footer if it needs it, or let Footer use its own hook
        wrapperClassName={
          (location.pathname === '/admin' || location.pathname === '/housekeeping')
            ? "bg-[var(--color-bg-main)] border-t border-border mt-auto py-6"
            : undefined // Use default classes if not admin/housekeeping
        }
      />
      {/* === Footer End === */}

      {/* === Modals and FABs Start === */}
      <BugReportFAB />
      {/* === Modals and FABs End === */}

      {/* Keyframes can stay here or move to a global CSS file */}
      <style>
        {`
          @keyframes gradient-x {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient-x {
            animation: gradient-x 5s ease infinite;
          }
        `}
      </style>
    </div>
  );
}

// Add default export if this is the standard in your project
// export default MainAppLayout; 