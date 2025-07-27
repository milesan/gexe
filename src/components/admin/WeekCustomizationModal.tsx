import React, { useState, useEffect, useCallback } from 'react';
import { isSameDay } from 'date-fns';
import { Week, WeekStatus } from '../../types/calendar';
import { 
  formatDateForDisplay, 
  normalizeToUTCDate, 
  localDayToUTCMidnight,
  isDateInWeek,
  utcToLocalMidnight
} from '../../utils/dates';
import { AlertTriangle, Info, Calendar, X } from 'lucide-react';
import { CalendarService } from '../../services/CalendarService';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import './WeekCustomizationModal.css'; // Import custom CSS for DayPicker

/**
 * Props for the WeekCustomizationModal component
 */
interface Props {
  week: Week;
  isOpen?: boolean;
  onClose: () => void;
  onSave: (updates: {
    status: WeekStatus;
    name?: string;
    link?: string;
    startDate?: Date;
    endDate?: Date;
    flexibleDates?: Date[];
  }) => Promise<void>;
  onDelete?: (weekId: string) => Promise<void>;
}

/**
 * WeekCustomizationModal - A modal for customizing a week's properties
 * 
 * This component allows admins to:
 * - Change a week's status (visible, hidden, deleted)
 * - Set a custom name for the week
 * - Add an optional link associated with the name
 * - Modify the start and end dates
 * - Enable/disable flexible check-in dates
 * - Select specific flexible check-in dates
 * - Reset a customized week to default
 */
export function WeekCustomizationModal({ week, isOpen = true, onClose, onSave, onDelete }: Props) {
  console.log("Modal received week:", {
    id: week.id,
    name: week.name,
    link: week.link,
    flexDates: week.flexibleDates?.map(d => d?.toISOString())
  });

  // State for form fields
  const [startDate, setStartDate] = useState(formatDateForDisplay(week.startDate));
  const [endDate, setEndDate] = useState(formatDateForDisplay(week.endDate));
  const [status, setStatus] = useState<WeekStatus>(
    week?.status === 'default' ? 'visible' : week?.status || 'default'
  );
  const [name, setName] = useState(week?.name || '');
  const [link, setLink] = useState(week?.link || '');
  
  // State for flexible check-in dates
  const [isFlexibleCheckin, setIsFlexibleCheckin] = useState(
    Array.isArray(week.flexibleDates) && week.flexibleDates.length > 0
  );
  const [selectedFlexDates, setSelectedFlexDates] = useState<Date[]>(
    week.flexibleDates?.map(d => normalizeToUTCDate(d)) || []
  );
  const [hasFlexDatesChanged, setHasFlexDatesChanged] = useState(false);
  
  // State for validation and UI feedback
  const [error, setError] = useState<string | null>(null);
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [flexDatesWarning, setFlexDatesWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Calendar configuration
  const [calendarConfig, setCalendarConfig] = useState<{ 
    checkInDay: number; 
    checkOutDay: number 
  } | null>(null);

  // Fetch calendar config on mount
  useEffect(() => {
    async function fetchCalendarConfig() {
      try {
        const config = await CalendarService.getConfig();
        if (config) {
          setCalendarConfig(config);
        }
      } catch (err) {
        console.error('[WeekCustomizationModal] Error fetching calendar config:', err);
      }
    }
    
    if (isOpen) {
      fetchCalendarConfig();
    }
  }, [isOpen]);

  // Validate dates when they change or when calendar config changes
  useEffect(() => {
    if (!calendarConfig) return;
    
    const start = normalizeToUTCDate(startDate);
    const end = normalizeToUTCDate(endDate);
    
    // Check if dates align with check-in/check-out days
    if (start.getUTCDay() !== calendarConfig.checkInDay) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      setDateWarning(`Start date should be a ${dayNames[calendarConfig.checkInDay]} (check-in day)`);
    } else if (end.getUTCDay() !== calendarConfig.checkOutDay) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      setDateWarning(`End date should be a ${dayNames[calendarConfig.checkOutDay]} (check-out day)`);
    } else {
      setDateWarning(null);
    }
  }, [startDate, endDate, calendarConfig]);

  // Validate flexible dates when they change
  useEffect(() => {
    if (!isFlexibleCheckin || selectedFlexDates.length === 0) {
      setFlexDatesWarning(null);
      return;
    }
    
    const start = normalizeToUTCDate(startDate);
    const end = normalizeToUTCDate(endDate);
    
    // Check if all selected dates are within the week
    const invalidDates = selectedFlexDates.filter(date => {
      const normalizedDate = normalizeToUTCDate(date);
      return normalizedDate < start || normalizedDate > end;
    });

    setFlexDatesWarning(
      invalidDates.length > 0 ? 'Some selected dates are outside the week range' : null
    );
  }, [isFlexibleCheckin, selectedFlexDates, startDate, endDate]);

  // Handle form submission
  const handleSave = useCallback(async () => {
    try {
      // Parse and normalize dates
      const normalizedStartDate = normalizeToUTCDate(startDate);
      const normalizedEndDate = normalizeToUTCDate(endDate);
      const normalizedFlexDates = selectedFlexDates.map(date => normalizeToUTCDate(date));

      // Validate dates
      if (normalizedStartDate > normalizedEndDate) {
        setError('Start date cannot be after end date');
        return;
      }

      // Validate flexible dates
      if (isFlexibleCheckin && selectedFlexDates.length === 0 && !hasFlexDatesChanged) {
        setError('Please select at least one check-in date');
        return;
      }

      if (isFlexibleCheckin && flexDatesWarning) {
        setError(flexDatesWarning);
        return;
      }

      setIsSaving(true);
      
      // Prepare updates
      const updates = {
        status,
        name: name.trim() || undefined,
        link: link.trim() || undefined,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        flexibleDates: isFlexibleCheckin ? normalizedFlexDates : []
      };
      
      console.log("[WeekCustomizationModal] Updates being sent:", updates);
      
      // Save changes
      await onSave(updates);
      onClose();
    } catch (error) {
      setError('Failed to save changes');
      console.error('[WeekCustomizationModal] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    week, 
    startDate, 
    endDate, 
    status, 
    name, 
    link,
    selectedFlexDates, 
    isFlexibleCheckin, 
    onSave, 
    onClose, 
    hasFlexDatesChanged, 
    flexDatesWarning
  ]);

  // Handle deleting a customization (resetting to default)
  const handleDelete = useCallback(async () => {
    if (!week.isCustom || !week.id || !onDelete) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Call the onDelete callback with the week ID
      await onDelete(week.id);
      onClose();
    } catch (error) {
      setError('Failed to reset week to default');
      console.error('[WeekCustomizationModal] Delete error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [week, onDelete, onClose]);

  // Handle flexible check-in toggle
  const handleFlexibleCheckInToggle = (checked: boolean) => {
    setIsFlexibleCheckin(checked);
    
    if (!checked) {
      // Clear selected dates when disabling
      setSelectedFlexDates([]);
      setFlexDatesWarning(null);
      setHasFlexDatesChanged(true);
    } else {
      // If enabling flexible check-in and there were previously flex dates, consider it changed
      setHasFlexDatesChanged(week.flexibleDates?.length !== 0);
    }
  };
   // Handle flexible dates selection
  const handleFlexDatesSelect = (dates: Date[] | undefined) => {
    console.log("--- DayPicker onSelect ---");
    console.log("Raw dates from picker:", dates?.map(d => d?.toString()));
    console.log("Raw ISO dates from picker:", dates?.map(d => d?.toISOString()));

    const convertedDates = Array.isArray(dates)
      ? dates.map(d => {
          const converted = localDayToUTCMidnight(d);
          console.log(`Converting local ${d?.toString()} -> ${converted?.toISOString()}`);
          return converted;
        }).filter(d => d !== null) as Date[]
      : [];

    console.log("Converted dates for state:", convertedDates.map(d => d?.toISOString()));
    console.log("--- End DayPicker onSelect ---");

    const currentTimestamps = selectedFlexDates.map(d => d.getTime()).sort();
    const newTimestamps = convertedDates.map(d => d.getTime()).sort();
    const hasChanged = currentTimestamps.length !== newTimestamps.length ||
                       currentTimestamps.some((ts, index) => ts !== newTimestamps[index]);

    setSelectedFlexDates(convertedDates);

    if (hasChanged) {
      setHasFlexDatesChanged(true);
      setFlexDatesWarning(null);
    }
  };

  // Update DayPicker's disabled prop to ensure consistency
  const disabledBounds = {
      before: utcToLocalMidnight(normalizeToUTCDate(startDate)),
      after: utcToLocalMidnight(normalizeToUTCDate(endDate))
  };

  // Construct the disabled matcher object, ensuring both before and after are defined
  const disabledMatcher: { before: Date; after: Date } = {
      before: (disabledBounds.before && !isNaN(disabledBounds.before.getTime())) 
                  ? disabledBounds.before 
                  : new Date(0), // Use epoch if no valid 'before' date
      after: (disabledBounds.after && !isNaN(disabledBounds.after.getTime()))
                 ? disabledBounds.after
                 : new Date(8640000000000000) // Use max date if no valid 'after' date
  };

  // Add logging to verify disabled bounds calculation
  console.log("--- DayPicker Disabled Bounds ---");
  console.log("Start Date String:", startDate);
  console.log("End Date String:", endDate);
  // Add checks for null before calling toISOString
  const normalizedStartLog = normalizeToUTCDate(startDate);
  const normalizedEndLog = normalizeToUTCDate(endDate);
  console.log("Normalized Start UTC:", normalizedStartLog ? normalizedStartLog.toISOString() : 'Invalid/Null');
  console.log("Normalized End UTC:", normalizedEndLog ? normalizedEndLog.toISOString() : 'Invalid/Null');
  // Add checks for null before calling toString
  console.log("Calculated 'before' boundary (Local):", disabledBounds.before ? disabledBounds.before.toString() : 'Invalid/Null');
  // Get status hint for UI
  const getStatusHint = () => {
    if (week?.status === 'deleted') {
      return (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span className="font-medium">This week is already deleted</span>
          </div>
          <p className="mt-1 text-sm">
            Setting this week to "deleted" again will have no effect.
          </p>
        </div>
      );
    } else if (week?.status === 'hidden') {
      return (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md">
          <div className="flex items-center">
            <Info className="h-5 w-5 mr-2" />
            <span className="font-medium">This week is currently hidden</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  // Base modal classes (consistent with DiscountModal)
  const modalOverlayClasses = "fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4"; // Match DiscountModal
  const contentContainerClasses = "bg-gray-800/95 rounded-sm p-4 sm:p-6 max-w-md w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 text-white backdrop-blur-sm"; // Match DiscountModal styling
  const contentPaddingClasses = ""; // Padding now part of contentContainerClasses
  const contentBgClasses = ""; // Background now part of contentContainerClasses
  const textBaseClasses = "text-white font-mono"; // Simplified dark styles
  const textMutedClasses = "text-gray-300 font-mono"; // Simplified dark styles
  const inputBaseClasses = "w-full p-2 border rounded bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400 disabled:opacity-50"; // Simplified dark styles, removed redundant dark prefixes
  const buttonBaseClasses = "px-4 py-2 rounded disabled:opacity-50 font-mono focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonClasses = `${buttonBaseClasses} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-blue-400`; // Removed redundant dark styles
  const secondaryButtonClasses = `${buttonBaseClasses} text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 focus:ring-gray-400 border border-gray-600`; // Added border, simplified dark styles
  const dangerButtonClasses = `${buttonBaseClasses} text-red-400 hover:text-red-300 focus:ring-red-400 border border-transparent hover:border-red-500/50 mr-auto`; // Simplified dark styles, added hover border
  const closeButtonClasses = "absolute top-2 sm:top-4 right-2 sm:right-4 text-gray-300 hover:text-white"; // Add this for consistency

  console.log("State before render - selectedFlexDates (UTC):", selectedFlexDates.map(d => d?.toISOString()));
  const datesForPicker = selectedFlexDates.map(d => utcToLocalMidnight(d));
  console.log("Dates passed to DayPicker selected prop (Local):", datesForPicker.map(d => d?.toString()));

  return (
    <div className={modalOverlayClasses} onClick={onClose}>
      {/* Outer container for sizing, scrolling, and base background/border */}
      <div 
        className={`${contentContainerClasses} ${textBaseClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inner container for padding - REMOVED */}
        {/* <div className={contentPaddingClasses}> */} 

          {/* Add Close Button */}
          <button onClick={onClose} className={closeButtonClasses} disabled={isSaving}>
            <X className="h-5 w-5" />
          </button>

          <h2 className={`text-xl font-bold mb-4 font-mono ${textBaseClasses}`}>Customize Week</h2>
          
          {/* Status Hint - Apply dark theme styles */}
          {getStatusHint()} {/* Assume getStatusHint will handle its own dark styles if needed */}

          {/* Error Message - Apply dark theme styles */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 rounded-md">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span className="font-mono">{error}</span>
              </div>
            </div>
          )}

          {/* Status Selection */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 font-mono ${textMutedClasses}`}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WeekStatus)}
              className={`${inputBaseClasses} font-mono`}
            >
              <option value="visible">Available</option>
              <option value="hidden">Hidden</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          {/* Week Name */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 font-mono ${textMutedClasses}`}>
              Week Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Christmas Week"
              className={`${inputBaseClasses} font-mono`}
            />
          </div>

          {/* Link (Optional) */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 font-mono ${textMutedClasses}`}>
              Link (Optional) - requires a Week Name
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="e.g., https://example.com/event-details"
              className={`${inputBaseClasses} font-mono`}
              disabled={!name.trim()}
              title={!name.trim() ? "A week name must be set to add a link." : ""}
            />
            {!name.trim() && link.trim() && (
              <p className="mt-1 text-xs text-yellow-400 font-mono">A week name is required to save the link.</p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <label className={`block text-sm font-medium mb-1 font-mono ${textMutedClasses}`}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setError(null);
                }}
                // Apply input base styles + specific warning styles
                className={`${inputBaseClasses} font-mono ${
                  dateWarning && dateWarning.includes('Start date') 
                    ? 'border-yellow-400 dark:border-yellow-600' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 font-mono ${textMutedClasses}`}>
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setError(null);
                }}
                // Apply input base styles + specific warning styles
                className={`${inputBaseClasses} font-mono ${
                  dateWarning && dateWarning.includes('End date') 
                    ? 'border-yellow-400 dark:border-yellow-600' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>
          </div>

          {/* Flexible Check-in Toggle */}
          <div className="mb-4 mt-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFlexibleCheckin}
                onChange={(e) => handleFlexibleCheckInToggle(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:bg-gray-700 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              />
              <span className={`text-sm font-medium font-mono ${textMutedClasses}`}>Enable Flexible Check-in Dates</span>
            </label>
          </div>

          {/* Flexible Check-in Date Picker */}
          {isFlexibleCheckin && (
            <div className="mb-4 react-day-picker-container">
              <DayPicker
                mode="multiple"
                selected={selectedFlexDates.map(d => utcToLocalMidnight(d))}
                defaultMonth={utcToLocalMidnight(normalizeToUTCDate(startDate))}
                onSelect={handleFlexDatesSelect}
                disabled={disabledMatcher}
                className="border-0"
                classNames={{
                  // Add any necessary class overrides here if base CSS isn't enough
                }}
              />
            </div>
          )}

          {/* Date Warning */}
          {dateWarning && !isFlexibleCheckin && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600/50 text-yellow-700 dark:text-yellow-300 rounded-md text-sm">
              <div className="flex items-center">
                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="font-mono">{dateWarning}</span>
              </div>
              <p className={`mt-1 ml-6 font-mono ${textMutedClasses}`}>
                Changing this date may affect how weeks are displayed in the calendar.
              </p>
            </div>
          )}
          
          {/* Flex Dates Warning */}
          {flexDatesWarning && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 rounded-md text-sm">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="font-mono">{flexDatesWarning}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            {/* Reset to Default button - only show for customized weeks */}
            {week.isCustom && onDelete && (
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className={dangerButtonClasses}
                title="Remove customization and reset to default week"
              >
                Reset to Default
              </button>
            )}
            <button
              onClick={onClose}
              className={secondaryButtonClasses}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (isFlexibleCheckin && selectedFlexDates.length === 0 && !hasFlexDatesChanged)}
              className={primaryButtonClasses}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        {/* </div> */}
      </div> {/* End content container */}
    </div>
  );
}

