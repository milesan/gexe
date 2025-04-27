import React, { useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Week } from '../types/calendar';
import { Calendar, X } from 'lucide-react';
// import { DayPicker } from 'react-day-picker'; // No longer used directly
import { normalizeToUTCDate, formatDateForDisplay } from '../utils/dates';
import 'react-day-picker/dist/style.css'; // Keep if needed elsewhere, but DayPicker isn't rendered here
import { motion, AnimatePresence } from 'framer-motion'; // Added
import { createPortal } from 'react-dom'; // Added

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

  // Early return if not open or no dates
  // No changes needed to this logic block
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
    onClose(); // Close modal after selection
  };

  const handleClose = () => {
    console.log('[FlexibleCheckInModal] Modal closed without selection:', {
      weekId: week.id,
      availableDatesCount: week.flexibleDates?.length
    });
    onClose();
  };

  // Render using createPortal and framer-motion
  return createPortal(
    <AnimatePresence>
      {isOpen && ( // Ensure motion components are only rendered when isOpen is true
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Use styles from DiscountModal overlay
          className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={handleClose} // Close when clicking overlay
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            // Use styles from DiscountModal container
            className="bg-[var(--color-bg-surface)] rounded-sm p-4 sm:p-6 max-w-md w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 color-text-primary backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            {/* Use header structure from DiscountModal */}
            <button
              onClick={handleClose}
              // Use styles from DiscountModal close button
              className="absolute top-2 sm:top-4 right-2 sm:right-4 color-shade-2 hover:color-text-primary"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base sm:text-lg font-display color-text-primary mb-4 sm:mb-6">
              Select Check-in Date
            </h3>

            {/* Content Area */}
            <div className="space-y-3 sm:space-y-4">
              <p className="color-shade-1 text-xs sm:text-sm font-mono mb-4">
                This week offers multiple check-in dates. Please select your preferred day.
              </p>

              {/* Map over normalized dates for buttons */}
              <div className="space-y-2">
                {normalizedFlexDates.map((date) => (
                  <button
                    key={formatDateForDisplay(date)}
                    onClick={() => handleDateSelect(date)}
                    // Updated button styles (blend of original and DiscountModal's vibe)
                    className="w-full flex items-center gap-3 p-3 text-left border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-surface-raised)] hover:bg-[var(--color-bg-surface-hover)] hover:border-accent-primary transition-all duration-150 font-mono color-text-primary"
                  >
                    <Calendar className="w-4 h-4 text-accent-primary flex-shrink-0" />
                    <span className="font-medium text-sm">{formatInTimeZone(date, 'UTC', 'EEEE, MMMM d')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional: Add a cancel button at the bottom if desired, like DiscountModal */}
            {/* <div className="mt-6 flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 color-shade-2 hover:color-text-primary transition-colors font-mono text-sm"
              >
                Cancel
              </button>
            </div> */}
            
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body // Render into the body tag
  );
} 
