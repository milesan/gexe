import React, { useState } from 'react';
import { Sprout } from 'lucide-react';
import { MyBookings } from './MyBookings';
import { Book2Page } from '../pages/Book2Page';
import { AdminPage } from '../pages/AdminPage';
import { ConfirmationPage } from '../pages/ConfirmationPage';
import { useSession } from '../hooks/useSession';
import { supabase } from '../lib/supabase';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { PaymentPage } from '../pages/PaymentPage';

export function AuthenticatedApp() {
  const [currentPage, setCurrentPage] = useState<'calendar' | 'my-bookings' | 'admin'>('calendar');
  const session = useSession();
  const navigate = useNavigate();
  const isAdmin = session?.user?.email === 'andre@thegarden.pt';

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      // Force a full page reload to clear all state
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // If no session, redirect to home
  if (!session) {
    return <Navigate to="/" replace />;
  }

  const handleNavigation = (page: 'calendar' | 'my-bookings' | 'admin') => {
    setCurrentPage(page);
    navigate(page === 'calendar' ? '/' : `/${page}`);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-50 bg-white border-b border-stone-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-emerald-900 flex items-center gap-3">
              <Sprout className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-display font-light tracking-wide">The Garden</h1>
                <p className="text-sm text-stone-600 hidden md:block">Escape to reality</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <nav className="flex gap-6">
                <button
                  onClick={() => handleNavigation('calendar')}
                  className={`text-sm font-body transition-colors ${
                    currentPage === 'calendar' 
                      ? 'text-emerald-900 font-medium' 
                      : 'text-stone-600 hover:text-emerald-900'
                  }`}
                >
                  Calendar
                </button>
                <button
                  onClick={() => handleNavigation('my-bookings')}
                  className={`text-sm font-body transition-colors ${
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
                    className={`text-sm font-body transition-colors ${
                      currentPage === 'admin' 
                        ? 'text-emerald-900 font-medium' 
                        : 'text-stone-600 hover:text-emerald-900'
                    }`}
                  >
                    Admin
                  </button>
                )}
              </nav>
              <button 
                onClick={handleSignOut}
                className="bg-emerald-900 text-white px-6 py-2 hover:bg-emerald-800 transition-colors text-sm font-body pixel-corners"
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
          {isAdmin && <Route path="/admin" element={<AdminPage />} />}
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/payment" element={<PaymentPage />} />
        </Routes>
      </main>
    </div>
  );
}