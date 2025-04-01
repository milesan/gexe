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
  // THEME FUNCTIONALITY COMMENTED OUT - TO BE IMPLEMENTED LATER
  // const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const adminEmails = ['andre@thegarden.pt', 'redis213@gmail.com', 'dawn@thegarden.pt', 'simone@thegarden.pt', 'samjlloa@gmail.com', 'redis213+testadmin@gmail.com'];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;
  const { accommodations } = useAccommodations();

  console.log('AuthenticatedApp: User status', { 
    email: session?.user?.email,
    isAdmin,
    currentPage 
  });

  // Scroll handler logic
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const isAtTop = currentScrollY <= 10; // Small buffer for top

    console.log(`Scroll Check: current=${currentScrollY}, last=${lastScrollY}, show=${showHeader}`);

    if (isAtTop) {
        console.log("Scroll: At top");
        setShowHeader(true);
    } else if (currentScrollY > lastScrollY && !isMobileMenuOpen) { // Scrolling down
        console.log("Scroll: Down");
        setShowHeader(false);
    } else if (currentScrollY < lastScrollY) { // Scrolling up
        console.log("Scroll: Up");
        setShowHeader(true);
    }

    setLastScrollY(currentScrollY); // Update last scroll position

  }, [lastScrollY, isMobileMenuOpen, showHeader]); // Added showHeader to dependencies as it's read now

  // Debounced scroll handler
  const debouncedScrollHandler = useCallback(debounce(handleScroll, 50), [handleScroll]); // Adjust debounce delay (50ms) if needed

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
  }, [debouncedScrollHandler]); // Re-attach if handler changes (it shouldn't often due to useCallback)

  // THEME FUNCTIONALITY COMMENTED OUT - TO BE IMPLEMENTED LATER
  // Effect to load saved theme from localStorage on mount
  // useEffect(() => {
  //   const savedTheme = localStorage.getItem('theme');
  //   if (savedTheme === 'light') {
  //     setTheme('light');
  //     document.documentElement.classList.add('light-mode');
  //   }
  // }, []);

  // Effect to apply theme changes
  // useEffect(() => {
  //   if (theme === 'light') {
  //     document.documentElement.classList.add('light-mode');
  //     localStorage.setItem('theme', 'light');
  //   } else {
  //     document.documentElement.classList.remove('light-mode');
  //     localStorage.setItem('theme', 'dark');
  //   }
  // }, [theme]);

  // const toggleTheme = () => {
  //   setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  // };

  const checkWhitelistStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Check if user is whitelisted and hasn't seen welcome
      const { data: metadata } = await supabase.auth.getUser();
      const { data: isWhitelisted } = await supabase.rpc('is_whitelisted', { 
        user_email: metadata.user?.email 
      });
      const hasSeenWelcome = metadata.user?.user_metadata?.has_seen_welcome ?? false;

      if (isWhitelisted && !hasSeenWelcome) {
        setShowWelcomeModal(true);
      }
    } catch (err) {
      console.error('Error checking whitelist status:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleWelcomeClose = async () => {
    try {
      await supabase.auth.updateUser({
        data: {
          has_seen_welcome: true
        }
      });

      await supabase.rpc('mark_whitelist_welcome_seen', {
        p_email: session?.user?.email
      });

      setShowWelcomeModal(false);
    } catch (err) {
      console.error('Error updating welcome status:', err);
      setShowWelcomeModal(false);
    }
  };

  if (!session) {
    return <Navigate to="/" replace />;
  }

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
        backgroundImage: `linear-gradient(rgba(31, 41, 55, 0.9), rgba(31, 41, 55, 0.9)), url(https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//fern-background-tiling-2.png)`,
        backgroundSize: 'auto',
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center',
      }}
    >
      {/* Updated header classes - removed border-b */}
      <header className={`fixed top-0 left-0 right-0 z-50 border-border/50 backdrop-blur-sm transition-all duration-300 ease-in-out bg-[var(--color-bg-surface-transparent)] ${!showHeader ? '-translate-y-full' : ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-10 sm:h-14">
            <button 
              onClick={() => handleNavigation('calendar')}
              className="text-primary flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div>
                <h1 className="text-xl sm:text-3xl font-['VT323'] text-primary">The Garden</h1>
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
              {/* THEME TOGGLE BUTTON COMMENTED OUT - TO BE IMPLEMENTED LATER
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
              </button>
              */}
              <nav className="flex gap-6 items-center">
                <Link
                  to="/why"
                  onClick={closeMobileMenu}
                  className={`text-sm font-regular transition-colors ${
                    location.pathname === '/why'
                      ? 'text-accent-secondary font-medium'
                      : 'text-secondary hover:text-accent-secondary'
                  }`}
                >
                  Why?
                </Link>
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
                    className={`bg-accent-secondary text-white px-4 py-2 rounded-lg hover:bg-accent-primary transition-colors text-sm font-regular ${
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
            <div className="py-4 space-y-4 border-t border-border">
              {/* THEME TOGGLE BUTTON COMMENTED OUT - TO BE IMPLEMENTED LATER
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
              <Link
                to="/why"
                onClick={closeMobileMenu}
                className={`block w-full text-left px-4 py-2 rounded-lg transition-colors text-sm font-regular ${
                  location.pathname === '/why'
                  ? 'bg-[color-mix(in_srgb,_var(--color-accent-secondary)_20%,_transparent)] text-accent-secondary font-medium'
                  : 'text-secondary hover:bg-[var(--color-bg-surface-hover)]'
                }`}
              >
                <span className="text-secondary">
                  Why This App Exists
                </span>
              </Link>
              <button
                onClick={() => handleNavigation('my-bookings')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors text-sm ${
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
                  className={`w-full text-left bg-accent-secondary text-white px-4 py-2 rounded-lg hover:bg-accent-primary transition-colors text-sm font-regular ${
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

      <Footer />

      <WhitelistWelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleWelcomeClose}
      />

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