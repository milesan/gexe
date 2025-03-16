import React, { useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { Week } from '../types/calendar';
import { Calendar } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { normalizeToUTCDate, formatDateForDisplay } from '../utils/dates';
import 'react-day-picker/dist/style.css';

interface Props {
  week: Week;
  isOpen: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
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
    const normalizedDate = normalizeToUTCDate(date);
    console.log('[FlexibleCheckInModal] Check-in date selected:', {
      weekId: week.id,
      selectedDate: formatDateForDisplay(normalizedDate),
      availableDates: week.flexibleDates?.map(d => formatDateForDisplay(d)),
      isValidSelection: week.flexibleDates?.some(d => 
        isSameDay(normalizeToUTCDate(d), normalizedDate)
      )
    });

    onDateSelect(normalizedDate);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Select Check-in Date</h2>
        <p className="text-gray-600 mb-4">
          This week offers multiple check-in dates. Please select your preferred check-in date.
        </p>
        
        <div className="space-y-2">
          {normalizedFlexDates.map((date) => (
            <button
              key={formatDateForDisplay(date)}
              onClick={() => handleDateSelect(date)}
              className="w-full p-3 text-left border rounded-lg hover:bg-emerald-50 hover:border-emerald-500 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{format(date, 'EEEE, MMMM d')}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 