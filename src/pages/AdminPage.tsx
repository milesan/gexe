import React, { useState } from 'react';
import { Applications2 } from '../components/admin/Applications2';
import { AppView } from '../components/admin/AppView';
import { BookingsList } from '../components/BookingsList';
import { InventoryCalendar } from '../components/InventoryCalendar';
import { Weekly } from '../components/admin/Weekly';
import { Whitelist } from '../components/admin/Whitelist';
import { Housekeeping } from '../components/admin/Housekeeping';
import { Accommodations } from '../components/admin/Accommodations';
import { ApplicationQuestionsManager } from '../components/admin/ApplicationQuestionsManager';
import { DiscountCodesManager } from '../components/admin/DiscountCodesManager';
import { ClipboardList, Calendar, Users, LayoutGrid, ListChecks, UserPlus, Home, Building2, ArrowLeft, HelpCircle, Percent } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

type AdminView = 'applications' | 'appview' | 'bookings' | 'calendar' | 'weekly' | 'whitelist' | 'housekeeping' | 'accommodations' | 'questions' | 'discounts';

export function AdminPage() {
  const [currentView, setCurrentView] = useState<AdminView>('applications');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [showHousekeeping, setShowHousekeeping] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-light text-[var(--color-text-primary)]">Admin Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] font-mono">Manage applications, bookings, and availability</p>
        </div>

        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setCurrentView('applications')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'applications'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Users className="w-4 h-4" />
            Applications
          </button>
          <button
            onClick={() => setCurrentView('appview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'appview'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            AppView
          </button>
          <button
            onClick={() => setCurrentView('bookings')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'bookings'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Bookings
          </button>
          <button
            onClick={() => setShowCalendar(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              showCalendar
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setShowWeekly(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              showWeekly
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            Weekly
          </button>
          <button
            onClick={() => setShowHousekeeping(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              showHousekeeping
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Home className="w-4 h-4" />
            Housekeeping
          </button>
          <button
            onClick={() => setCurrentView('whitelist')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'whitelist'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Whitelist
          </button>
          <button
            onClick={() => setCurrentView('accommodations')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'accommodations'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Accommodations
          </button>
          <button
            onClick={() => setCurrentView('discounts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'discounts'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Percent className="w-4 h-4" />
            Discounts
          </button>
          <button
            onClick={() => setCurrentView('questions')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'questions'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Questions
          </button>
        </div>

        <div className="bg-[var(--color-bg-main)] rounded-xl border border-[var(--color-border)] shadow-sm">
          {currentView === 'applications' && <Applications2 />}
          {currentView === 'appview' && <AppView />}
          {currentView === 'bookings' && <BookingsList />}
          {currentView === 'whitelist' && <Whitelist />}
          {currentView === 'accommodations' && <Accommodations />}
          {currentView === 'questions' && <ApplicationQuestionsManager />}
          {currentView === 'discounts' && <DiscountCodesManager />}
        </div>

        <AnimatePresence>
          {showCalendar && (
            <InventoryCalendar onClose={() => setShowCalendar(false)} />
          )}
          {showWeekly && (
            <Weekly onClose={() => setShowWeekly(false)} />
          )}
          {showHousekeeping && (
            <Housekeeping onClose={() => setShowHousekeeping(false)} />
          )}
        </AnimatePresence>
      </div>

      <div className="md:hidden fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-8">
        <div className="text-center text-white max-w-sm">
          <h2 className="text-2xl font-display mb-4 text-accent-secondary animate-yellow-shift">
            Admin Area Not Fit for Small Screens Yet
          </h2>
          <p className="text-lg font-mono text-gray-200 mb-8">
            Wait until further development.
          </p>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 font-mono px-6 py-2 rounded-lg bg-accent-primary text-emerald-950 hover:bg-accent-secondary font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Booking
          </Link>
        </div>
      </div>

      <style>
        {`
          @keyframes yellow-shift {
            0%, 100% { color: var(--color-accent-secondary); }
            50% { color: #fde047; }
          }
          .animate-yellow-shift {
            animation: yellow-shift 3s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
}
