import React, { useState, useEffect, useCallback } from 'react';
import { isSameDay } from 'date-fns';
import { Week, WeekStatus } from '../../types/calendar';
import { 
  formatDateForDisplay, 
  normalizeToUTCDate, 
  isDateInWeek
} from '../../utils/dates';
import { safeParseDate } from '../../utils/dates';
import { AlertTriangle, Info, Calendar } from 'lucide-react';
import { CalendarService } from '../../services/CalendarService';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

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
 * - Modify the start and end dates
 * - Enable/disable flexible check-in dates
 * - Select specific flexible check-in dates
 * - Reset a customized week to default
 */
export function WeekCustomizationModal({ week, isOpen = true, onClose, onSave, onDelete }: Props) {
  // State for form fields
  const [startDate, setStartDate] = useState(formatDateForDisplay(week.startDate));
  const [endDate, setEndDate] = useState(formatDateForDisplay(week.endDate));
  const [status, setStatus] = useState<WeekStatus>(
    week?.status === 'default' ? 'visible' : week?.status || 'default'
  );
  const [name, setName] = useState(week?.name || '');
  
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
    
    const start = safeParseDate(startDate);
    const end = safeParseDate(endDate);
    
    // Check if dates align with check-in/check-out days
    if (start.getDay() !== calendarConfig.checkInDay) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      setDateWarning(`Start date should be a ${dayNames[calendarConfig.checkInDay]} (check-in day)`);
    } else if (end.getDay() !== calendarConfig.checkOutDay) {
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
    
    const start = safeParseDate(startDate);
    const end = safeParseDate(endDate);
    
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
      const normalizedStartDate = safeParseDate(startDate);
      const normalizedEndDate = safeParseDate(endDate);
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
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        flexibleDates: isFlexibleCheckin ? normalizedFlexDates : []
      };
      
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
    const normalizedDates = Array.isArray(dates) 
      ? dates.map(d => normalizeToUTCDate(d))
      : [];
    
    // Check if the selection has changed
    const hasChanged = normalizedDates.length !== selectedFlexDates.length ||
      normalizedDates.some(d => !selectedFlexDates.some(sd => isSameDay(sd, d)));
    
    setSelectedFlexDates(normalizedDates);
    
    if (hasChanged) {
      setHasFlexDatesChanged(true);
      setFlexDatesWarning(null);
    }
  };

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Customize Week</h2>
        
        {/* Status Hint */}
        {getStatusHint()}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Status Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WeekStatus)}
            className="w-full p-2 border rounded"
          >
            <option value="visible">Available</option>
            <option value="hidden">Hidden</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        {/* Week Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Week Name (Optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Christmas Week"
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setError(null);
              }}
              className={`w-full p-2 border rounded ${dateWarning && dateWarning.includes('Start date') ? 'border-yellow-400' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setError(null);
              }}
              className={`w-full p-2 border rounded ${dateWarning && dateWarning.includes('End date') ? 'border-yellow-400' : ''}`}
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
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="text-sm font-medium text-gray-700">Enable Flexible Check-in Dates</span>
          </label>
        </div>

        {/* Flexible Check-in Date Picker */}
        {isFlexibleCheckin && (
          <div className="mb-4">
            <DayPicker
              mode="multiple"
              selected={selectedFlexDates}
              defaultMonth={safeParseDate(startDate)}
              onSelect={handleFlexDatesSelect}
              disabled={[
                { before: safeParseDate(startDate) },
                { after: safeParseDate(endDate) }
              ]}
              className="border-0"
            />
          </div>
        )}

        {/* Date Warning */}
        {dateWarning && !isFlexibleCheckin && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md text-sm">
            <div className="flex items-center">
              <Info className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{dateWarning}</span>
            </div>
            <p className="mt-1 ml-6">
              Changing this date may affect how weeks are displayed in the calendar.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          {/* Reset to Default button - only show for customized weeks */}
          {week.isCustom && onDelete && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-4 py-2 text-red-600 hover:text-red-800 mr-auto"
              title="Remove customization and reset to default week"
            >
              Reset to Default
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (isFlexibleCheckin && selectedFlexDates.length === 0 && !hasFlexDatesChanged)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
