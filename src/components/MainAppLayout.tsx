import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';
// Assuming a ThemeContext exists and provides a useTheme hook
// import { useTheme } from '../contexts/ThemeContext'; 
import { Footer } from './Footer';
// import { WhitelistWelcomeModal } from './WhitelistWelcomeModal'; // Remove import
import { BugReportFAB } from './BugReportFAB';
import { isAdminUser } from '../lib/authUtils'; // <-- Import the utility

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
  console.log('MainAppLayout: Initializing');
  // const [showWelcomeModal, setShowWelcomeModal] = useState(false); // Remove state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  // THEME FUNCTIONALITY - Placeholder, replace with your actual theme hook/context
  const [theme, setTheme] = useState<'dark' | 'light'>('dark'); // Default or load from context/localStorage
  const { session, isLoading: sessionLoading } = useSession(); // <-- Destructure session and loading state
  const navigate = useNavigate();
  const location = useLocation();
  // TODO: Consider moving adminEmails to a config file or context if used elsewhere
  // const adminEmails = ['andre@thegarden.pt', 'redis213@gmail.com', 'dawn@thegarden.pt', 'simone@thegarden.pt', 'samjlloa@gmail.com', 'redis213+testadmin@gmail.com']; // <-- Remove this!
  const isAdmin = isAdminUser(session); // <-- Use the utility function

  // Add a log to check the isAdmin value here too
  console.log('[MainAppLayout] isAdmin check result:', isAdmin, 'isLoading:', sessionLoading);

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
    console.log("MainAppLayout: Scroll listener attached");
    return () => {
      window.removeEventListener('scroll', debouncedScrollHandler);
      console.log("MainAppLayout: Scroll listener removed");
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
    try {
      console.log('MainAppLayout: Signing out');
      await supabase.auth.signOut();
      // Navigate to root, App.tsx routing logic will handle redirect to LandingPage
      navigate('/'); 
    } catch (error) {
      console.error('MainAppLayout: Error signing out:', error);
    }
  };

  /* // Remove entire handleWelcomeClose function
  const handleWelcomeClose = async () => {
     if (!session?.user?.email) {
        console.error('MainAppLayout: Cannot update metadata, no session/email.');
        setShowWelcomeModal(false); 
        return;
     }
     const userEmail = session.user.email;
     try {
        console.log(`MainAppLayout: Closing welcome modal, updating metadata for ${userEmail}`);
        // Update auth metadata
        await supabase.auth.updateUser({ data: { has_seen_welcome: true } });
        
        // Also call RPC if it handles additional logic (e.g., updating a separate table)
        // If RPC is purely redundant with metadata update, you might remove this call.
        console.log(`MainAppLayout: Calling RPC mark_whitelist_welcome_seen for ${userEmail}`);
        const { error: rpcError } = await supabase.rpc('mark_whitelist_welcome_seen', { p_email: userEmail });
        if (rpcError) {
            console.error(`MainAppLayout: RPC mark_whitelist_welcome_seen error for ${userEmail}:`, rpcError);
        } else {
            console.log(`MainAppLayout: RPC mark_whitelist_welcome_seen successful for ${userEmail}`);
        }
        setShowWelcomeModal(false);
     } catch (err) {
        console.error('MainAppLayout: Error updating welcome status:', err);
        setShowWelcomeModal(false); 
     }
  };
  */
  
  // Navigation helper for header links (avoids prop drilling from AuthenticatedApp)
  const handleHeaderNavigation = (path: string) => {
      navigate(path);
      setIsMobileMenuOpen(false); // Close mobile menu on navigation
  };


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
      <header className={`fixed top-0 left-0 right-0 z-50 border-border/50 transition-all duration-300 ease-in-out ${!showHeader ? '-translate-y-full' : ''} ${theme === 'light' ? 'border-b border-border/50' : ''}`}>
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
              className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-bg-surface-hover)] transition-colors"
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
                className="flex items-center gap-2 w-full text-left px-4 py-2 rounded-lg text-secondary hover:bg-[var(--color-bg-surface-hover)] transition-colors text-sm"
              >
                {theme === 'dark' ? 
                  (<><Sun className="w-4 h-4" /><span>Switch to Light Mode</span></>) : 
                  (<><Moon className="w-4 h-4" /><span>Switch to Dark Mode</span></>)
                }
              </button> */}
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
          location.pathname === '/admin'
            ? "bg-[var(--color-bg-main)] border-t border-border mt-auto py-6"
            : undefined // Use default classes if not admin
        }
      />
      {/* === Footer End === */}

      {/* === Modals and FABs Start === */}
      {/* 
      <WhitelistWelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleWelcomeClose}
      />
      */}

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