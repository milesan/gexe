import { addWeeks, startOfWeek, addDays, addMonths, setDay, startOfDay } from 'date-fns';
import { convertToUTC1 } from './timezone';
import { CalendarConfig, Week, WeekCustomization } from '../types/calendar';
import { format } from 'date-fns';

// Re-export the startOfDay function from date-fns
export { startOfDay };

// Helper function to format dates consistently for display and logging
export const formatDateForDisplay = (date: Date): string => {
  return format(date, 'MMM d, yyyy');
};

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

export function generateWeeksWithCustomizations(
  startDate: Date,
  endDate: Date,
  calendarConfig: CalendarConfig | null = null,
  customizations: WeekCustomization[] = [],
  isAdminMode: boolean = false
): Week[] {
  // Ensure we're working with normalized dates
  const normalizedStartDate = startOfDay(new Date(startDate));
  const normalizedEndDate = startOfDay(new Date(endDate));

  // Get check-in and check-out days from config (default to Sunday/Saturday if not specified)
  const checkInDay = calendarConfig?.checkInDay ?? 0; // Sunday default
  const checkOutDay = calendarConfig?.checkOutDay ?? 6; // Saturday default

  console.log('[dates] Generating weeks with customizations:', {
    startDate: formatDateForDisplay(normalizedStartDate),
    endDate: formatDateForDisplay(normalizedEndDate),
    customizationsCount: customizations.length,
    isAdminMode,
    checkInDay,
    checkOutDay,
    dateRange: {
      diffMs: normalizedEndDate.getTime() - normalizedStartDate.getTime(),
      diffDays: Math.round((normalizedEndDate.getTime() - normalizedStartDate.getTime()) / (1000 * 60 * 60 * 24))
    }
  });

  // Group customizations by week start date
  const customizationsByWeek = customizations.reduce((acc, cust) => {
    const weekStartStr = new Date(cust.startDate).toISOString().split('T')[0];
    if (!acc[weekStartStr]) {
      acc[weekStartStr] = [];
    }
    acc[weekStartStr].push(cust);
    return acc;
  }, {} as Record<string, WeekCustomization[]>);

  // For each week, find the most relevant customization (latest with highest priority status)
  const resolvedCustomizations: Record<string, WeekCustomization> = {};
  
  // Status priority: deleted > hidden > visible > default
  const statusPriority = {
    'deleted': 3,
    'hidden': 2,
    'visible': 1,
    'default': 0
  };

  // For each group of customizations with the same week start date
  Object.entries(customizationsByWeek).forEach(([weekStartStr, weekCusts]) => {
    // Sort by created date descending, then by status priority
    const sortedCusts = [...weekCusts].sort((a, b) => {
      // First by status priority
      const statusDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
      if (statusDiff !== 0) return statusDiff;
      
      // Then by creation date (newest first)
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    // Take the top one from the sorted list
    if (sortedCusts.length > 0) {
      resolvedCustomizations[weekStartStr] = sortedCusts[0];
      
      console.log(`[dates] Resolved week ${weekStartStr} with ${weekCusts.length} customizations:`, {
        selectedStatus: sortedCusts[0].status,
        allStatuses: weekCusts.map(c => ({
          status: c.status,
          createdAt: c.createdAt ? formatDateForDisplay(c.createdAt) : 'unknown'
        }))
      });
    }
  });

  console.log('[dates] Resolved customizations:', {
    originalCount: customizations.length,
    resolvedCount: Object.keys(resolvedCustomizations).length,
    resolvedStatusCounts: Object.values(resolvedCustomizations).reduce((acc, cust) => {
      acc[cust.status] = (acc[cust.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  // Sort customizations by start date
  const sortedCustomizations = Object.values(resolvedCustomizations).sort(
    (a, b) => startOfDay(new Date(a.startDate)).getTime() - startOfDay(new Date(b.startDate)).getTime()
  );

  const weeks: Week[] = [];
  let currentDate = new Date(normalizedStartDate);

  console.log('[dates] Starting week generation with admin mode:', isAdminMode);

  // Helper function to ensure date is set to the correct check-in day
  const adjustToCheckInDay = (date: Date): Date => {
    const day = date.getDay();
    if (day === checkInDay) return date;
    
    // If the day is after check-in day, go to next week's check-in
    // If the day is before check-in day, go to this week's check-in
    const daysToAdd = day < checkInDay ? 
      checkInDay - day : 
      7 - day + checkInDay;
    
    return addDays(date, daysToAdd);
  };

  // Adjust initial currentDate to the first check-in day from or after startDate
  currentDate = adjustToCheckInDay(currentDate);
  
  // Continue generating weeks until we reach or exceed the end date
  while (currentDate < normalizedEndDate) {
    // Find matching customization for current date
    const currentDateStr = currentDate.toISOString().split('T')[0];
    // Exact match by start date
    const exactMatch = sortedCustomizations.find(c => {
      const customStartStr = new Date(c.startDate).toISOString().split('T')[0];
      return customStartStr === currentDateStr;
    });
    
    // Or any customization that contains this date
    const containingCustomization = exactMatch || sortedCustomizations.find(c => {
      const customStart = startOfDay(new Date(c.startDate));
      const customEnd = startOfDay(new Date(c.endDate));
      return customStart <= currentDate && customEnd >= currentDate;
    });

    if (containingCustomization) {
      console.log('[dates] Using customization for date:', {
        currentDate: formatDateForDisplay(currentDate),
        exactMatch: Boolean(exactMatch),
        isAdminMode,
        customization: {
          startDate: formatDateForDisplay(containingCustomization.startDate),
          endDate: formatDateForDisplay(containingCustomization.endDate),
          status: containingCustomization.status,
          id: containingCustomization.id
        }
      });
      
      // Skip weeks with 'deleted' status in non-admin mode
      if (containingCustomization.status === 'deleted' && !isAdminMode) {
        console.log('[dates] Skipping deleted week (user mode):', {
          startDate: formatDateForDisplay(containingCustomization.startDate),
          endDate: formatDateForDisplay(containingCustomization.endDate),
          isAdminMode
        });
        // Move to the day after this customization ends
        currentDate = addDays(startOfDay(new Date(containingCustomization.endDate)), 1);
        // Adjust to the next check-in day
        currentDate = adjustToCheckInDay(currentDate);
        continue;
      }
      
      // Log decision to include deleted week in admin mode
      if (containingCustomization.status === 'deleted' && isAdminMode) {
        console.log('[dates] INCLUDING deleted week in admin mode:', {
          weekStart: formatDateForDisplay(containingCustomization.startDate),
          weekEnd: formatDateForDisplay(containingCustomization.endDate),
          status: containingCustomization.status,
          isAdminMode
        });
      }
      
      // Add the customized week (including deleted weeks in admin mode)
      weeks.push({
        startDate: startOfDay(new Date(containingCustomization.startDate)),
        endDate: startOfDay(new Date(containingCustomization.endDate)),
        status: containingCustomization.status,
        name: containingCustomization.name,
        isCustom: true,
        id: containingCustomization.id // Include the customization ID for debugging
      });

      console.log('[dates] Generated custom week:', {
        weekStart: formatDateForDisplay(containingCustomization.startDate),
        weekEnd: formatDateForDisplay(containingCustomization.endDate),
        status: containingCustomization.status,
        isAdminMode
      });

      // Move to the day after this customization ends
      currentDate = addDays(startOfDay(new Date(containingCustomization.endDate)), 1);
      // Adjust to the next check-in day
      currentDate = adjustToCheckInDay(currentDate);
    } else {
      // Calculate the end date for this week (should be a check-out day)
      // We need to find the next check-out day from the current date
      const daysToCheckout = ((checkOutDay - currentDate.getDay()) + 7) % 7;
      const weekEnd = daysToCheckout === 0 ? 
        addDays(currentDate, 7) : // If already on checkout day, go to next week
        addDays(currentDate, daysToCheckout);

      console.log('[dates] Creating default week:', {
        startDate: formatDateForDisplay(currentDate),
        endDate: formatDateForDisplay(weekEnd),
        checkInDay,
        checkOutDay,
        currentDay: currentDate.getDay(),
        daysToCheckout
      });

      weeks.push({
        startDate: new Date(currentDate),
        endDate: new Date(weekEnd),
        status: 'default',
        isCustom: false
      });

      // Move to the start of next week (the day after checkout day)
      currentDate = addDays(weekEnd, 1);
      // Adjust to the next check-in day if needed
      if (currentDate.getDay() !== checkInDay) {
        currentDate = adjustToCheckInDay(currentDate);
      }
    }
  }

  // Handle case where we have a gap at the end (due to shortened weeks)
  const lastWeek = weeks[weeks.length - 1];
  if (lastWeek && lastWeek.endDate < normalizedEndDate) {
    const gapStartDate = addDays(lastWeek.endDate, 1);
    
    // Only add a gap week if we have at least 1 day in the gap
    if (gapStartDate < normalizedEndDate) {
      console.log('[dates] Adding gap week at end:', {
        gapStart: formatDateForDisplay(gapStartDate),
        endDate: formatDateForDisplay(normalizedEndDate)
      });
      
      weeks.push({
        startDate: gapStartDate,
        endDate: normalizedEndDate,
        status: 'default',
        isCustom: false
      });
    }
  }

  console.log('[dates] Generated weeks summary:', {
    count: weeks.length,
    statusCounts: weeks.reduce((acc, week) => {
      acc[week.status] = (acc[week.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    firstWeek: weeks.length > 0 ? {
      startDate: formatDateForDisplay(weeks[0].startDate),
      endDate: formatDateForDisplay(weeks[0].endDate),
      status: weeks[0].status
    } : null,
    lastWeek: weeks.length > 0 ? {
      startDate: formatDateForDisplay(weeks[weeks.length-1].startDate),
      endDate: formatDateForDisplay(weeks[weeks.length-1].endDate),
      status: weeks[weeks.length-1].status
    } : null
  });

  return weeks;
}

// Helper function to check if a date falls within a week
export function isDateInWeek(date: Date, week: Week): boolean {
  const startTime = week.startDate.getTime();
  const endTime = week.endDate.getTime();
  const dateTime = date.getTime();
  return dateTime >= startTime && dateTime <= endTime;
}

// Helper function to format a week's date range for display
export function formatWeekRange(week: Week): string {
  return `${format(week.startDate, 'MMM d')} - ${format(week.endDate, 'MMM d')}`;
}

// Helper function to check if a week is selectable based on its status and date
export function isWeekSelectable(week: Week, isAdmin: boolean = false): boolean {
  // Admins can select any week, including deleted ones
  if (isAdmin) {
    return true; // Allow admins to select any week
  }
  
  // For normal users, check both status and start date (check-in date)
  const today = startOfDay(new Date());
  const weekStartDate = startOfDay(new Date(week.startDate));
  
  // Non-admin can't select weeks with check-in date in the past
  if (weekStartDate < today) {
    return false;
  }
  
  // Regular status check
  return week.status !== 'hidden' && week.status !== 'deleted';
}

// Helper function to get the display name for a week
export function getWeekDisplayName(week: Week): string {
  if (week.name) {
    return week.name;
  }
  
  const start = formatDateForDisplay(week.startDate);
  const end = formatDateForDisplay(week.endDate);
  return `${start} - ${end}`;
}