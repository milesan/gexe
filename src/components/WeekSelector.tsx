import React, { useState, useCallback, useMemo } from 'react';
import { isBefore, startOfToday, isSameDay, differenceInDays, addDays, isAfter } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { WeekBox } from './WeekBox';
import clsx from 'clsx';
import { Week } from '../types/calendar';
import { isWeekSelectable, formatWeekRange, formatDateForDisplay, normalizeToUTCDate, generateWeekId, canDeselectArrivalWeek, getWeeksToDeselect, calculateTotalWeeksDecimal, areSameWeeks } from '../utils/dates';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, ChevronDown, ChevronUp } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { FlexibleCheckInModal } from './FlexibleCheckInModal';
import { getSeasonalDiscount, getSeasonName } from '../utils/pricing';
import { FitText } from './FitText';

// Helper function to log week dates consistently without timezone confusion
const getSimplifiedWeekInfo = (week: Week, isAdmin: boolean = false, selectedWeeks: Week[] = []) => {
  return {
    weekStartDate: formatDateForDisplay(week.startDate),
    weekEndDate: formatDateForDisplay(week.endDate),
    weekStatus: week.status,
    weekName: week.name,
    isCustom: week.isCustom,
    isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks),
    isEdgeWeek: week.isEdgeWeek
  };
};

interface WeekSelectorProps {
  weeks: Week[];
  selectedWeeks: Week[];
  onWeekSelect: (week: Week) => void;
  onWeeksDeselect?: (weeks: Week[]) => void;
  onClearSelection?: () => void;
  currentMonth?: Date;
  isMobile?: boolean;
  isAdmin?: boolean;
  isLoading?: boolean;
  onMonthChange?: (newMonth: Date) => void;
  onDateSelect: (date: Date, week: Week) => void;
  accommodationTitle: string;
  onMaxWeeksReached?: () => void;
}

// Helper function to generate a squiggle path
function generateSquigglePath() {
  return "M 0 15 Q 25 5, 50 15 T 100 15";
}

// Helper function to check if a week is between selected weeks
function isWeekBetweenSelection(week: Week, selectedWeeks: Week[]): boolean {
  if (selectedWeeks.length <= 1) return false;
  const firstSelectedStart = selectedWeeks[0].startDate;
  const lastSelectedStart = selectedWeeks[selectedWeeks.length - 1].startDate;
  return isAfter(week.startDate, firstSelectedStart) && isBefore(week.startDate, lastSelectedStart);
}

export function WeekSelector({
  weeks,
  selectedWeeks,
  onWeekSelect,
  onWeeksDeselect,
  onClearSelection,
  currentMonth,
  isMobile,
  isAdmin = false,
  isLoading = false,
  onMonthChange,
  onDateSelect,
  accommodationTitle,
  onMaxWeeksReached,
}: WeekSelectorProps) {
  console.log('[WeekSelector] Rendering weeks:', weeks?.map(w => getSimplifiedWeekInfo(w, isAdmin, selectedWeeks)));
  // --- START: Add log for incoming props ---
  console.log('[WeekSelector PROPS] Received props:', {
    weeksCount: weeks?.length,
    selectedWeeksCount: selectedWeeks?.length,
    isAdmin,
    isLoading,
    currentMonth: currentMonth ? formatDateForDisplay(currentMonth) : 'undefined',
    incomingWeeksSample: weeks?.slice(0, 5).map(w => ({ start: formatDateForDisplay(w.startDate), end: formatDateForDisplay(w.endDate), id: w.id })), // Log first 5 incoming weeks
  });
  // --- END: Add log for incoming props ---

  // Filter out partial weeks at the edges of the date range
  const filteredWeeks = weeks.filter(week => {
    // If it's an edge week (first or last in the range)
    if (week.isEdgeWeek) {
      // Check if it's a partial week (not a full 7 days)
      const diffTime = week.endDate.getTime() - week.startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because both start and end dates are inclusive
      
      // If it's a partial week at the edge, filter it out
      if (diffDays !== 7) {
        console.log('[WeekSelector] Filtering out partial edge week:', getSimplifiedWeekInfo(week, isAdmin, selectedWeeks));
        return false;
      }
    }
    return true;
  });

  console.log('[WeekSelector] Rendering with props:', {
    weeksCount: weeks?.length,
    filteredWeeksCount: filteredWeeks.length,
    selectedWeeksCount: selectedWeeks?.length,
    isAdmin,
    isLoading,
    currentMonth: currentMonth ? formatDateForDisplay(currentMonth) : undefined,
    isMobile,
    weeks: filteredWeeks?.map(w => getSimplifiedWeekInfo(w, isAdmin, selectedWeeks))
  });
  // --- START: Add log for filtered weeks ---
  console.log('[WeekSelector FILTERED] Filtered weeks:', {
    count: filteredWeeks.length,
    filteredWeeksSample: filteredWeeks?.slice(0, 5).map(w => ({ start: formatDateForDisplay(w.startDate), end: formatDateForDisplay(w.endDate), id: w.id })), // Log first 5 filtered weeks
  });
  // --- END: Add log for filtered weeks ---

  // Generate squiggle paths for visible weeks only
  const squigglePaths = useMemo(() => {
    const visibleWeeksCount = filteredWeeks.length;
    return Array.from({ length: visibleWeeksCount }, () => generateSquigglePath());
  }, [filteredWeeks.length]);
  
  const [selectedFlexDate, setSelectedFlexDate] = useState<Date | null>(null);
  const [flexModalWeek, setFlexModalWeek] = useState<Week | null>(null);

  // Define isWeekSelected first since it's used in the handleWeekClick dependency array
  const isWeekSelected = useCallback((week: Week) => {
    // Add debug logging for flexible weeks
    if (week.flexibleDates && week.flexibleDates.length > 0) {
      console.log('[isWeekSelected] Checking flexible week:', {
        weekId: week.id,
        weekStartDate: formatDateForDisplay(week.startDate),
        weekEndDate: formatDateForDisplay(week.endDate),
        flexDates: week.flexibleDates?.map(d => formatDateForDisplay(d))
      });
    }
    
    // Simple check: does this week match any of the selected weeks?
    return selectedWeeks.some(selectedWeek => areSameWeeks(week, selectedWeek));
  }, [selectedWeeks]);

  const handleWeekClick = useCallback((week: Week) => {
    console.log('[WeekSelector] Week clicked:', {
      weekInfo: getSimplifiedWeekInfo(week, isAdmin, selectedWeeks),
      selectedWeeksCount: selectedWeeks.length,
      hasFlexDates: Boolean(week.flexibleDates?.length),
      flexDatesCount: week.flexibleDates?.length || 0,
      flexDates: week.flexibleDates?.map(d => formatDateForDisplay(d)),
      isCurrentlySelected: isWeekSelected(week)
    });
    
    // If the week is already selected, we're trying to deselect it
    if (isWeekSelected(week)) {
      // Get all weeks that should be deselected when clicking this week
      const weeksToDeselect = getWeeksToDeselect(week, selectedWeeks, isAdmin);
      console.log('[WeekSelector] Weeks to deselect:', {
        count: weeksToDeselect.length,
        weeks: weeksToDeselect.map(w => ({
          id: w.id,
          startDate: formatDateForDisplay(w.startDate),
          endDate: formatDateForDisplay(w.endDate)
        }))
      });
      
      // If array is empty, deselection is not allowed
      if (weeksToDeselect.length === 0) {
        console.log('[WeekSelector] Cannot deselect - no valid subsequent week found');
        console.error('Cannot deselect this week. No valid subsequent week found to become the new arrival week.');
        return;
      }
      
      // If we have a batch deselection handler, use it
      if (onWeeksDeselect && weeksToDeselect.length > 1) {
        console.log('[WeekSelector] Using batch deselection handler for multiple weeks:', weeksToDeselect.length);
        onWeeksDeselect(weeksToDeselect);
        return;
      }
      
      // Otherwise fall back to single week deselection
      console.log('[WeekSelector] Using single week deselection');
      onWeekSelect(week);
      
      // Log a warning if there are more weeks to deselect but we can't
      if (weeksToDeselect.length > 1) {
        console.warn('[WeekSelector] Multiple weeks should be deselected, but onWeeksDeselect is not provided. Some weeks may remain selected incorrectly.');
      }
      
      return;
    }
    
    // If we're selecting a new week (not deselecting)
    if (!isWeekSelectable(week, isAdmin, selectedWeeks)) {
      console.log('[WeekSelector] Week not selectable:', {
        isAdmin,
        weekStatus: week.status,
        weekStartDate: formatDateForDisplay(week.startDate)
      });
      return;
    }

    // Check for maximum weeks allowed (only for non-admin users)
    const MAX_WEEKS_ALLOWED = 12;
    
    // Create a temp array that includes the current week to simulate selection
    const potentialSelectedWeeks = [...selectedWeeks, week];
    const totalWeeksDecimal = calculateTotalWeeksDecimal(potentialSelectedWeeks);
    
    if (!isAdmin && totalWeeksDecimal > MAX_WEEKS_ALLOWED) {
      console.log('[WeekSelector] Maximum weeks limit reached:', {
        current: selectedWeeks.length,
        potentialTotal: potentialSelectedWeeks.length,
        calculatedWeeks: totalWeeksDecimal,
        max: MAX_WEEKS_ALLOWED
      });
      return; // Prevent selecting more weeks
    }

    // If we're in admin mode, always go directly to week customization
    // Otherwise, if the week has flexible dates and it's being selected as the first week, show the modal
    if (isAdmin) {
      console.log('[WeekSelector] In admin mode, bypassing FlexibleCheckInModal and going directly to customization');
      onWeekSelect(week);
    } else if (week.flexibleDates?.length && selectedWeeks.length === 0) {
      console.log('[WeekSelector] Showing FlexibleCheckInModal for week with flexible dates');
      setFlexModalWeek(week);
    } else {
      console.log('[WeekSelector] Standard week selection');
      onWeekSelect(week);
    }
  }, [onWeekSelect, onWeeksDeselect, isAdmin, selectedWeeks, isWeekSelected]);

  const handleFlexDateSelect = useCallback((date: Date) => {
    if (!flexModalWeek) return;
    
    console.log('[handleFlexDateSelect] Selecting flexible date:', {
      originalWeekId: flexModalWeek.id,
      originalWeekStart: formatDateForDisplay(flexModalWeek.startDate),
      originalWeekEnd: formatDateForDisplay(flexModalWeek.endDate),
      selectedDate: formatDateForDisplay(date),
      newWeekStart: formatDateForDisplay(date),
      newWeekEnd: formatDateForDisplay(flexModalWeek.endDate),
      // Track if we preserved the ID
      preservedId: true,
      // Calculate if the new week duration matches the original
      durationMatches: Math.abs(
        (flexModalWeek.endDate.getTime() - date.getTime()) -
        (flexModalWeek.endDate.getTime() - flexModalWeek.startDate.getTime())
      ) < 1000 * 60 * 60 * 24,
      // Add variable duration information
      variableDuration: true,
      durationDays: differenceInDays(flexModalWeek.endDate, date) + 1,
      originalDurationDays: differenceInDays(flexModalWeek.endDate, flexModalWeek.startDate) + 1,
      // Add explicit flag to help with debugging
      isFlexibleSelection: true,
      // Also mark the selected flex date
      selectedFlexDate: formatDateForDisplay(date)
    });
    
    // Create a modified week with the selected flex date
    const modifiedWeek: Week = {
      ...flexModalWeek,
      selectedFlexDate: date  // This gets explicitly passed to the parent
    };
    
    // Pass both the date and the original week to the parent handler
    onDateSelect(date, modifiedWeek);
    setFlexModalWeek(null);
  }, [flexModalWeek, onDateSelect]);

  const getWeekClasses = useCallback((week: Week) => {
    const isSelected = isWeekSelected(week);
    const seasonName = getSeasonName(week.startDate);

    // Base classes - apply common styles
    let classes = ['relative', 'transition-all', 'duration-200', 'ease-in-out', 'transform', 'hover:scale-[1.02]', 'focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2', 'focus:ring-emerald-500', 'pixel-corners'];

    // --- Simplified logic based on grep findings and likely intent ---
    const isSelectableFlag = isWeekSelectable(week, isAdmin, selectedWeeks);
    const isPastWeek = isBefore(week.endDate, startOfToday()) && !isSameDay(week.endDate, startOfToday());

    if (isPastWeek && !isAdmin) {
      classes.push('opacity-50', 'cursor-not-allowed');
    } else if (!isSelectableFlag && !isAdmin) {
      classes.push('opacity-50', 'cursor-not-allowed');
    } else {
      classes.push('cursor-pointer');
    }

    // Background
    classes.push('bg-surface');

    // Border logic
    if (isSelected) {
      classes.push('border-2', 'border-accent-primary', 'shadow-lg');
      // Check for consecutive selection (this logic might need adjustment based on how `selectedWeeks` is ordered)
      const weekIndex = selectedWeeks.findIndex(sw => areSameWeeks(week, sw));
      if (weekIndex > 0 && weekIndex < selectedWeeks.length -1) {
         // Middle weeks might not need the heavy border, but let's keep primary for now.
         // Could add a specific style like border-accent-primary/50 if needed.
      } else if (weekIndex !== -1 && selectedWeeks.length > 1) {
         // This might be the start or end of a multi-week selection
         // If we need a different border for consecutive but not start/end, add logic here.
      }
    } else {
      // Default border
      classes.push('border-2', 'border-border');
      // Subtle highlight for weeks between selected range (if selectedWeeks has > 1)
      if (selectedWeeks.length > 1) {
        const firstSelected = selectedWeeks[0];
        const lastSelected = selectedWeeks[selectedWeeks.length - 1];
        if (isAfter(week.startDate, firstSelected.startDate) && isBefore(week.startDate, lastSelected.startDate)) {
            classes.push('border-accent-primary/20'); // Use the /20 variant
        }
      }
      // Apply hover effect only if selectable
      if (isSelectableFlag || isAdmin) {
         // Use hover:border-accent-primary? Keeping emerald-300 for now from original grep.
         classes.push('hover:border-emerald-300', 'hover:bg-[var(--color-bg-surface-hover)]'); 
      }
    }

    // Apply seasonal coloring if NOT selected and NOT admin mode
    if (!isSelected && !isAdmin) {
        if (seasonName === 'Low') classes.push('border-t-blue-400');
        else if (seasonName === 'Medium') classes.push('border-t-orange-400');
        else if (seasonName === 'Summer') classes.push('border-t-gray-400');
        // Ensure border thickness is consistent for top border color
        classes.push('border-t-4'); 
    } else {
        // Add placeholder border-t-transparent if selected/admin to maintain layout?
        // classes.push('border-t-4', 'border-t-transparent');
        // Or rely on the main border setting above.
    }

    return clsx(classes);
  }, [isWeekSelected, isAdmin, selectedWeeks, accommodationTitle]);

  const handleClearSelection = useCallback(() => {
    console.log('[WeekSelector] Clearing all selected weeks');
    
    // Use the provided onClearSelection handler if available
    if (onClearSelection) {
      console.log('[WeekSelector] Using provided onClearSelection handler');
      onClearSelection();
      return;
    }
    
    // Otherwise fallback to our implementation
    // If we have a batch deselection handler, use it for all weeks at once
    if (onWeeksDeselect && selectedWeeks.length > 0) {
      console.log('[WeekSelector] Using batch deselection handler to clear all weeks:', selectedWeeks.length);
      onWeeksDeselect(selectedWeeks);
      return;
    }
    
    // Last resort: fallback to deselecting the arrival week, which should cascade
    if (selectedWeeks.length > 0) {
      console.log('[WeekSelector] Using arrival week deselection to clear all weeks');
      onWeekSelect(selectedWeeks[0]);
    }
  }, [onWeekSelect, onWeeksDeselect, selectedWeeks, onClearSelection]);

  const handleMonthChange = useCallback((newMonth: Date) => {
    console.log('[WeekSelector] Month changed:', {
      from: currentMonth ? formatDateForDisplay(currentMonth) : 'undefined',
      to: formatDateForDisplay(newMonth)
    });
    onMonthChange?.(newMonth);
  }, [currentMonth, onMonthChange]);

  return (
    <>
      <div className={clsx(
        'grid gap-1.5 xs:gap-2 sm:gap-3 md:gap-4',
        'grid-cols-1 xxs:grid-cols-2 xs:grid-cols-3 sm:grid-cols-4'
      )}>
        {filteredWeeks.map((week, index) => {
          // Determine if content should be visible (selectable or admin view)
          const isContentVisible = isWeekSelectable(week, isAdmin, selectedWeeks) || isAdmin;
          
          // --- START: Add log inside render map (BEFORE RETURN) --- 
          console.log(`[WeekSelector RENDER LOOP] Rendering week ${index}:`, { id: week.id, startDate: formatDateForDisplay(week.startDate), endDate: formatDateForDisplay(week.endDate) });
          // --- END: Add log inside render map --- 

          // --- DEBUG LOG START ---
          /* console.log('[WeekSelector Debug] Week Render Check:', {
            weekId: week.id,
            startDate: formatDateForDisplay(week.startDate),
            isContentVisible, // What is this value?
            seasonName: getSeasonName(week.startDate), // What is this value?
            shouldBeLow: getSeasonName(week.startDate) === 'Low Season', // Updated comparison string
            shouldBeMedium: getSeasonName(week.startDate) === 'Medium Season', // Updated comparison string
            shouldBeSummer: getSeasonName(week.startDate) === 'Summer Season', // Updated comparison string
            // Relevant inputs
            isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks),
            isAdmin,
          }); */
          // --- DEBUG LOG END ---

          // --- START: Added log for debugging week properties ---
          console.log(`[WeekSelector Render Debug] Week ${index} (ID: ${week.id || 'N/A'})`, {
            startDate: formatDateForDisplay(week.startDate),
            flexibleDates: week.flexibleDates?.map(d => formatDateForDisplay(d)) ?? null,
            flexibleDatesLength: week.flexibleDates?.length ?? 0,
            isCustom: week.isCustom,
            status: week.status,
            isAdmin: isAdmin,
            isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks),
            isContentVisible: isContentVisible,
            selectedWeeksLength: selectedWeeks.length,
            weekObjectReceived: week // Log the raw week object just in case
          });
          // --- END: Added log ---

          // Debug log for min-height class
          const isSelectableForHeightClass = isWeekSelectable(week, isAdmin, selectedWeeks);
          const minHeightClass = (!isSelectableForHeightClass && !isAdmin) 
            ? 'min-h-[50px] xxs:min-h-[90px] xs:min-h-[100px] sm:min-h-[110px]' 
            : 'min-h-[80px] xxs:min-h-[90px] xs:min-h-[100px] sm:min-h-[110px]';
          
          console.log(`[WeekSelector Height Debug] Week ${index}:`, {
            id: week.id,
            isSelectable: isSelectableForHeightClass,
            isAdmin,
            appliedHeightClass: minHeightClass.substring(0, minHeightClass.indexOf(' ')) // Just log the mobile height part
          });

          // Define fixed height classes - Using the larger dimensions for consistency
          const fixedHeightClass = 'h-[80px] xxs:h-[90px] xs:h-[100px] sm:h-[110px]';

          // Determine if the week is an intermediate selected week
          const isIntermediateSelected = isWeekSelected(week) && isWeekBetweenSelection(week, selectedWeeks);

          return (
            <button
              key={week.id || `week-${index}`}
              onClick={() => handleWeekClick(week)}
              className={clsx(
                'relative p-2 xxs:p-2.5 xs:p-3 sm:p-4 border-2 transition-all duration-300',
                // Use fixed height instead of min-height
                fixedHeightClass, 
                'shadow-sm hover:shadow-md',
                // Unconditionally add highlight class (CSS rule scopes it to light mode)
                'bg-card-highlight',
                // Default background - CHANGED to surface-dark, REMOVED backdrop-blur
                !isWeekSelected(week) && !(selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks)) && !(isAdmin && (week.status === 'hidden' || week.status === 'deleted' || (week.status === 'visible' && week.isCustom))) && 'bg-surface-dark',
                // Selection states (These should override the default bg) - CHANGED background to surface-dark
                isWeekSelected(week) && 'border-accent-primary shadow-lg bg-surface-dark', 
                !isWeekSelected(week) && selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks) && 'border-accent-primary/20 bg-surface/50', 
                // Opacity/cursor for non-selectable (content hiding handled below)
                !isWeekSelectable(week, isAdmin, selectedWeeks) && !isAdmin && 'opacity-50 cursor-not-allowed',
                // Hover/cursor for selectable admin view
                isAdmin && isWeekSelectable(week, isAdmin, selectedWeeks) && 'cursor-pointer hover:border-blue-400',
                // Status colors - only for admin (These might override bg too)
                isAdmin && week.status === 'hidden' && 'border-yellow-400 bg-yellow-500/10',
                isAdmin && week.status === 'deleted' && 'border-red-400 bg-red-500/10 border-dashed',
                isAdmin && week.status === 'visible' && week.isCustom && 'border-blue-400',
                // --- START: Seasonal/Default Border Logic ---
                (() => {
                  const season = getSeasonName(week.startDate);
                  if (!isWeekSelected(week) && !isAdmin) { // Apply seasonal border for non-admin, non-selected
                    // Use the custom season colors defined in Tailwind config
                    if (season === 'Low Season') return 'border-season-low';
                    if (season === 'Medium Season') return 'border-season-medium';
                    if (season === 'Summer Season') return 'border-season-summer';
                  }
                  // Fallback default border for other non-selected cases (e.g., admin view without specific status)
                  if (!isWeekSelected(week) && !(selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks)) && !(isAdmin && (week.status === 'hidden' || week.status === 'deleted' || (week.status === 'visible' && week.isCustom)))) {
                    return 'border-border';
                  }
                  return null; // No border class needed if selected or already handled by admin status
                })()
                // --- END: Seasonal/Default Border Logic ---
              )}
              disabled={!isWeekSelectable(week, isAdmin, selectedWeeks)}
            >
              {/* Conditionally render the content */}
              {isContentVisible && (
                <div className="text-center flex flex-col justify-center h-full">
                  {/* --- START: Unified Date Display Logic --- */}
                  {/* This block now handles both named and unnamed weeks */}
                  <div className="text-2xl sm:text-3xl font-display text-primary mb-1"> {/* Added mb-1 for spacing */}
                    {(() => {
                      // --- START: Determine effective start date for the first selected week ---
                      let effectiveStartDate: Date | undefined;
                      console.log('[WeekSelector Render] Received selectedWeeks prop:', selectedWeeks?.map(w => ({ id: w.id, start: formatDateForDisplay(w.startDate), end: formatDateForDisplay(w.endDate), selectedFlex: w.selectedFlexDate ? formatDateForDisplay(w.selectedFlexDate) : undefined })));

                      if (selectedWeeks.length > 0) {
                        const firstSelected = selectedWeeks[0];
                        console.log('[WeekSelector Render] Examining firstSelected week:', { id: firstSelected.id, start: formatDateForDisplay(firstSelected.startDate), end: formatDateForDisplay(firstSelected.endDate), selectedFlex: firstSelected.selectedFlexDate ? formatDateForDisplay(firstSelected.selectedFlexDate) : undefined });
                        
                        // --- Log the selectedFlexDate received in props --- 
                        console.log('[DATE_TRACE] WeekSelector: Received firstSelected.selectedFlexDate in props:', { 
                          dateObj: firstSelected.selectedFlexDate, 
                          iso: firstSelected.selectedFlexDate?.toISOString?.() 
                        });

                        // Find the original week data to access flexibleDates if needed for fallback
                        const originalWeekData = filteredWeeks.find(w => areSameWeeks(w, firstSelected));

                        if (firstSelected.selectedFlexDate) {
                          effectiveStartDate = firstSelected.selectedFlexDate;
                          console.log(`[WeekSelector Render] Found selectedFlexDate in props: ${formatDateForDisplay(effectiveStartDate)}. Using this as effectiveStartDate.`);
                        } else if (originalWeekData?.flexibleDates?.length) {
                          // Sort dates and pick the earliest Date object directly
                          const sortedFlexDates = [...originalWeekData.flexibleDates].sort((a, b) => a.getTime() - b.getTime());
                          effectiveStartDate = sortedFlexDates[0]; 
                          console.warn(`[WeekSelector Render] No selectedFlexDate found in props for first selected week. Falling back to earliest flex date: ${formatDateForDisplay(effectiveStartDate)}.`);
                        } else {
                          effectiveStartDate = firstSelected.startDate;
                          console.log(`[WeekSelector Render] No selectedFlexDate and no flexibleDates found. Using standard start date: ${formatDateForDisplay(effectiveStartDate)}.`);
                        }

                        // --- Log the final effectiveStartDate before formatting --- 
                        console.log('[DATE_TRACE] WeekSelector: Final effectiveStartDate before formatting:', { 
                          dateObj: effectiveStartDate, 
                          iso: effectiveStartDate?.toISOString?.() 
                        });

                        console.log('[WeekSelector Render] Final effectiveStartDate determined:', effectiveStartDate ? formatDateForDisplay(effectiveStartDate) : 'undefined');
                      }
                      // --- END: Determine effective start date ---

                      // If no weeks are selected, show the earliest potential check-in date
                      if (selectedWeeks.length === 0) {
                        let displayDate = week.startDate;
                        if (week.flexibleDates?.length) {
                          // Sort dates and pick the earliest Date object directly
                          const sortedFlexDates = [...week.flexibleDates].sort((a, b) => a.getTime() - b.getTime());
                          displayDate = sortedFlexDates[0];
                        }
                        console.log('[WeekSelector] Displaying date (no selection):', {
                          dateObj: displayDate, // Keep for comparison
                          isoString: displayDate.toISOString(), // Explicit UTC representation
                          formattedForDisplay: formatInTimeZone(displayDate, 'UTC', 'MMM d') // How it should look in UI
                        });
                        return (
                          <div className="flex items-center justify-center">
                            <span>{formatInTimeZone(displayDate, 'UTC', 'MMM d')}</span>
                          </div>
                        );
                      }

                      // If multiple weeks are selected
                      if (selectedWeeks.length > 1) {
                        const firstSelected = selectedWeeks[0];
                        const lastSelected = selectedWeeks[selectedWeeks.length - 1];
                        const isFirstSelected = areSameWeeks(week, firstSelected);
                        const isLastSelected = areSameWeeks(week, lastSelected);
                        // Check if the current week is ANY of the selected weeks (first, last, or intermediate)
                        const isAnySelectedWeek = selectedWeeks.some(sw => areSameWeeks(week, sw));

                        if (isFirstSelected && effectiveStartDate) { // Use effectiveStartDate here
                          console.log('[WeekSelector Render] Displaying effectiveStartDate (first selected):', {
                            dateObj: effectiveStartDate,
                            iso: effectiveStartDate.toISOString(),
                            formatted: formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d')
                          });
                          return (
                            <div className="flex items-center justify-center gap-1 text-primary">
                              <span>{formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d')}</span>
                              <span>→</span>
                            </div>
                          );
                        }
                        if (isLastSelected) {
                          console.log('[WeekSelector Render] Displaying endDate (last selected):', {
                            dateObj: week.endDate,
                            iso: week.endDate.toISOString(),
                            formatted: formatInTimeZone(week.endDate, 'UTC', 'MMM d')
                          });
                          return (
                            <div className="flex items-center justify-center gap-1 text-primary">
                              <span>→</span>
                              <span>{formatInTimeZone(week.endDate, 'UTC', 'MMM d')}</span>
                            </div>
                          );
                        }
                        // If it's an intermediary selected week (between first and last)
                        if (isAnySelectedWeek && !isFirstSelected && !isLastSelected) {
                          console.log('[WeekSelector Render] Displaying null for intermediary selected week:', { weekId: week.id });
                          return null; // Intermediary selected weeks display nothing specific
                        }

                        // --- START: Modified logic for NON-SELECTED WEEKS when multiple are selected ---
                        if (!isAnySelectedWeek) {
                          // If this non-selected week comes AFTER the first selected week
                          if (isAfter(week.startDate, firstSelected.startDate)) {
                            console.log('[WeekSelector Render] Displaying potential checkout date (multi-select, after first):', {
                              weekId: week.id,
                              endDate: formatDateForDisplay(week.endDate)
                            });
                            return (
                              <div className="flex items-center justify-center text-primary">
                                {/* Display the END date */}
                                <span>{formatInTimeZone(week.endDate, 'UTC', 'MMM d')}</span>
                              </div>
                            );
                          } else {
                            // If this non-selected week comes BEFORE the first selected week,
                            // fall through to the default display logic below (showing earliest check-in).
                            console.log('[WeekSelector Render] Non-selected week before first selection. Falling back to default.', { weekId: week.id });
                          }
                        }
                        // --- END: Modified logic ---

                        // Fallthrough for weeks before the first selected will reach the default logic below.
                      }

                      // If a single week is selected
                      if (selectedWeeks.length === 1) {
                        const selectedWeek = selectedWeeks[0];
                        const isSelected = areSameWeeks(week, selectedWeek);

                        if (isSelected && effectiveStartDate) { // Handles selectedWeeks.length === 1 case. Use effectiveStartDate.
                          console.log('[WeekSelector Render] Displaying effectiveStartDate & endDate (single selected):', {
                            startObj: effectiveStartDate,
                            startIso: effectiveStartDate.toISOString(),
                            startFormatted: formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d'),
                            endObj: week.endDate,
                            endIso: week.endDate.toISOString(),
                            endFormatted: formatInTimeZone(week.endDate, 'UTC', 'MMM d')
                          });
                          return (
                            <div className="flex items-center justify-center gap-1 text-primary">
                              <span>{formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d')}</span>
                              <span>→</span>
                              <span>{formatInTimeZone(week.endDate, 'UTC', 'MMM d')}</span>
                            </div>
                          );
                        }
                        // --- START: New logic for subsequent weeks ---
                        else { // If this week is NOT the single selected week
                          // Check if this week comes directly after the selected one and is selectable
                          const isSubsequent = isAfter(week.startDate, selectedWeek.endDate);
                          // Also ensure it's selectable according to existing rules (availability, contiguity unless admin)
                          const isNextSelectable = isWeekSelectable(week, isAdmin, selectedWeeks); 
                          
                          if (isSubsequent && isNextSelectable) {
                            console.log('[WeekSelector Render] Displaying potential checkout date for subsequent week:', {
                                weekId: week.id,
                                weekStartDate: formatDateForDisplay(week.startDate),
                                weekEndDate: formatDateForDisplay(week.endDate),
                                isSelectable: isNextSelectable // Should be true here
                            });
                            return (
                              <div className="flex items-center justify-center gap-1 text-primary">
                                <span>{formatInTimeZone(week.endDate, 'UTC', 'MMM d')}</span>
                              </div>
                            );
                          }
                          // If not subsequent or not selectable, fall through to default display below
                          console.log('[WeekSelector Render] Week is not the selected one and not the next selectable subsequent week. Falling back to default.', {
                            weekId: week.id,
                            isSubsequent,
                            isNextSelectable
                          });
                        }
                        // --- END: New logic for subsequent weeks ---
                      }

                      // Fallback display for any week not covered above
                      // (e.g., not selected when others are, or when length === 1 but not subsequent/selectable)
                      let fallbackDisplayDate = week.startDate;
                      if (week.flexibleDates?.length) {
                        // Sort dates and pick the earliest Date object directly
                        const sortedFlexDates = [...week.flexibleDates].sort((a, b) => a.getTime() - b.getTime());
                        fallbackDisplayDate = sortedFlexDates[0];
                      }
                      console.log('[WeekSelector Render] Displaying fallback date:', {
                        dateObj: fallbackDisplayDate,
                        iso: fallbackDisplayDate.toISOString(),
                        formatted: formatInTimeZone(fallbackDisplayDate, 'UTC', 'MMM d')
                      });
                      return (
                        <div className="flex items-center justify-center text-primary">
                          <span>{formatInTimeZone(fallbackDisplayDate, 'UTC', 'MMM d')}</span>
                        </div>
                      );

                    })()}
                  </div>
                  {/* --- END: Unified Date Display Logic --- */}

                  {/* --- START: Render Week Name (if exists) Below Date --- */}
                  {/* Only render the name/secondary date if the week is NOT an intermediate selected week */}
                  {!isIntermediateSelected && week.name && (
                    <div className="mt-0.5"> {/* Add some spacing */}
                      {(() => {
                        const formattedStartDate = formatInTimeZone(week.startDate, 'UTC', 'MMM d');
                        const formattedEndDate = formatInTimeZone(week.endDate, 'UTC', 'MMM d');
                        const fullText = `${week.name}, ${formattedStartDate} - ${formattedEndDate}`;
                        const isLong = fullText.length > 20; // Use a threshold relevant to the combined text

                        return isMobile ? (
                          // Mobile: Show full text, allow wrapping
                          <div className="font-display text-secondary text-[10px] xxs:text-xs w-full px-1">
                            {fullText}
                          </div>
                        ) : (
                          // Desktop: Use tooltip only if combined text is long
                          <div className="relative w-full">
                            <div 
                              className="font-display text-secondary text-[10px] xxs:text-xs w-full px-1 truncate"
                              title={isLong ? fullText : undefined}
                            >
                              {fullText}
                            </div>
                            {isLong && (
                              <Popover.Root>
                                <Popover.Trigger asChild>
                                  <button 
                                    type="button"
                                    className="absolute inset-0 cursor-help w-full h-full" // Use cursor-help
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`More info about ${week.name}`} // Accessibility
                                  />
                                </Popover.Trigger>
                                <Popover.Portal>
                                  <Popover.Content 
                                    sideOffset={5} 
                                    className="tooltip-content !font-mono z-50 max-w-xs"
                                    onOpenAutoFocus={(e: Event) => e.preventDefault()}
                                  >
                                    {fullText} {/* Show full text in tooltip */}
                                    <Popover.Arrow className="tooltip-arrow" />
                                  </Popover.Content>
                                </Popover.Portal>
                              </Popover.Root>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* --- END: Render Week Name --- */}

                  {/* --- START: Existing additional info (Flex Dates, Duration, Status) --- */}
                  {/* Show flex dates indicator only if no weeks are selected yet */}
                  {week.flexibleDates && week.flexibleDates.length > 0 && !selectedWeeks.length && (
                    <div className="text-sm text-indigo-500 mt-1 font-mono flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3 xxs:w-3.5 xxs:h-3.5 xs:w-4 xs:h-4" />
                      <span>{week.flexibleDates.length} check-in {week.flexibleDates.length === 1 ? 'date' : 'dates'}</span>
                    </div>
                  )}
                  
                  {(() => {
                    const diffTime = week.endDate.getTime() - week.startDate.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    // Determine if the week is an "in-between" selected week
                    const isMultiWeekSelection = selectedWeeks.length > 2;
                    const isFirstSelected = selectedWeeks.length > 0 && areSameWeeks(week, selectedWeeks[0]);
                    const isLastSelected = selectedWeeks.length > 0 && areSameWeeks(week, selectedWeeks[selectedWeeks.length - 1]);
                    const isInBetween = isMultiWeekSelection && !isFirstSelected && !isLastSelected;

                    // Show duration only if it's not 7 days AND it's not an in-between week
                    if (diffDays !== 7 && !week.isEdgeWeek && !isInBetween) {
                      return (
                        <div className="text-sm text-indigo-500 mt-1 font-mono">
                          {diffDays} {diffDays === 1 ? 'day' : 'days'}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Refined: Only show status text if admin AND status is 'hidden' or 'deleted' */}
                  {isAdmin && (week.status === 'hidden' || week.status === 'deleted') && (
                    <div className={clsx(
                      'text-sm text-indigo-500 mt-1',
                      week.status === 'hidden' && 'text-yellow-500',
                      week.status === 'deleted' && 'text-red-500',
                    )}>
                      {week.status} 
                    </div>
                  )}
                  {/* --- END: Existing additional info --- */}
                </div>
              )}

              {/* Add squiggly line for selected weeks - only for those between start/end */}
              {isWeekSelected(week) && isWeekBetweenSelection(week, selectedWeeks) && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 30"
                >
                  <path
                    d="M 0 15 Q 25 5, 50 15 T 100 15"
                    className="squiggle-path"
                    stroke="var(--color-accent-primary)"
                    strokeWidth="2"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}

              {/* Bottom border for season indication - Using clsx object syntax */}
              <div
                className={clsx(
                  'absolute bottom-0 left-0 right-0 transition-all duration-300',
                  // Height based on selection
                  isWeekSelected(week) ? 'h-1.5 sm:h-2' : 'h-1 sm:h-1.5',
                  // Apply seasonal color ONLY IF content is visible AND NOT selected
                  isContentVisible && !isWeekSelected(week) && {
                    'bg-season-low': getSeasonName(week.startDate) === 'Low Season',
                    'bg-season-medium': getSeasonName(week.startDate) === 'Medium Season',
                    'bg-season-summer': getSeasonName(week.startDate) === 'Summer Season',
                  },
                  // Apply accent color IF selected
                  isWeekSelected(week) && 'bg-accent-primary'
                )}
              />
            </button>
          );
        })}
      </div>

      <FlexibleCheckInModal
        week={flexModalWeek!}
        isOpen={!!flexModalWeek}
        onClose={() => setFlexModalWeek(null)}
        onDateSelect={handleFlexDateSelect}
      />
    </>
  );
}
