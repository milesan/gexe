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

  const handleDateSelect = (selectedUTCDate: Date) => {
    // --- Log the originally clicked date object (which IS the normalized UTC date here) ---
    console.log('[DATE_TRACE] FlexibleCheckInModal: Date clicked (already normalized):', { dateObj: selectedUTCDate, iso: selectedUTCDate?.toISOString?.() });

    // const normalizedDate = normalizeToUTCDate(date); // REMOVED: This was redundant

    // --- Log the normalized date before sending (it's just selectedUTCDate now) ---
    // Renamed variable in log for clarity
    console.log('[DATE_TRACE] FlexibleCheckInModal: Using date before sending:', { dateObj: selectedUTCDate, iso: selectedUTCDate?.toISOString?.() });

    console.log('[FlexibleCheckInModal] Check-in date selected:', {
      weekId: week.id,
      selectedDate: formatDateForDisplay(selectedUTCDate), // Use selectedUTCDate
      availableDates: week.flexibleDates?.map(d => formatDateForDisplay(d)),
      isValidSelection: week.flexibleDates?.some(d =>
        isSameDay(normalizeToUTCDate(d), selectedUTCDate) // Use selectedUTCDate
      )
    });

    // Pass the already normalized date and the week to the parent component
    onDateSelect(selectedUTCDate, week); // Use selectedUTCDate
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
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-gray-500/30 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white font-regular">Select Check-in Date</h2>
          <button 
            onClick={handleClose}
            className="text-gray-300 hover:text-white rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-300 mb-4 font-regular">
          This week offers multiple check-in dates. Please select your preferred check-in date.
        </p>
        
        <div className="space-y-2">
          {normalizedFlexDates.map((date) => (
            <button
              key={formatDateForDisplay(date)}
              onClick={() => handleDateSelect(date)}
              className="w-full p-3 text-left border border-gray-600 rounded-lg bg-gray-700/50 hover:bg-gray-600/70 hover:border-accent-primary transition-colors font-regular text-white"
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
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors font-regular"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 