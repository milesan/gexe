import React, { useState, useEffect, useCallback } from 'react';
import { MyBookings } from './MyBookings';
import { Book2Page } from '../pages/Book2Page';
import { AdminPage } from '../pages/AdminPage';
import { ConfirmationPage } from '../pages/ConfirmationPage';
import { AcceptInvitePage } from '../pages/AcceptInvitePage';
import { WhyPage } from '../pages/WhyPage';
import { useSession } from '../hooks/useSession';
import { supabase } from '../lib/supabase';
import { Routes, Route, useNavigate, Navigate, Link, useLocation } from 'react-router-dom';
import { PaymentPage } from '../pages/PaymentPage';
import { useAccommodations } from '../hooks/useAccommodations';
import { WhitelistWelcomeModal } from './WhitelistWelcomeModal';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { Footer } from './Footer';
import { BugReportFAB } from './BugReportFAB';

// Basic debounce function
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

export function AuthenticatedApp() {
  console.log('AuthenticatedApp: Initializing');
  const [currentPage, setCurrentPage] = useState<'calendar' | 'my-bookings' | 'admin'>('calendar');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Header scroll state
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  // THEME FUNCTIONALITY RE-ENABLED
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const adminEmails = ['andre@thegarden.pt', 'redis213@gmail.com', 'dawn@thegarden.pt', 'simone@thegarden.pt', 'samjlloa@gmail.com', 'redis213+testadmin@gmail.com'];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;
  const { accommodations } = useAccommodations();

  console.log('AuthenticatedApp: User status check', { 
    email: session?.user?.email,
    isAdmin: isAdmin,
    currentPage 
  });

  // Scroll handler logic
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const isAtTop = currentScrollY <= 10; // Small buffer for top

    if (isAtTop) {
        setShowHeader(true);
    } else if (currentScrollY > lastScrollY && !isMobileMenuOpen) { // Scrolling down
        setShowHeader(false);
    } else if (currentScrollY < lastScrollY) { // Scrolling up
        setShowHeader(true);
    }

    setLastScrollY(currentScrollY); // Update last scroll position

  }, [lastScrollY, isMobileMenuOpen, showHeader]);

  // Debounced scroll handler
  const debouncedScrollHandler = useCallback(debounce(handleScroll, 50), [handleScroll]);

  useEffect(() => {
    checkWhitelistStatus();
    // Attach scroll listener
    window.addEventListener('scroll', debouncedScrollHandler);
    console.log("Scroll listener attached");

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('scroll', debouncedScrollHandler);
      console.log("Scroll listener removed");
    };
  }, [debouncedScrollHandler]);

  // THEME FUNCTIONALITY RE-ENABLED
  // Effect to load saved theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setTheme('light');
      document.documentElement.classList.add('light-mode');
    }
  }, []);

  // Effect to apply theme changes
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const checkWhitelistStatus = async () => {
    try {
      // Ensure session and user email exist before proceeding
      if (!session?.user?.email) {
        console.log('checkWhitelistStatus: No session or email found, skipping.');
        return;
      }
      const userEmail = session.user.email; // Use confirmed email
      console.log(`checkWhitelistStatus: Checking for user ${userEmail}`);

      // Check if user is whitelisted and hasn't seen welcome
      // Directly use userEmail which is confirmed to exist
      const { data: isWhitelisted, error: rpcError } = await supabase.rpc('is_whitelisted', { 
        user_email: userEmail 
      });
      if (rpcError) throw rpcError; // Throw if RPC call fails

      const hasSeenWelcome = session.user?.user_metadata?.has_seen_welcome ?? false;

      console.log(`checkWhitelistStatus: Status for ${userEmail}`, { isWhitelisted, hasSeenWelcome });

      if (isWhitelisted && !hasSeenWelcome) {
        setShowWelcomeModal(true);
      }
    } catch (err) {
      console.error('Error checking whitelist status:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('handleSignOut: Attempting sign out');
      await supabase.auth.signOut();
      console.log('handleSignOut: Sign out successful, redirecting to / ');
      // Use navigate for SPA navigation instead of forcing a full page reload
      navigate('/'); 
      // window.location.href = '/'; // Avoid full reload
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleWelcomeClose = async () => {
    // Ensure session and user email exist before proceeding
    if (!session?.user?.email) {
      console.error('handleWelcomeClose: Cannot update metadata, no session/email.');
      setShowWelcomeModal(false); // Close modal anyway
      return;
    }
    const userEmail = session.user.email; // Use confirmed email
    try {
      console.log(`handleWelcomeClose: Updating metadata for ${userEmail}`);
      await supabase.auth.updateUser({
        data: {
          has_seen_welcome: true
        }
      });
      console.log(`handleWelcomeClose: User metadata updated for ${userEmail}`);

      // Call the RPC function as well
      console.log(`handleWelcomeClose: Calling RPC mark_whitelist_welcome_seen for ${userEmail}`);
      const { error: rpcError } = await supabase.rpc('mark_whitelist_welcome_seen', {
        p_email: userEmail
      });
      if (rpcError) {
        console.error(`handleWelcomeClose: RPC error for ${userEmail}:`, rpcError);
        // Decide if you still want to close the modal despite the RPC error
      } else {
        console.log(`handleWelcomeClose: RPC call successful for ${userEmail}`);
      }

      setShowWelcomeModal(false);
    } catch (err) {
      console.error('Error updating welcome status:', err);
      setShowWelcomeModal(false); // Ensure modal closes even on error
    }
  };

  const handleNavigation = (page: 'calendar' | 'my-bookings' | 'admin') => {
    setCurrentPage(page);
    navigate(page === 'calendar' ? '/' : `/${page}`);
    setIsMobileMenuOpen(false);
  };

  // Function to close mobile menu, used by Links
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-main flex flex-col"
      style={{
        backgroundImage: theme === 'light'
          ? `linear-gradient(rgba(250, 250, 249, 0.92), rgba(250, 250, 249, 0.92)), url(https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//fern-background-tiling-2.png)` // Lighter overlay for light mode - Increased opacity
          : `linear-gradient(rgba(31, 41, 55, 0.9), rgba(31, 41, 55, 0.9)), url(https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//fern-background-tiling-2.png)`, // Original dark overlay
        backgroundSize: 'auto',
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center',
      }}
    >
      {/* Updated header classes - removed border-b */}
      <header className={`fixed top-0 left-0 right-0 z-50 border-border/50 backdrop-blur-sm transition-all duration-300 ease-in-out bg-[var(--color-bg-surface-transparent)] ${!showHeader ? '-translate-y-full' : ''} ${theme === 'light' ? 'border-b border-border/50' : ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-10 sm:h-14">
            <button 
              onClick={() => handleNavigation('calendar')}
              className="text-primary flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div>
                <h1 className="text-xl sm:text-2xl font-lettra-bold text-primary">THE GARDEN</h1>
              </div>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-bg-surface-hover)] transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-secondary" />
              ) : (
                <Menu className="w-6 h-6 text-secondary" />
              )}
            </button>

            {/* Desktop navigation */}
            <div className="hidden lg:flex items-center gap-6">
              {/* THEME TOGGLE BUTTON TEMPORARILY DISABLED */}
              {/*
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-[var(--color-button-secondary-bg)] text-secondary hover:text-primary hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>*/}
              <nav className="flex gap-6 items-center">
                <button
                  onClick={() => handleNavigation('my-bookings')}
                  className={`text-sm font-regular transition-colors ${
                    location.pathname === '/my-bookings'
                      ? 'text-accent-secondary font-medium'
                      : 'text-secondary hover:text-accent-secondary'
                  }`}
                >
                  My Account
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleNavigation('admin')}
                    className={`bg-accent-primary text-stone-800 px-4 py-2 rounded-lg hover:bg-accent-secondary transition-colors text-sm font-regular ${
                        location.pathname === '/admin' ? 'ring-2 ring-offset-2 ring-accent-primary ring-offset-surface' : ''
                    }`}
                  >
                    Admin Panel
                  </button>
                )}
              </nav>
              <button 
                onClick={handleSignOut}
                className="bg-[var(--color-button-secondary-bg)] text-primary px-6 py-2 hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors text-sm font-regular rounded-lg border border-border"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div 
            className={`lg:hidden transition-all duration-300 ease-in-out ${
              isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            } overflow-hidden`}
          >
            {/* Add border-t only if light mode */} 
            <div className={`py-4 space-y-4 ${theme === 'light' ? 'border-t border-border' : ''}`}>
              {/* THEME TOGGLE BUTTON TEMPORARILY DISABLED */}
              {/*
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 w-full text-left px-4 py-2 rounded-lg text-secondary hover:bg-[var(--color-bg-surface-hover)] transition-colors text-sm"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>Switch to Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Switch to Dark Mode</span>
                  </>
                )}
              </button>
              */}
              <button
                onClick={() => handleNavigation('my-bookings')}
                className={`w-full text-left px-4 py-2 font-regular rounded-lg transition-colors text-sm ${
                  location.pathname === '/my-bookings'
                    ? 'bg-[color-mix(in_srgb,_var(--color-accent-secondary)_20%,_transparent)] text-accent-secondary font-medium'
                    : 'text-secondary hover:bg-[var(--color-bg-surface-hover)]'
                }`}
              >
                My Account
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleNavigation('admin')}
                  className={`w-full text-left bg-accent-primary text-stone-800 px-4 py-2 rounded-lg hover:bg-accent-secondary transition-colors text-sm font-regular ${
                    location.pathname === '/admin' ? 'ring-2 ring-offset-2 ring-accent-primary ring-offset-surface' : ''
                  }`}
                >
                  Admin Panel
                </button>
              )}
              <button 
                onClick={handleSignOut}
                className="w-full text-left bg-[var(--color-button-secondary-bg)] text-primary px-4 py-2 hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors text-sm font-regular rounded-lg border border-border"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Add padding to main content to prevent overlap with fixed header */}
      <main className="relative flex-grow pt-10 sm:pt-14">
        <Routes>
          <Route path="/" element={<Book2Page />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/why" element={<WhyPage />} />
        </Routes>
      </main>

      <Footer 
        wrapperClassName={
          location.pathname === '/admin' 
            ? "bg-[var(--color-bg-main)] border-t border-border mt-auto py-6"
            : undefined // Use default classes if not admin
        }
      />

      <WhitelistWelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleWelcomeClose}
      />

      <BugReportFAB />

      {/* Add CSS keyframes for the gradient animation */}
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