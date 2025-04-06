import React, { useState } from 'react';
import { Applications2 } from '../components/admin/Applications2';
import { AppView } from '../components/admin/AppView';
import { BookingsList } from '../components/BookingsList';
import { InventoryCalendar } from '../components/InventoryCalendar';
import { Weekly } from '../components/admin/Weekly';
import { Whitelist } from '../components/admin/Whitelist';
import { Housekeeping } from '../components/admin/Housekeeping';
import { Accommodations } from '../components/admin/Accommodations';
import { ClipboardList, Calendar, Users, LayoutGrid, ListChecks, UserPlus, Home, Building2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

type AdminView = 'applications' | 'appview' | 'bookings' | 'calendar' | 'weekly' | 'whitelist' | 'accommodations';

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
          <p className="text-[var(--color-text-secondary)] font-regular">Manage applications, bookings, and availability</p>
        </div>

        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setCurrentView('applications')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-regular text-sm ${
              currentView === 'accommodations'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Accommodations
          </button>
        </div>

        <div className="bg-[var(--color-bg-main)] rounded-xl border border-[var(--color-border)] shadow-sm">
          {currentView === 'applications' && <Applications2 />}
          {currentView === 'appview' && <AppView />}
          {currentView === 'bookings' && <BookingsList />}
          {currentView === 'whitelist' && <Whitelist />}
          {currentView === 'accommodations' && <Accommodations />}
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
    </div>
  );
}