import React, { useState, useEffect } from 'react';
import { MyBookings } from './MyBookings';
import { Book2Page } from '../pages/Book2Page';
import { AdminPage } from '../pages/AdminPage';
import { ConfirmationPage } from '../pages/ConfirmationPage';
import { AcceptInvitePage } from '../pages/AcceptInvitePage';
import { useSession } from '../hooks/useSession';
import { supabase } from '../lib/supabase';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { PaymentPage } from '../pages/PaymentPage';
import { useAccommodations } from '../hooks/useAccommodations';
import { WhitelistWelcomeModal } from './WhitelistWelcomeModal';
import { Menu, X } from 'lucide-react';

export function AuthenticatedApp() {
  console.log('AuthenticatedApp: Initializing');
  const [currentPage, setCurrentPage] = useState<'calendar' | 'my-bookings' | 'admin'>('calendar');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const session = useSession();
  const navigate = useNavigate();
  const adminEmails = ['andre@thegarden.pt', 'redis213@gmail.com', 'dawn@thegarden.pt', 'simone@thegarden.pt', 'samjlloa@gmail.com', 'redis213+testadmin@gmail.com'];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;
  const { accommodations } = useAccommodations();

  console.log('AuthenticatedApp: User status', { 
    email: session?.user?.email,
    isAdmin,
    currentPage 
  });

  useEffect(() => {
    checkWhitelistStatus();
  }, []);

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

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-50 bg-white border-b border-stone-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <button 
              onClick={() => handleNavigation('calendar')}
              className="text-black flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div>
                <h1 className="text-xl sm:text-2xl font-['PP_Lettra_Regular'] text-stone-800">The Garden</h1>
              </div>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-stone-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-stone-600" />
              ) : (
                <Menu className="w-6 h-6 text-stone-600" />
              )}
            </button>

            {/* Desktop navigation */}
            <div className="hidden lg:flex items-center gap-6">
              <nav className="flex gap-6">
                <button
                  onClick={() => handleNavigation('my-bookings')}
                  className={`text-sm font-regular transition-colors ${
                    currentPage === 'my-bookings' 
                      ? 'text-emerald-900 font-medium' 
                      : 'text-stone-600 hover:text-emerald-900'
                  }`}
                >
                  My Account
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleNavigation('admin')}
                    className="bg-emerald-900 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors text-sm font-regular"
                  >
                    Admin Panel
                  </button>
                )}
              </nav>
              <button 
                onClick={handleSignOut}
                className="bg-stone-100 text-stone-700 px-6 py-2 hover:bg-stone-200 transition-colors text-sm font-regular rounded-lg border border-stone-200"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div 
            className={`lg:hidden transition-all duration-300 ease-in-out ${
              isMobileMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
            } overflow-hidden`}
          >
            <div className="py-4 space-y-4 border-t border-stone-200">
              <button
                onClick={() => handleNavigation('my-bookings')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'my-bookings' 
                    ? 'bg-emerald-50 text-emerald-900 font-medium' 
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                My Account
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleNavigation('admin')}
                  className="w-full text-left bg-emerald-900 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors text-sm font-regular"
                >
                  Admin Panel
                </button>
              )}
              <button 
                onClick={handleSignOut}
                className="w-full text-left bg-stone-100 text-stone-700 px-4 py-2 hover:bg-stone-200 transition-colors text-sm font-regular rounded-lg border border-stone-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative">
        <Routes>
          <Route path="/" element={<Book2Page />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/payment" element={<PaymentPage />} />
        </Routes>
      </main>

      <WhitelistWelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleWelcomeClose}
      />
    </div>
  );
}