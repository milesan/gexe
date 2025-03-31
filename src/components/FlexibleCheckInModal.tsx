import React, { useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Week } from '../types/calendar';
import { Calendar, X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { normalizeToUTCDate, formatDateForDisplay } from '../utils/dates';
import 'react-day-picker/dist/style.css';

interface Props {
  week: Week;
  isOpen: boolean;
  onClose: () => void;
  onDateSelect: (date: Date, week: Week) => void;
}

export function FlexibleCheckInModal({ week, isOpen, onClose, onDateSelect }: Props) {
  useEffect(() => {
    if (isOpen && week.flexibleDates?.length) {
      console.log('[FlexibleCheckInModal] Opening modal with flexible dates:', {
        weekId: week.id,
        weekStartDate: formatDateForDisplay(week.startDate),
        weekEndDate: formatDateForDisplay(week.endDate),
        availableDates: week.flexibleDates.map(d => formatDateForDisplay(d)),
        flexDatesCount: week.flexibleDates.length
      });
    }
  }, [isOpen, week]);

  if (!isOpen || !week.flexibleDates?.length) return null;

  // Normalize dates once at the component level
  const normalizedFlexDates = week.flexibleDates
    .map(date => normalizeToUTCDate(date))
    // Sort the dates chronologically 
    .sort((a, b) => a.getTime() - b.getTime());

  const handleDateSelect = (date: Date) => {
    // --- Log the originally clicked date object --- 
    console.log('[DATE_TRACE] FlexibleCheckInModal: Date clicked (raw):', { dateObj: date, iso: date?.toISOString?.() });

    const normalizedDate = normalizeToUTCDate(date);

    // --- Log the normalized date before sending --- 
    console.log('[DATE_TRACE] FlexibleCheckInModal: Normalized date before sending:', { dateObj: normalizedDate, iso: normalizedDate?.toISOString?.() });
    
    console.log('[FlexibleCheckInModal] Check-in date selected:', {
      weekId: week.id,
      selectedDate: formatDateForDisplay(normalizedDate),
      availableDates: week.flexibleDates?.map(d => formatDateForDisplay(d)),
      isValidSelection: week.flexibleDates?.some(d => 
        isSameDay(normalizeToUTCDate(d), normalizedDate)
      )
    });

    // Pass both the date and the week to the parent component
    onDateSelect(normalizedDate, week);
    onClose();
  };

  const handleClose = () => {
    console.log('[FlexibleCheckInModal] Modal closed without selection:', {
      weekId: week.id,
      availableDatesCount: week.flexibleDates?.length
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface dark:bg-surface/95 light:bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-primary font-regular">Select Check-in Date</h2>
          <button 
            onClick={handleClose}
            className="text-secondary hover:text-primary rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-secondary mb-4 font-regular">
          This week offers multiple check-in dates. Please select your preferred check-in date.
        </p>
        
        <div className="space-y-2">
          {normalizedFlexDates.map((date) => (
            <button
              key={formatDateForDisplay(date)}
              onClick={() => handleDateSelect(date)}
              className="w-full p-3 text-left border border-border rounded-lg bg-main hover:bg-[color-mix(in_srgb,_var(--color-accent-primary)_15%,_var(--color-bg-main))] hover:border-accent-primary transition-colors font-regular text-primary"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent-primary" />
                <span className="font-medium">{formatInTimeZone(date, 'UTC', 'EEEE, MMMM d')}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-secondary hover:text-primary transition-colors font-regular"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 