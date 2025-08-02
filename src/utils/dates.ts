import { addWeeks, startOfWeek, addDays, addMonths, setDay, startOfDay, isSameDay, endOfDay, isBefore, isAfter, subMonths, format, Day, parseISO, differenceInDays, startOfMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { convertToUTC1 } from './timezone';
import { CalendarConfig, Week, WeekCustomization, WeekStatus } from '../types/calendar';

// Helper function to check if a week is the blocked France event week (Sep 23-29, 2025)
export function isBlockedFranceEventWeek(week: Week): boolean {
  const startDate = week.startDate;
  const endDate = week.endDate;
  
  // Use UTC methods to avoid timezone issues
  const startMonth = startDate.getUTCMonth(); // 0-indexed, so September is 8
  const startDay = startDate.getUTCDate();
  const startYear = startDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endDay = endDate.getUTCDate();
  const endYear = endDate.getUTCFullYear();
  
  // Check if start date is Sep 23, 2025 and end date is Sep 29, 2025
  return (startMonth === 8 && startDay === 23 && startYear === 2025 && 
          endMonth === 8 && endDay === 29 && endYear === 2025);
}

// Helper function to check if there are any blocked weeks between two weeks
export function hasBlockedWeeksBetween(startWeek: Week, endWeek: Week, allWeeks: Week[]): boolean {
  // If we don't have access to all weeks, we can't check - allow the selection
  if (!allWeeks || allWeeks.length === 0) {
    return false;
  }
  
  // Find weeks that fall between startWeek and endWeek (exclusive)
  const betweenWeeks = allWeeks.filter(week => {
    return week.startDate.getTime() > startWeek.startDate.getTime() && 
           week.startDate.getTime() < endWeek.startDate.getTime();
  });
  
  // Check if any of these weeks are blocked
  return betweenWeeks.some(week => isBlockedFranceEventWeek(week));
}

// Helper function for consistent date formatting (using UTC)
export function formatDateOnly(date: Date): string {
    // Use formatInTimeZone to ensure we format based on UTC components
    // The input 'date' should already be normalized to UTC midnight by this point
    return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');
}

// Re-export the startOfDay function from date-fns
export { startOfDay };

// Returns the start of the month for a given date in UTC+0
export function startOfMonthUTC(date: Date): Date {
  // Create a new Date object in UTC
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  );
  // Return the UTC date directly (it's already at midnight UTC)
  return utcDate;
}

// Add months to a date while preserving UTC
export function addMonthsUTC(date: Date, months: number): Date {
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth();
  const utcDay = date.getUTCDate();
  
  // Calculate new month and year
  const newMonth = utcMonth + months;
  const newYear = utcYear + Math.floor(newMonth / 12);
  const normalizedMonth = ((newMonth % 12) + 12) % 12;
  
  // Handle edge cases for days (e.g., Jan 31 + 1 month = Feb 28/29)
  const daysInNewMonth = new Date(Date.UTC(newYear, normalizedMonth + 1, 0)).getUTCDate();
  const newDay = Math.min(utcDay, daysInNewMonth);
  
  return new Date(Date.UTC(newYear, normalizedMonth, newDay));
}

// Subtract months from a date while preserving UTC
export function subMonthsUTC(date: Date, months: number): Date {
  return addMonthsUTC(date, -months);
}

/**
 * Normalizes any date input into a Date object representing midnight UTC
 * on the **same calendar day** as perceived in the **UTC timezone**.
 *
 * Example: '2024-05-01T14:30:00Z' (May 1st UTC)
 * will result in a Date object representing '2024-05-01T00:00:00Z'.
 *
 * @param date The date to normalize (Date object or string parsable by `new Date()`)
 * @returns A new Date object representing midnight UTC, or an Invalid Date if input is invalid.
 */
export function normalizeToUTCDate(date: Date | string): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date;

  // Check for invalid date input
  if (isNaN(inputDate.getTime())) {
     console.warn('[normalizeToUTCDate] Received invalid date:', date);
     return new Date(NaN); // Return Invalid Date object
  }

  // Get calendar date components using UTC methods
  const utcYear = inputDate.getUTCFullYear();
  const utcMonth = inputDate.getUTCMonth(); // 0-indexed
  const utcDay = inputDate.getUTCDate();

  // Calculate the UTC timestamp corresponding to 00:00:00 on that UTC calendar day.
  const utcTimestamp = Date.UTC(utcYear, utcMonth, utcDay, 0, 0, 0, 0);
  
  // Create a new Date object from this specific UTC timestamp.
  const returnDate = new Date(utcTimestamp);

  return returnDate;
}

/**
 * Converts a Date object (typically from a date picker, representing local midnight)
 * into a Date object representing midnight UTC on the *same calendar day*
 * as perceived in the local timezone.
 * Use this when handling user input from date pickers that operate in local time.
 *
 * @param localDate The Date object representing a local calendar day (time component is ignored). Can be null or undefined.
 * @returns A new Date object representing midnight UTC for that local calendar day, or null if input is invalid/null/undefined.
 */
export function localDayToUTCMidnight(localDate: Date | null | undefined): Date | null {
  if (!localDate || isNaN(localDate.getTime())) {
    // Handle null, undefined, or invalid dates appropriately
    console.warn('[localDayToUTCMidnight] Received invalid/null date:', localDate);
    return null;
  }

  // Get calendar date components using the browser's local timezone interpretation
  const localYear = localDate.getFullYear();
  const localMonth = localDate.getMonth(); // 0-indexed
  const localDay = localDate.getDate();

  // Calculate the UTC timestamp corresponding to 00:00:00 on that local calendar day.
  const utcTimestamp = Date.UTC(localYear, localMonth, localDay, 0, 0, 0, 0);

  // Create a new Date object from this specific UTC timestamp.
  const returnDate = new Date(utcTimestamp);
  // console.log(`[localDayToUTCMidnight] Converted local ${localDate.toString()} -> ${returnDate.toISOString()}`);
  return returnDate;
}

/**
 * Format a date for display in logs and UI (YYYY-MM-DD) - always use UTC
 */
export function formatDateForDisplay(date: Date | null | undefined): string {
  if (!date) return 'null';
  if (isNaN(date.getTime())) {
    console.warn('[formatDateForDisplay] Received invalid date:', date);
    return 'invalid-date';
  }
  
  // If the date is already normalized to UTC midnight, format it directly
  // Use formatInTimeZone to guarantee UTC display
  return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');
}

/**
 * Format a date for display in UI with month and day (MMM d) - always use UTC
 */
export function formatDateShort(date: Date): string {
  // Use formatInTimeZone to guarantee UTC display
  return formatInTimeZone(normalizeToUTCDate(date), 'UTC', 'MMM d');
}

/**
 * Format a week's date range for display
 */
export function formatWeekRange(week: Week): string {
  return `${formatDateShort(week.startDate)} - ${formatDateShort(week.endDate)}`;
}

/**
 * Generate a unique ID for a week that's stable across timezones
 */
export function generateWeekId(startDate: Date): string {
  return `week-${formatDateForDisplay(startDate)}`;
}

/**
 * Generate a truly unique ID for a week that includes both start and end dates
 */
export function generateUniqueWeekId(startDate: Date, endDate: Date): string {
  return `week-${formatDateForDisplay(startDate)}-to-${formatDateForDisplay(endDate)}`;
}

export function generateWeeks(startDate: Date, count: number): Date[] {
  const weeks: Date[] = [];
  let currentDate = new Date(startDate);
  
  // For normal weeks, just generate the requested number
  while (weeks.length < count) {
    weeks.push(new Date(currentDate));
    currentDate = addDays(currentDate, 7);
  }
  
  return weeks;
}

export function generateSquigglePath(): string {
  const width = 100;
  const height = 30;
  const segments = 8;
  const segmentWidth = width / segments;
  
  let path = `M 0 ${height / 2}`;
  
  for (let i = 0; i < segments; i++) {
    const x1 = i * segmentWidth + segmentWidth / 3;
    const x2 = (i + 1) * segmentWidth;
    const y1 = i % 2 === 0 ? height * 0.2 : height * 0.8;
    const y2 = height / 2;
    
    path += ` C ${x1} ${y1}, ${x1} ${y1}, ${x2} ${y2}`;
  }
  
  return path;
}

export function getWeeksInRange(weeks: Date[], start: Date, end: Date): Date[] {
  console.log('[dates] Getting weeks in range:', {
    startDate: formatDateForDisplay(start),
    endDate: formatDateForDisplay(end)
  });
  const startWeek = startOfWeek(start);
  const endWeek = startOfWeek(end);
  
  return weeks.filter(week => {
    const weekStart = startOfWeek(week);
    return weekStart >= startWeek && weekStart <= endWeek;
  });
}

export function getWeekDates(week: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i));
}

/**
 * Adjust a date to the specified check-in day of the week
 * 
 * @param date The date to adjust
 * @param checkInDay The day of week (0-6, where 0 is Sunday)
 * @returns A new date adjusted to the next occurrence of the check-in day
 */
export function adjustToCheckInDay(date: Date, checkInDay: number = 0): Date {
  const normalizedDate = normalizeToUTCDate(date);
  
  // Use getUTCDay() for reliable UTC day comparison
  if (normalizedDate.getUTCDay() === checkInDay) {
    return normalizedDate;
  }
  
  // Use getUTCDay() for reliable UTC day calculation
  const daysToAdd = (checkInDay - normalizedDate.getUTCDay() + 7) % 7;
  return addDays(normalizedDate, daysToAdd);
}

/**
 * Check if a date falls within a week
 */
export function isDateInWeek(date: Date, week: Week): boolean {
  const dateMs = date.getTime();
  const startMs = week.startDate.getTime();
  const endMs = week.endDate.getTime();
  
  return dateMs >= startMs && dateMs <= endMs;
}

/**
 * Check if two date ranges overlap
 */
export function doDateRangesOverlap(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): boolean {
  const s1 = start1.getTime();
  const e1 = end1.getTime();
  const s2 = start2.getTime();
  const e2 = end2.getTime();
  
  return (
    // Case 1: Range 2 starts during range 1
    (s1 <= s2 && s2 <= e1) ||
    // Case 2: Range 2 ends during range 1
    (s1 <= e2 && e2 <= e1) ||
    // Case 3: Range 2 completely contains range 1
    (s2 <= s1 && e1 <= e2) ||
    // Case 4: Range 1 completely contains range 2
    (s1 <= s2 && e2 <= e1)
  );
}

/**
 * Generate a standard week based on a start date and check-in/out days
 */
export function generateStandardWeek(
  startDate: Date, 
  config: { checkInDay: number; checkOutDay: number }
): { startDate: Date; endDate: Date } {
  // Normalize input immediately for robustness
  const normalizedInputStart = normalizeToUTCDate(startDate);

  // Use getUTCDay() for reliable UTC day comparison
  const adjustedStart = normalizedInputStart.getUTCDay() !== config.checkInDay
    ? adjustToCheckInDay(normalizedInputStart, config.checkInDay) // Uses getUTCDay internally now
    : normalizedInputStart; // Already normalized
  
  // Calculate end date based on check-out day
  let endDate: Date;
  
  if (config.checkOutDay >= config.checkInDay) {
    // Simple case: check-out is later in the week than check-in
    const daysToAdd = config.checkOutDay - config.checkInDay;
    
    // If the week would be less than 3 days, extend to next week's check-out day
    if (daysToAdd < 2) {
      // Add a full week plus the days to the check-out day
      const extendedDaysToAdd = 7 + daysToAdd;
      endDate = addDays(adjustedStart, extendedDaysToAdd);
      console.log('[generateStandardWeek] Extended short week to next week:', {
        startDate: formatDateForDisplay(adjustedStart),
        endDate: formatDateForDisplay(endDate),
        daysInWeek: extendedDaysToAdd + 1
      });
    } else {
      endDate = addDays(adjustedStart, daysToAdd);
    }
  } else {
    // Complex case: check-out is earlier in the week than check-in (wraps to next week)
    const daysToAdd = 7 - (config.checkInDay - config.checkOutDay);
    
    // If the week would be less than 3 days, extend to next week's check-out day
    if (daysToAdd < 2) {
      // Add another full week
      const extendedDaysToAdd = 7 + daysToAdd;
      endDate = addDays(adjustedStart, extendedDaysToAdd);
      console.log('[generateStandardWeek] Extended short wrapped week to next week:', {
        startDate: formatDateForDisplay(adjustedStart),
        endDate: formatDateForDisplay(endDate),
        daysInWeek: extendedDaysToAdd + 1
      });
    } else {
      endDate = addDays(adjustedStart, daysToAdd);
    }
  }
  
  // Logging removed for performance
  
  return { startDate: adjustedStart, endDate };
}

/**
 * Generate weeks with customizations for a date range
 */
export function generateWeeksWithCustomizations(
  from: Date,
  to: Date,
  config: { checkInDay: number; checkOutDay: number } | null,
  customizations: WeekCustomization[] = [],
  isAdminMode: boolean = false
): Week[] {
  
  // Default config if none provided
  const safeConfig = config || { checkInDay: 0, checkOutDay: 6 };
  
  // Sort customizations by start date
  const sortedCustomizations = [...customizations]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Filter relevant customizations
  const relevantCustomizations = sortedCustomizations.filter(c => 
    doDateRangesOverlap(c.startDate, c.endDate, from, to)
  );
  


  // Create timeline of all date ranges
  const timeline: { 
    type: 'custom' | 'default', 
    startDate: Date, 
    endDate: Date, 
    customization?: WeekCustomization,
    id?: string,
    isPartialWeek?: boolean 
  }[] = [];

  // Add customizations to timeline
  relevantCustomizations.forEach(customization => {
    const daysDiff = calculateDaysBetween(customization.startDate, customization.endDate, true);
    
    timeline.push({
      type: 'custom',
      startDate: customization.startDate,
      endDate: customization.endDate,
      customization,
      isPartialWeek: daysDiff !== 7
    });
  });

  // Sort timeline by start date
  timeline.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Track weeks we've already added to prevent duplicates
  const addedWeekStartDates = new Set<string>();
  
  // Generate standard weeks for the entire date range
  let currentDate = normalizeToUTCDate(from); // Normalize initial date
  
  // Keep generating weeks until we reach the end date
  while (currentDate.getTime() <= to.getTime()) {
    // Ensure currentDate is normalized UTC midnight before use
    const normalizedCurrentDate = normalizeToUTCDate(currentDate);

    // Generate a standard week using the normalized date
    const { startDate, endDate } = generateStandardWeek(normalizedCurrentDate, safeConfig);
    
    // Check if this week extends beyond the end date
    const isPartial = endDate.getTime() > to.getTime();
    const actualEndDate = isPartial ? to : endDate;
    
    // Check if this week overlaps with any customization
    let overlapsWithCustomization = false;
    for (const customization of relevantCustomizations) {
      if (doDateRangesOverlap(
        startDate, actualEndDate,
        customization.startDate, customization.endDate
      )) {
        overlapsWithCustomization = true;
        break;
      }
    }
    
    // Only add standard weeks that don't overlap with customizations
    if (!overlapsWithCustomization) {
      // Create a unique ID for this week
      const weekId = generateUniqueWeekId(startDate, actualEndDate);
      
      // Only add this week if we haven't already added it
      const weekStartDateStr = formatDateForDisplay(startDate);
      if (!addedWeekStartDates.has(weekStartDateStr)) {
        addedWeekStartDates.add(weekStartDateStr);
        
        timeline.push({
          type: 'default',
          startDate,
          endDate: actualEndDate,
          id: weekId,
          isPartialWeek: isPartial
        });
      }
    }
    
    // Move to the next week, ensuring we start from UTC midnight of the day after endDate
    currentDate = addDays(normalizeToUTCDate(endDate), 1);
  }
  
  // Sort timeline by start date again after adding all weeks
  timeline.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Convert timeline to Week objects, ensuring unique IDs
  const result: Week[] = [];
  const usedIds = new Set<string>();
  
  timeline.forEach((item, index, array) => {
    // Skip deleted weeks for non-admin users
    if (!isAdminMode && item.type === 'custom' && item.customization!.status === 'deleted') {
      return;
    }
    
    // Generate a base ID
    let id = item.type === 'custom' 
      ? item.customization!.id 
      : generateUniqueWeekId(item.startDate, item.endDate);
    
    // If this ID is already used, make it unique by appending an index
    if (usedIds.has(id)) {
      id = `${id}-${index}`;
    }
    
    // Mark this ID as used
    usedIds.add(id);


    
    // Create the week object with the unique ID
    result.push({
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.type === 'custom' ? item.customization!.status : 'default',
      name: item.type === 'custom' ? (item.customization!.name || undefined) : undefined,
      link: item.type === 'custom' ? (item.customization!.link || undefined) : undefined,
      isCustom: item.type === 'custom',
      id,
      isPartialWeek: item.isPartialWeek,
      isEdgeWeek: index === 0 || index === array.length - 1,
      flexibleDates: item.type === 'custom' ? item.customization!.flexibleDates : undefined
    });
  });
  
  // Filter weeks to ensure they start on or after the 'from' date
  const filteredResult = result.filter(week => week.startDate.getTime() >= from.getTime());

  return filteredResult;
}

/**
 * Check if a week is selectable based on its status and date
 */
export function isWeekSelectable(week: Week, isAdmin: boolean = false, selectedWeeks: Week[] = [], testCurrentTime?: Date, testMode: boolean = false, allWeeks?: Week[]): boolean {
    // Test mode bypasses all restrictions
  if (testMode) {
    return true;
  }

    // Admins can select any week
  if (isAdmin) {
    return true;
  }

  // Add check: Block non-admin bookings from November 1st onwards
  const currentYear = new Date().getUTCFullYear();
  // Use normalizeToUTCDate to ensure consistent midnight comparison
  const cutoffDate = normalizeToUTCDate(new Date(Date.UTC(currentYear, 10, 1))); // Month is 0-indexed, so 10 = November
  
  if (week.startDate.getTime() >= cutoffDate.getTime()) {
     return false;
  }
  
  // For normal users, check both status and start date
  const weekStartDate = week.startDate;
  
  // Calculate booking cutoff: 8am Portugal time on the same day
  const now = testCurrentTime || new Date();
  
  // Get Portugal time using proper timezone handling
  // Portugal uses WET (UTC+0) in winter and WEST (UTC+1) in summer
  const portugalFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Lisbon',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const portugalTimeString = portugalFormatter.format(now);
  const portugalHour = parseInt(portugalTimeString.split(':')[0]);
  
  // Get Portugal date components using proper timezone
  const portugalDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  });
  
  const portugalDateString = portugalDateFormatter.format(now);
  const [portugalYear, portugalMonth, portugalDay] = portugalDateString.split('-').map(Number);
  
  // Determine effective cutoff date
  let effectiveCutoffDate: Date;
  if (portugalHour < 8) {
    // Before 8am Portugal time - can still book for today
    // Create a UTC date for Portugal today at midnight
    const portugalTodayMidnight = new Date(`${portugalYear}-${portugalMonth.toString().padStart(2, '0')}-${portugalDay.toString().padStart(2, '0')}T00:00:00Z`);
    effectiveCutoffDate = normalizeToUTCDate(portugalTodayMidnight);
  } else {
    // 8am or later Portugal time - can only book from tomorrow  
    // Create a UTC date for Portugal tomorrow at midnight
    const tomorrowDay = portugalDay + 1;
    const portugalTomorrowMidnight = new Date(`${portugalYear}-${portugalMonth.toString().padStart(2, '0')}-${tomorrowDay.toString().padStart(2, '0')}T00:00:00Z`);
    effectiveCutoffDate = normalizeToUTCDate(portugalTomorrowMidnight);
  }
  
  // Debug log (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('[isWeekSelectable] Portugal time cutoff:', {
      portugalTime: `${portugalYear}-${portugalMonth}-${portugalDay} ${portugalHour.toString().padStart(2, '0')}:00`,
      isBeforeCutoff: portugalHour < 8,
      effectiveCutoffDate: formatDateForDisplay(effectiveCutoffDate),
      canSelect: weekStartDate.getTime() >= effectiveCutoffDate.getTime()
    });
  }
  
  // Non-admin can't select weeks with check-in date before the effective cutoff
  if (weekStartDate.getTime() < effectiveCutoffDate.getTime()) {
    return false;
  }
  
  // If this is the currently selected arrival week, allow deselecting it
  if (selectedWeeks.length > 0 && selectedWeeks[0].endDate.getTime() === week.endDate.getTime()) {
    return true;
  }

  // If no weeks are selected yet, this will be an arrival week
  // Only allow arrivals on even-numbered weeks (0-based)
  if (selectedWeeks.length === 0) {
    // For arrival weeks, we need to enforce the visibility check
    if (week.status !== 'visible' && week.status !== 'default') {
      return false;
    }
    
    // Check if this week is blocked (even for arrival)
    if (!isAdmin && isBlockedFranceEventWeek(week)) {
      console.log('[isWeekSelectable] Cannot select blocked week as arrival week');
      return false;
    }
    
    // Check if this week is in May or June (months are 0-indexed: 4=May, 5=June)
    const month = weekStartDate.getUTCMonth();
    if (month === 4 || month === 5) {
      // Allow ALL weeks in May and June
      return true;
    }
  }

  // If we already have selected weeks, this could be a departure week
  // Allow any week after the arrival week for departure, even if hidden
  if (selectedWeeks.length > 0) {
    const arrivalWeek = selectedWeeks[0];
    
    // Check if this week is after the arrival week
    if (weekStartDate.getTime() > arrivalWeek.startDate.getTime()) {
      // For non-admin users, check if there are blocked weeks between arrival and this week
      if (!isAdmin) {
        // Check if this specific week is blocked
        if (isBlockedFranceEventWeek(week)) {
          console.log('[isWeekSelectable] Week is blocked (France event week)');
          return false;
        }
        
        // If we have access to all weeks, check for blocked weeks in between
        if (allWeeks && allWeeks.length > 0) {
          if (hasBlockedWeeksBetween(arrivalWeek, week, allWeeks)) {
            console.log('[isWeekSelectable] Cannot select week - blocked week exists between arrival and target week');
            return false;
          }
        }
      }
      return true;
    }
    return false;
  }

  // Non-admin can only select visible weeks (this is a fallback)
  if (week.status !== 'visible' && week.status !== 'default') {
    return false;
  }

  return true;
}

/**
 * Get a display name for a week
 */
export function getWeekDisplayName(week: Week): string {
  if (week.name) {
    return week.name;
  }
  
  return formatWeekRange(week);
}

/**
 * Consistently compares two weeks to determine if they represent the same week
 * Uses ID match for custom weeks or end date match as a fallback
 */
export function areSameWeeks(week1: Week, week2: Week): boolean {
  // If both weeks have IDs and they match
  if (week1.id && week2.id && week1.id === week2.id) {
    return true;
  }
  
  // Otherwise compare by end date (reliable for both standard and flex weeks)
  return week1.endDate.getTime() === week2.endDate.getTime();
}

/**
 * Determines which weeks should be deselected when a user clicks on a week.
 * 
 * Rules:
 * 1. If it's the last week of the selection, only that week is deselected
 * 2. If it's not the first week (arrival week), only that week is deselected
 * 3. If it's the first week (arrival week):
 *    - The function will check subsequent weeks until finding one that's selectable
 *    - If no selectable week is found, deselection is prevented (empty array)
 *    - If a selectable week is found, all weeks up to that week are deselected
 * 
 * @param weekToDeselect The week being deselected
 * @param selectedWeeks The full array of currently selected weeks
 * @param isAdmin Whether the user has admin privileges
 * @returns Array of weeks to deselect. Empty array means deselection is not allowed.
 */
export function getWeeksToDeselect(
  weekToDeselect: Week,
  selectedWeeks: Week[],
  isAdmin: boolean = false,
  allWeeks?: Week[]
): Week[] {
  console.log('[getWeeksToDeselect] Starting with:', {
    weekToDeselect: {
      id: weekToDeselect.id,
      startDate: formatDateForDisplay(weekToDeselect.startDate),
      endDate: formatDateForDisplay(weekToDeselect.endDate),
      status: weekToDeselect.status
    },
    selectedWeeksCount: selectedWeeks.length,
    isAdmin
  });

  // Admins can do anything
  if (isAdmin) {
    console.log('[getWeeksToDeselect] Admin user - allowing deselection of single week');
    return [weekToDeselect];
  }

  // If no weeks are selected, nothing to deselect
  if (selectedWeeks.length === 0) {
    console.log('[getWeeksToDeselect] No weeks selected - nothing to deselect');
    return [];
  }

  // If this is the only week selected, just deselect it
  if (selectedWeeks.length === 1) {
    console.log('[getWeeksToDeselect] Only one week selected - allowing deselection');
    return [weekToDeselect];
  }

  // If this is the first week (arrival week)
  if (areSameWeeks(weekToDeselect, selectedWeeks[0])) {
    console.log('[getWeeksToDeselect] Attempting to deselect arrival week - checking subsequent weeks');
    
    // Look for the next valid arrival week
    for (let i = 1; i < selectedWeeks.length; i++) {
      const potentialNewArrivalWeek = selectedWeeks[i];
      console.log(`[getWeeksToDeselect] Checking week ${i} as potential new arrival:`, {
        id: potentialNewArrivalWeek.id,
        startDate: formatDateForDisplay(potentialNewArrivalWeek.startDate),
        endDate: formatDateForDisplay(potentialNewArrivalWeek.endDate),
        status: potentialNewArrivalWeek.status
      });

      if (isWeekSelectable(potentialNewArrivalWeek, isAdmin, [], undefined, false, allWeeks)) {
        console.log('[getWeeksToDeselect] Found valid new arrival week - returning weeks to deselect:', {
          weeksToDeselect: selectedWeeks.slice(0, i).map(w => ({
            id: w.id,
            startDate: formatDateForDisplay(w.startDate),
            endDate: formatDateForDisplay(w.endDate)
          }))
        });
        // Found a week that can be the new arrival week
        // Return all weeks that should be deselected (from original arrival to just before this one)
        return selectedWeeks.slice(0, i);
      }
    }
    
    console.log('[getWeeksToDeselect] No valid new arrival week found - preventing deselection');
    // No valid new arrival week found, can't deselect the current arrival
    return [];
  }

  console.log('[getWeeksToDeselect] Deselecting non-arrival week');
  // For any other week in the selection, just deselect that one
  return [weekToDeselect];
}

/**
 * Legacy function that just checks if deselection is allowed.
 * @deprecated Use getWeeksToDeselect instead
 */
export function canDeselectArrivalWeek(
  weekToDeselect: Week,
  selectedWeeks: Week[],
  isAdmin: boolean = false,
  allWeeks?: Week[]
): boolean {
  return getWeeksToDeselect(weekToDeselect, selectedWeeks, isAdmin, allWeeks).length > 0;
}

/**
 * Calculate the number of days between two dates using millisecond-based calculation
 * @param startDate The start date
 * @param endDate The end date
 * @param includeEndDate Whether to include the end date in the count (default: false)
 * @returns Number of days between the dates
 */
export function calculateDaysBetween(startDate: Date, endDate: Date, includeEndDate: boolean = false): number {
  // Ensure dates are UTC midnight for accurate day difference calculation
  const startUTC = normalizeToUTCDate(startDate);
  const endUTC = normalizeToUTCDate(endDate);
  
  // FIXED: Use millisecond-based calculation to avoid DST issues
  const timeDiff = endUTC.getTime() - startUTC.getTime();
  const diff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // If including the end date, add 1 (e.g., Mon to Tue = 1 day diff, 2 days inclusive)
  return diff + (includeEndDate ? 1 : 0);
}

export function calculateTotalNights(selectedWeeks: Week[]): number {
  if (selectedWeeks.length === 0) return 0;
  
  // Determine effective start date (could be flex date)
  const firstWeek = selectedWeeks[0];
  const effectiveStartDate = firstWeek.selectedFlexDate || firstWeek.startDate;

  const lastDate = selectedWeeks[selectedWeeks.length - 1].endDate;
  
  // Ensure dates are UTC midnight
  const startUTC = normalizeToUTCDate(effectiveStartDate);
  const endUTC = normalizeToUTCDate(lastDate);
  
  // FIXED: Use millisecond-based calculation to avoid DST issues
  // Total nights = millisecond difference / ms per day (no +1 since nights != days)
  const timeDiff = endUTC.getTime() - startUTC.getTime();
  const nights = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  return nights;
}

export function calculateTotalDays(selectedWeeks: Week[]): number {
  if (selectedWeeks.length === 0) return 0;
  
  // Determine effective start date (could be flex date)
  const firstWeek = selectedWeeks[0];
  const effectiveStartDate = firstWeek.selectedFlexDate || firstWeek.startDate;

  const lastDate = selectedWeeks[selectedWeeks.length - 1].endDate;
  
  // Ensure dates are UTC midnight
  const startUTC = normalizeToUTCDate(effectiveStartDate);
  const endUTC = normalizeToUTCDate(lastDate);

  // FIXED: Use millisecond-based calculation to avoid DST issues
  // Total days (inclusive) = millisecond difference / ms per day + 1
  const timeDiff = endUTC.getTime() - startUTC.getTime();
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  
  // [EXTENSION_DURATION_DEBUG] Add logging for day calculation
  console.log('[EXTENSION_DURATION_DEBUG] calculateTotalDays calculation:', {
    inputWeeks: selectedWeeks.map(w => ({
      startDate: w.startDate.toISOString(),
      endDate: w.endDate.toISOString(),
      hasFlexDate: !!w.selectedFlexDate,
      flexDate: w.selectedFlexDate?.toISOString()
    })),
    effectiveStartDate: effectiveStartDate.toISOString(),
    lastDate: lastDate.toISOString(),
    startUTC: startUTC.toISOString(),
    endUTC: endUTC.toISOString(),
    timeDiffMs: timeDiff,
    timeDiffDays: timeDiff / (1000 * 60 * 60 * 24),
    calculatedDays: days,
    calculationNote: 'days = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1 (inclusive)'
  });
  
  return days;
}

/**
 * Calculate the number of complete weeks for duration discount purposes
 * This function counts the actual number of weeks selected, not calculated from days
 * For duration discount purposes, we want the number of weeks the user has selected
 */
export function calculateDurationDiscountWeeks(selectedWeeks: Week[]): number {
  if (selectedWeeks.length === 0) return 0;
  
  // FIX: For duration discount purposes, we should count the actual number of weeks selected
  // This is more accurate than trying to calculate from days, especially when weeks
  // might have different lengths or customizations
  const weeks = selectedWeeks.length;
  
  // [EXTENSION_DURATION_DEBUG] Add logging for week calculation
  console.log('[EXTENSION_DURATION_DEBUG] calculateDurationDiscountWeeks calculation:', {
    selectedWeeksCount: selectedWeeks.length,
    weeks,
    calculationNote: 'weeks = selectedWeeks.length (counting actual selected weeks)'
  });
  
  return weeks;
}

/**
 * Calculate the total duration in weeks, rounded to one decimal place.
 * Uses the total number of days (inclusive) and divides by 7.
 * @param selectedWeeks Array of selected Week objects
 * @returns Total duration in weeks (e.g., 3.4)
 */
export function calculateTotalWeeksDecimal(selectedWeeks: Week[]): number {
  if (selectedWeeks.length === 0) return 0;

  const totalDays = calculateTotalDays(selectedWeeks);

  if (totalDays <= 0) return 0;

  const weeksDecimal = totalDays / 7;
  // REMOVE ROUNDING HERE - Return full precision
  // const roundedWeeks = Math.round(weeksDecimal * 10) / 10;

  // return roundedWeeks; // OLD
  return weeksDecimal; // NEW
}

/**
 * Converts a Date object (assumed to be UTC midnight) to a new Date object
 * representing midnight in the local timezone for the same calendar day.
 * Useful for displaying UTC dates in components that use local time.
 * @param utcDate - The Date object, assumed to represent midnight UTC.
 * @returns A new Date object representing midnight in the local timezone.
 */
export function utcToLocalMidnight(utcDate: Date): Date {
  // Check if the input is a valid date
  if (!utcDate || isNaN(utcDate.getTime())) {
    // Return an invalid date or handle as appropriate
    console.warn('[utcToLocalMidnight] Received invalid date:', utcDate);
    return new Date(NaN); 
  }
  // Create new Date using UTC components; constructor interprets these as local time.
  return new Date(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth(),
    utcDate.getUTCDate()
    // Time components default to 00:00:00 in the local timezone
  );
}

/**
 * Calculate weeks for booking display purposes.
 * This function handles the business logic of how weeks should be counted and displayed.
 * @param startDate Check-in date
 * @param endDate Check-out date
 * @returns Object with different week calculation methods
 */
export function calculateBookingWeeks(startDate: Date, endDate: Date): {
  exactWeeks: number;
  roundedWeeks: number;
  businessWeeks: number; 
  nights: number;
  days: number;
} {
  // Normalize dates
  const startUTC = normalizeToUTCDate(startDate);
  const endUTC = normalizeToUTCDate(endDate);
  
  // Calculate nights (check-in to check-out, exclusive of check-out day)
  const timeDiff = endUTC.getTime() - startUTC.getTime();
  const nights = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // Calculate inclusive days (check-in to check-out, inclusive)
  const days = nights + 1;
  
  // Calculate exact weeks from days (inclusive)
  const exactWeeks = days / 7;
  
  // Calculate rounded weeks (to nearest 0.1)
  const roundedWeeks = Math.round(exactWeeks * 10) / 10;
  
  // Calculate business weeks (for pricing/display purposes)
  // If we're within 0.5 weeks of a whole number, round to that number
  // This handles cases like "3.9 weeks" becoming "4 weeks" for business purposes
  let businessWeeks = exactWeeks;
  const wholeWeeks = Math.round(exactWeeks);
  const difference = Math.abs(exactWeeks - wholeWeeks);
  
  if (difference <= 0.2) { // Within 1.4 days of a whole week
    businessWeeks = wholeWeeks;
  } else {
    businessWeeks = roundedWeeks;
  }
  
  const result = {
    exactWeeks,
    roundedWeeks,
    businessWeeks,
    nights,
    days
  };
  
  return result;
}

/**
 * Format weeks for clean display - whole numbers without decimals, decimals when needed
 * @param weeks Number of weeks (can be decimal)
 * @returns Formatted string (e.g., "4" or "3.9")
 */
export function formatWeeksForDisplay(weeks: number): string {
  // If it's exactly a whole number, show without decimals
  if (weeks === Math.round(weeks)) {
    return Math.round(weeks).toString();
  }
  
  // Otherwise, show with one decimal place
  return weeks.toFixed(1);
}

/**
 * Calculate weeks specifically for display in the MyBookings component
 * Uses exact calculation for accurate display
 */
export function calculateDisplayWeeks(startDate: Date, endDate: Date): number {
  const calculation = calculateBookingWeeks(startDate, endDate);
  return calculation.exactWeeks; // Use exact calculation, not business rounding
}

/**
 * Calculate and format weeks for display in one step
 * @param startDate Check-in date
 * @param endDate Check-out date
 * @returns Formatted weeks string (e.g., "4" or "3.5")
 */
export function calculateAndFormatDisplayWeeks(startDate: Date, endDate: Date): string {
  const weeks = calculateDisplayWeeks(startDate, endDate);
  return formatWeeksForDisplay(weeks);
}

/**
 * Calculate weeks for precise pricing calculations
 * Uses exact calculation without business rounding
 */
export function calculatePricingWeeks(startDate: Date, endDate: Date): number {
  const calculation = calculateBookingWeeks(startDate, endDate);
  return calculation.exactWeeks;
}

// Test functions removed - Portugal time cutoff logic is now implemented and tested