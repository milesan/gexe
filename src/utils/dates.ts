import { addWeeks, startOfWeek, addDays, addMonths, setDay, startOfDay, isSameDay } from 'date-fns';
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

export function adjustToCheckInDay(date: Date, checkInDay: number = 0): Date {
  console.log('[dates] Adjusting date to check-in day:', {
    originalDate: formatDateForDisplay(date),
    currentDay: date.getDay(),
    targetDay: checkInDay
  });
  
  // If already on check-in day, return the same date
  if (date.getDay() === checkInDay) {
    return new Date(date);
  }
  
  // Calculate days to add to reach next check-in day
  const daysToAdd = (checkInDay - date.getDay() + 7) % 7;
  const adjustedDate = addDays(date, daysToAdd);
  
  console.log('[dates] Adjusted to:', formatDateForDisplay(adjustedDate));
  return adjustedDate;
}

export function generateWeeksWithCustomizations(
  from: Date,
  to: Date,
  config: { checkInDay: number; checkOutDay: number } | null,
  customizations: WeekCustomization[] = [],
  isAdminMode: boolean = false
): Week[] {
  // Ensure we're working with normalized dates (start of day)
  const normalizedStartDate = startOfDay(from);
  const normalizedEndDate = startOfDay(to);
  
  console.log('[dates] Starting week generation with new algorithm:', {
    startDate: formatDateForDisplay(normalizedStartDate),
    endDate: formatDateForDisplay(normalizedEndDate),
    customizationsCount: customizations.length,
    isAdminMode
  });

  // Get check-in and check-out days from config (default to Sunday/Saturday if not specified)
  const checkInDay = config?.checkInDay ?? 0; // Sunday default
  const checkOutDay = config?.checkOutDay ?? 6; // Saturday default

  console.log('[dates] Using check-in/check-out configuration:', {
    checkInDay,
    checkOutDay
  });

  // Sort customizations by start date for efficient processing
  const sortedCustomizations = [...customizations].sort((a, b) => 
    startOfDay(new Date(a.startDate)).getTime() - startOfDay(new Date(b.startDate)).getTime()
  );

  // Filter customizations to only those relevant to our date range
  // A customization is relevant if any part of it overlaps with our date range
  const relevantCustomizations = sortedCustomizations.filter(c => {
    const customStart = startOfDay(new Date(c.startDate));
    const customEnd = startOfDay(new Date(c.endDate));
    
    // If either the start or end date falls within our range, or if the customization
    // completely encompasses our range, it's relevant
    return (
      (customStart >= normalizedStartDate && customStart <= normalizedEndDate) || // Start within range
      (customEnd >= normalizedStartDate && customEnd <= normalizedEndDate) || // End within range
      (customStart <= normalizedStartDate && customEnd >= normalizedEndDate) // Customization covers entire range
    );
  });

  console.log('[dates] Filtered to relevant customizations:', {
    originalCount: sortedCustomizations.length,
    relevantCount: relevantCustomizations.length,
    relevantCustomizations: relevantCustomizations.map(c => ({
      id: c.id,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status
    }))
  });

  // STEP 1: Create a timeline of all date ranges we need to consider
  // This combines both customized weeks and default weeks in chronological order
  const timeline: { 
    type: 'custom' | 'default', 
    startDate: Date, 
    endDate: Date, 
    customization?: WeekCustomization,
    isPartialWeek?: boolean 
  }[] = [];

  // Add all customizations to the timeline (including hidden/deleted if in admin mode)
  relevantCustomizations.forEach(customization => {
    // Always include all customizations in the timeline, regardless of status
    // This ensures deleted weeks are properly represented in the UI
    const startDate = startOfDay(new Date(customization.startDate));
    const endDate = startOfDay(new Date(customization.endDate));
    
    // Calculate if this is a partial week (not exactly 7 days)
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isPartial = daysDiff !== 7;
    
    timeline.push({
      type: 'custom',
      startDate,
      endDate,
      customization,
      isPartialWeek: isPartial
    });
  });

  // STEP 2: Sort the timeline by start date
  timeline.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  
  console.log('[dates] Initial timeline created:', timeline.map(item => ({
    type: item.type,
    startDate: formatDateForDisplay(item.startDate),
    endDate: formatDateForDisplay(item.endDate),
    status: item.customization?.status || 'n/a'
  })));

  // STEP 3: Find gaps in the timeline where we need to add default weeks
  let currentDate = new Date(normalizedStartDate);
  
  // Ensure we start on a check-in day for default weeks
  if (timeline.length === 0 || timeline[0].startDate > currentDate) {
    // Only adjust to check-in day if there's no customization at the start
    if (currentDate.getDay() !== checkInDay) {
      currentDate = adjustToCheckInDay(currentDate, checkInDay);
    }
  }
  
  // Create a new timeline that includes both customizations and default weeks
  const completeTimeline: { 
    type: 'custom' | 'default', 
    startDate: Date, 
    endDate: Date, 
    customization?: WeekCustomization,
    isPartialWeek?: boolean 
  }[] = [];
  
  // Process each item in the original timeline, filling gaps with default weeks
  for (let i = 0; i < timeline.length; i++) {
    const current = timeline[i];
    
    // If there's a gap before this item, fill it with default weeks
    if (currentDate < current.startDate) {
      // Fill the gap with default weeks until we reach the start of the current custom week
      while (currentDate < current.startDate) {
        // Calculate end date for this default week
        const daysToCheckout = ((checkOutDay - currentDate.getDay()) + 7) % 7;
        let weekEnd = daysToCheckout === 0 ? 
          addDays(currentDate, 7) : // If already on checkout day, go to next week
          addDays(currentDate, daysToCheckout);
          
        // If this would extend beyond the current custom week, truncate it
        if (weekEnd >= current.startDate) {
          weekEnd = addDays(current.startDate, -1);
          
          // Calculate if this is a partial week (not exactly 7 days)
          const daysDiff = Math.round((weekEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const isPartial = daysDiff !== 7;
          
          console.log('[dates] Adding truncated default week before customization:', {
            startDate: formatDateForDisplay(currentDate),
            endDate: formatDateForDisplay(weekEnd),
            daysDiff,
            isPartial
          });
          
          completeTimeline.push({
            type: 'default',
            startDate: new Date(currentDate),
            endDate: new Date(weekEnd),
            isPartialWeek: isPartial
          });
        } else {
          console.log('[dates] Adding full default week before customization:', {
            startDate: formatDateForDisplay(currentDate),
            endDate: formatDateForDisplay(weekEnd)
          });
          
          completeTimeline.push({
            type: 'default',
            startDate: new Date(currentDate),
            endDate: new Date(weekEnd)
          });
        }
        
        // Move to the next check-in day
        currentDate = addDays(weekEnd, 1);
        if (currentDate.getDay() !== checkInDay) {
          currentDate = adjustToCheckInDay(currentDate, checkInDay);
        }
        
        // Safety check: if we're about to go past the customization start,
        // just jump directly to it
        if (currentDate >= current.startDate) {
          currentDate = new Date(current.startDate);
          break;
        }
      }
    }
    
    // Add the customization to the complete timeline
    console.log('[dates] Adding customization to timeline:', {
      startDate: formatDateForDisplay(current.startDate),
      endDate: formatDateForDisplay(current.endDate),
      status: current.customization?.status || 'n/a'
    });
    
    completeTimeline.push(current);
    
    // Move the current date pointer to after this customization
    // Ensure we start on the day AFTER the customization ends
    currentDate = addDays(current.endDate, 1);
    
    // Check if there's a gap between the end of this customization and the next check-in day
    const nextCheckInDate = adjustToCheckInDay(currentDate, checkInDay);
    
    // If there's a gap between the current date and the next check-in day,
    // create a partial week to fill this gap
    if (currentDate < nextCheckInDate && 
        (i === timeline.length - 1 || nextCheckInDate <= timeline[i + 1].startDate)) {
      // Create a partial week from current date to the day before next check-in
      const partialWeekEnd = addDays(nextCheckInDate, -1);
      
      console.log('[dates] Adding partial week to fill gap before next check-in day:', {
        startDate: formatDateForDisplay(currentDate),
        endDate: formatDateForDisplay(partialWeekEnd),
        nextCheckIn: formatDateForDisplay(nextCheckInDate)
      });
      
      completeTimeline.push({
        type: 'default',
        startDate: new Date(currentDate),
        endDate: new Date(partialWeekEnd),
        isPartialWeek: true
      });
    }
    
    // For consistent default weeks, adjust to next check-in day
    if (i === timeline.length - 1 || currentDate < timeline[i + 1].startDate) {
      // Only adjust if there's no immediate next customization
      if (currentDate.getDay() !== checkInDay) {
        currentDate = nextCheckInDate;
      }
    }
  }
  
  // Fill any remaining gap after the last customization
  if (currentDate <= normalizedEndDate) {
    while (currentDate <= normalizedEndDate) {
      // Calculate end date for this default week
      const daysToCheckout = ((checkOutDay - currentDate.getDay()) + 7) % 7;
      let weekEnd = daysToCheckout === 0 ? 
        addDays(currentDate, 7) : // If already on checkout day, go to next week
        addDays(currentDate, daysToCheckout);
        
      // For the last week, we have two options:
      // 1. Create a partial week that ends exactly at normalizedEndDate
      // 2. Create a full week that extends beyond normalizedEndDate
      
      // We'll create a full week if the remaining days are at least 4 days
      // Otherwise, we'll create a partial week
      const daysRemaining = Math.round((normalizedEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const shouldCreateFullWeek = daysRemaining >= 4;
      
      if (shouldCreateFullWeek) {
        // Create a full week even if it extends beyond normalizedEndDate
        console.log('[dates] Creating full week for final period:', {
          startDate: formatDateForDisplay(currentDate),
          endDate: formatDateForDisplay(weekEnd),
          normalizedEndDate: formatDateForDisplay(normalizedEndDate),
          daysRemaining,
          isExtendingBeyondRange: weekEnd > normalizedEndDate
        });
      } else {
        // Create a partial week that ends exactly at normalizedEndDate
        if (weekEnd > normalizedEndDate) {
          weekEnd = new Date(normalizedEndDate);
        }
        
        console.log('[dates] Adding final partial week:', {
          startDate: formatDateForDisplay(currentDate),
          endDate: formatDateForDisplay(weekEnd),
          daysRemaining
        });
      }
      
      completeTimeline.push({
        type: 'default',
        startDate: new Date(currentDate),
        endDate: new Date(weekEnd),
        isPartialWeek: weekEnd > normalizedEndDate ? false : (weekEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24) + 1 !== 7
      });
      
      // Move to the next week
      currentDate = addDays(weekEnd, 1);
      if (currentDate.getDay() !== checkInDay) {
        currentDate = adjustToCheckInDay(currentDate, checkInDay);
      }
      
      // If we've created a full week that extends beyond normalizedEndDate, we're done
      if (weekEnd > normalizedEndDate) {
        break;
      }
    }
  }
  
  console.log('[dates] Final timeline created:', completeTimeline.map(item => ({
    type: item.type,
    startDate: formatDateForDisplay(item.startDate),
    endDate: formatDateForDisplay(item.endDate),
    status: item.customization?.status || 'n/a',
    duration: Math.floor((item.endDate.getTime() - item.startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
  })));
  
  // STEP 4: Convert the timeline to Week objects
  const weeks = completeTimeline.map((item, index, array) => {
    const isFirstWeek = index === 0;
    const isLastWeek = index === array.length - 1;
    const isEdgeWeek = isFirstWeek || isLastWeek;
    
    if (item.type === 'custom') {
      return {
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.customization!.status,
        name: item.customization!.name,
        isCustom: true,
        id: item.customization!.id,
        isPartialWeek: item.isPartialWeek,
        isEdgeWeek
      };
    } else {
      return {
        startDate: item.startDate,
        endDate: item.endDate,
        status: 'default',
        name: undefined,
        isCustom: false,
        id: `default-${item.startDate.toISOString()}`,
        isPartialWeek: item.isPartialWeek,
        isEdgeWeek
      };
    }
  });
  
  console.log('[dates] Generated weeks summary:', {
    count: weeks.length,
    statusCounts: weeks.reduce((acc, week) => {
      acc[week.status] = (acc[week.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    firstWeek: weeks.length > 0 ? {
      startDate: formatDateForDisplay(weeks[0].startDate),
      endDate: formatDateForDisplay(weeks[0].endDate),
      status: weeks[0].status,
      duration: Math.floor((weeks[0].endDate.getTime() - weeks[0].startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
    } : null,
    lastWeek: weeks.length > 0 ? {
      startDate: formatDateForDisplay(weeks[weeks.length-1].startDate),
      endDate: formatDateForDisplay(weeks[weeks.length-1].endDate),
      status: weeks[weeks.length-1].status,
      duration: Math.floor((weeks[weeks.length-1].endDate.getTime() - weeks[weeks.length-1].startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
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