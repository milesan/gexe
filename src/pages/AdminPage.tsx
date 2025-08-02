import React, { useState } from 'react';
import { Applications2 } from '../components/admin/Applications2';
import { ApplicationsTable } from '../components/admin/ApplicationsTable';
import { AppView } from '../components/admin/AppView';
import { BookingsList } from '../components/BookingsList';
import { InventoryCalendar } from '../components/InventoryCalendar';
import { Weekly } from '../components/admin/Weekly';
import { Whitelist } from '../components/admin/Whitelist';
import { Housekeeping } from '../components/admin/Housekeeping';
import { Accommodations } from '../components/admin/Accommodations';
import { ApplicationQuestionsManager } from '../components/admin/ApplicationQuestionsManager';
import { DiscountCodesManager } from '../components/admin/DiscountCodesManager';
import { ClipboardList, Calendar, Users, LayoutGrid, ListChecks, UserPlus, Home, Building2, ArrowLeft, HelpCircle, Percent, Table } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

type AdminView = 'applications' | 'applications-table' | 'appview' | 'bookings' | 'calendar' | 'weekly' | 'whitelist' | 'housekeeping' | 'accommodations' | 'questions' | 'discounts';

interface AdminPageProps {
  housekeepingOnly?: boolean;
}

export function AdminPage({ housekeepingOnly = false }: AdminPageProps) {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<AdminView>(housekeepingOnly ? 'housekeeping' : 'applications');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [showHousekeeping, setShowHousekeeping] = useState(housekeepingOnly);

  // If housekeepingOnly mode, only show housekeeping view
  if (housekeepingOnly) {
    return (
      <div className="min-h-screen bg-black/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-light text-[var(--color-text-primary)]">Housekeeping Dashboard</h1>
            <p className="text-[var(--color-text-secondary)] font-mono">View check-ins and check-outs</p>
          </div>
          <Housekeeping onClose={() => navigate('/')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-light text-[var(--color-text-primary)]">Admin Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] font-mono">Manage applications, bookings, and availability</p>
        </div>

        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setCurrentView('applications')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'applications'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Users className="w-4 h-4" />
            Applications
          </button>
          <button
            onClick={() => setCurrentView('applications-table')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'applications-table'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Table className="w-4 h-4" />
            Table View
          </button>
          <button
            onClick={() => setCurrentView('appview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap font-mono text-sm ${
              currentView === 'questions'
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Questions
          </button>
        </div>

        <div className="bg-[var(--color-bg-main)]  shadow-sm">
          {currentView === 'applications' && <Applications2 />}
          {currentView === 'applications-table' && <ApplicationsTable />}
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
    </div>
  );
}
