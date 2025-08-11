import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { ViewMode } from './types';

interface Props {
  viewMode: ViewMode;
  currentWeekStart: Date;
  currentMonth: Date;
  daysToShow: Date[];
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onClose: () => void;
  onSaveScroll: () => void;
}

export function CalendarHeader({
  viewMode,
  currentWeekStart,
  currentMonth,
  daysToShow,
  onViewModeChange,
  onNavigate,
  onClose,
  onSaveScroll
}: Props) {
  return (
    <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-surface)]">
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            onSaveScroll();
            onNavigate('prev');
          }}
          className="p-2 hover:bg-[var(--color-bg-surface-hover)] rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-display font-light text-[var(--color-text-primary)]">
          {viewMode === 'week' 
            ? `${formatInTimeZone(currentWeekStart, 'UTC', 'MMM d')} - ${formatInTimeZone(daysToShow[6], 'UTC', 'MMM d, yyyy')}`
            : formatInTimeZone(currentMonth, 'UTC', 'MMMM yyyy')
          }
        </h2>
        <button
          onClick={() => {
            onSaveScroll();
            onNavigate('next');
          }}
          className="p-2 hover:bg-[var(--color-bg-surface-hover)] rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        <div className="ml-4 flex items-center gap-2 border-l border-[var(--color-border)] pl-4">
          <button
            onClick={() => {
              onSaveScroll();
              onViewModeChange('week');
            }}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'week' 
                ? 'bg-emerald-500 text-white' 
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => {
              onSaveScroll();
              onViewModeChange('month');
            }}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'month' 
                ? 'bg-emerald-500 text-white' 
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        className="p-2 hover:bg-[var(--color-bg-surface-hover)] rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  );
}