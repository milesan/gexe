import { addWeeks, startOfWeek, addDays, addMonths, setDay, startOfDay, isSameDay, endOfDay, isBefore, isAfter, subMonths, format, Day, parseISO } from 'date-fns';
import { convertToUTC1 } from './timezone';
import { CalendarConfig, Week, WeekCustomization, WeekStatus } from '../types/calendar';

// Helper function for consistent date formatting
export function formatDateOnly(date: Date): string {
    return format(startOfDay(date), 'yyyy-MM-dd');
}

// Re-export the startOfDay function from date-fns
export { startOfDay };

/**
 * Normalizes a date to UTC midnight to ensure consistent date handling across timezones.
 * This prevents date shifting issues when converting between timezones.
 * 
 * @param date The date to normalize
 * @returns A new Date object at UTC midnight
 */
export function normalizeToUTCDate(date: Date | string): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  return new Date(Date.UTC(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    inputDate.getDate(),
    0, 0, 0, 0
  ));
}

/**
 * Safely parses a date string to a Date object, ensuring consistent behavior
 * regardless of the user's timezone.
 * 
 * @param dateString The date string to parse (ISO format preferred)
 * @returns A normalized Date object at UTC midnight
 */
export function safeParseDate(dateString: string): Date {
  try {
    // First try to parse as ISO
    const parsedDate = parseISO(dateString);
    return normalizeToUTCDate(parsedDate);
  } catch (e) {
    // Fallback to regular Date constructor with normalization
    return normalizeToUTCDate(new Date(dateString));
  }
}

/**
 * Format a date for display in logs and UI (YYYY-MM-DD)
 */
export function formatDateForDisplay(date: Date | null | undefined): string {
  if (!date) return 'null';
  return format(normalizeToUTCDate(date), 'yyyy-MM-dd');
}

/**
 * Format a date for display in UI with month and day (MMM d)
 */
export function formatDateShort(date: Date): string {
  return format(date, 'MMM d');
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
  console.log('[generateWeeks] Called with:', {
    startDate: formatDateForDisplay(startDate),
    count
  });
  
  const weeks: Date[] = [];
  let currentDate = new Date(startDate);
  
  // For normal weeks, just generate the requested number
  while (weeks.length < count) {
    console.log(`[generateWeeks] Adding week ${weeks.length + 1}:`, formatDateForDisplay(currentDate));
    weeks.push(new Date(currentDate));
    currentDate = addDays(currentDate, 7);
  }
  
  console.log('[generateWeeks] Generated weeks:', weeks.slice(0, 3).map(w => formatDateForDisplay(w)));
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
  
  // If already on check-in day, return the same date
  if (normalizedDate.getDay() === checkInDay) {
    return normalizedDate;
  }
  
  // Calculate days to add to reach next check-in day
  const daysToAdd = (checkInDay - normalizedDate.getDay() + 7) % 7;
  return addDays(normalizedDate, daysToAdd);
}

/**
 * Check if a date falls within a week
 */
export function isDateInWeek(date: Date, week: Week): boolean {
  const normalizedDate = normalizeToUTCDate(date);
  const normalizedStart = normalizeToUTCDate(week.startDate);
  const normalizedEnd = normalizeToUTCDate(week.endDate);
  
  return (
    normalizedDate >= normalizedStart && 
    normalizedDate <= normalizedEnd
  );
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
  const s1 = normalizeToUTCDate(start1);
  const e1 = normalizeToUTCDate(end1);
  const s2 = normalizeToUTCDate(start2);
  const e2 = normalizeToUTCDate(end2);
  
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
  const normalizedStart = normalizeToUTCDate(startDate);
  
  // If not starting on check-in day, adjust to next check-in day
  const adjustedStart = normalizedStart.getDay() !== config.checkInDay
    ? adjustToCheckInDay(normalizedStart, config.checkInDay)
    : normalizedStart;
  
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
  // Normalize input dates
  const normalizedStartDate = normalizeToUTCDate(from);
  const normalizedEndDate = normalizeToUTCDate(to);
  
  console.log('[generateWeeksWithCustomizations] Starting with:', {
    startDate: formatDateForDisplay(normalizedStartDate),
    endDate: formatDateForDisplay(normalizedEndDate),
    customizationsCount: customizations.length,
    isAdminMode
  });
  
  // Default config if none provided
  const safeConfig = config || { checkInDay: 0, checkOutDay: 6 };
  
  // Sort and normalize customizations
  const sortedCustomizations = [...customizations]
    .map(c => ({
      ...c,
      startDate: normalizeToUTCDate(c.startDate),
      endDate: normalizeToUTCDate(c.endDate),
      flexibleDates: c.flexibleDates?.map(d => normalizeToUTCDate(d)) || []
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Filter relevant customizations
  const relevantCustomizations = sortedCustomizations.filter(c => 
    doDateRangesOverlap(c.startDate, c.endDate, normalizedStartDate, normalizedEndDate)
  );
  
  console.log('[generateWeeksWithCustomizations] Relevant customizations:', {
    count: relevantCustomizations.length,
    customizations: relevantCustomizations.map(c => ({
      id: c.id,
      startDate: formatDateForDisplay(c.startDate),
      endDate: formatDateForDisplay(c.endDate),
      status: c.status
    }))
  });

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
    const daysDiff = Math.round(
      (customization.endDate.getTime() - customization.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    
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
  let currentDate = new Date(normalizedStartDate);
  
  // Keep generating weeks until we reach the end date
  while (currentDate <= normalizedEndDate) {
    // Generate a standard week
    const { startDate, endDate } = generateStandardWeek(currentDate, safeConfig);
    
    // Check if this week extends beyond the end date
    const isPartial = endDate > normalizedEndDate;
    const actualEndDate = isPartial ? normalizedEndDate : endDate;
    
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
    
    // Move to the next week
    currentDate = addDays(endDate, 1);
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
      isCustom: item.type === 'custom',
      id,
      isPartialWeek: item.isPartialWeek,
      isEdgeWeek: index === 0 || index === array.length - 1,
      flexibleDates: item.type === 'custom' ? item.customization!.flexibleDates : undefined
    });
  });
  
  console.log('[generateWeeksWithCustomizations] Generated weeks:', {
    count: result.length,
    firstWeek: result.length > 0 ? {
      startDate: formatDateForDisplay(result[0].startDate),
      endDate: formatDateForDisplay(result[0].endDate),
      status: result[0].status
    } : null,
    lastWeek: result.length > 0 ? {
      startDate: formatDateForDisplay(result[result.length - 1].startDate),
      endDate: formatDateForDisplay(result[result.length - 1].endDate),
      status: result[result.length - 1].status
    } : null
  });
  
  return result;
}

/**
 * Check if a week is selectable based on its status and date
 */
export function isWeekSelectable(week: Week, isAdmin: boolean = false, selectedWeeks: Week[] = []): boolean {
  // Admins can select any week
  if (isAdmin) {
    return true;
  }
  
  // For normal users, check both status and start date
  const today = normalizeToUTCDate(new Date());
  const weekStartDate = normalizeToUTCDate(week.startDate);
  
  // Non-admin can't select weeks with check-in date in the past
  if (weekStartDate < today) {
    return false;
  }
  
  // Non-admin can only select visible weeks
  if (week.status !== 'visible' && week.status !== 'default') {
    return false;
  }

  // If this is the currently selected arrival week, allow deselecting it
  if (selectedWeeks.length > 0 && isSameDay(selectedWeeks[0].startDate, week.startDate)) {
    return true;
  }

  // If no weeks are selected yet, this will be an arrival week
  // Only allow arrivals on even-numbered weeks (0-based)
  if (selectedWeeks.length === 0) {
    // Get the week number since the epoch
    const weeksSinceEpoch = Math.floor(weekStartDate.getTime() / (7 * 24 * 60 * 60 * 1000));
    return weeksSinceEpoch % 2 === 0; // Only allow even-numbered weeks for arrivals
  }

  // If we already have selected weeks, this could be a departure week
  // Allow any week after the arrival week for departure
  if (selectedWeeks.length > 0) {
    const arrivalWeek = selectedWeeks[0];
    return weekStartDate > arrivalWeek.startDate;
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

export function normalizeToLocalDate(date: Date | string): Date {
    const dateString = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    return new Date(dateString + 'T00:00:00');
}