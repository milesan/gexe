import React, { useState, useCallback, useMemo } from 'react';
import { isBefore, startOfToday, isSameDay, differenceInDays, addDays, isAfter } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { WeekBox } from './WeekBox';
import clsx from 'clsx';
import { Week } from '../types/calendar';
import { isWeekSelectable, formatWeekRange, formatDateForDisplay, normalizeToUTCDate, generateWeekId, canDeselectArrivalWeek, getWeeksToDeselect } from '../utils/dates';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, ChevronDown, ChevronUp } from 'lucide-react';
import { FlexibleCheckInModal } from './FlexibleCheckInModal';
import { areSameWeeks } from '../utils/dates';
import { getSeasonalDiscount, getSeasonName } from '../utils/pricing';

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
}

// Season legend component
const SeasonLegend = () => {
  return (
    <div className="flex flex-wrap justify-center xxs:justify-start gap-1.5 xs:gap-2 sm:gap-3 mb-2 xs:mb-3">
      <div className="flex items-center gap-1 xs:gap-1.5">
        <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full bg-[#A599FF]"></div>
        <span className="text-[10px] xs:text-xs sm:text-sm text-secondary font-regular whitespace-nowrap">Low (Nov-May)</span>
      </div>
      <div className="flex items-center gap-1 xs:gap-1.5">
        <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full bg-[#FFB088]"></div>
        <span className="text-[10px] xs:text-xs sm:text-sm text-secondary font-regular whitespace-nowrap">Medium (Jun, Oct)</span>
      </div>
      <div className="flex items-center gap-1 xs:gap-1.5">
        <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full bg-[#FF8F8F]"></div>
        <span className="text-[10px] xs:text-xs sm:text-sm text-secondary font-regular whitespace-nowrap">Summer (Jul-Sep)</span>
      </div>
    </div>
  );
};

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
}: WeekSelectorProps) {
  console.log('[WeekSelector] Rendering weeks:', weeks?.map(w => getSimplifiedWeekInfo(w, isAdmin, selectedWeeks)));

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
      <SeasonLegend />
      <div className={clsx(
        'grid gap-1.5 xs:gap-2 sm:gap-3 md:gap-4',
        'grid-cols-1 xxs:grid-cols-2 xs:grid-cols-3 sm:grid-cols-4'
      )}>
        {filteredWeeks.map((week, index) => {
          // Determine if content should be visible (selectable or admin view)
          const isContentVisible = isWeekSelectable(week, isAdmin, selectedWeeks) || isAdmin;

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

          return (
            <button
              key={week.id || `week-${index}`}
              onClick={() => handleWeekClick(week)}
              className={clsx(
                'relative p-2 xxs:p-2.5 xs:p-3 sm:p-4 border-2 transition-all duration-300',
                'min-h-[80px] xxs:min-h-[90px] xs:min-h-[100px] sm:min-h-[110px]',
                'shadow-sm hover:shadow-md',
                'pixel-corners',
                // Default background - applied when NOT selected and NOT covered by other border logic/status
                !isWeekSelected(week) && !(selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks)) && !(isAdmin && (week.status === 'hidden' || week.status === 'deleted' || (week.status === 'visible' && week.isCustom))) && 'bg-surface/50 backdrop-blur-sm',
                // Selection states (These should override the default bg)
                isWeekSelected(week) && 'border-accent-primary shadow-lg bg-surface/50 backdrop-blur-sm', // ADDED blur effect to selected state
                !isWeekSelected(week) && selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks) && 'border-accent-primary/20 bg-surface/50 backdrop-blur-sm', // Keep blur here too
                // Opacity/cursor for non-selectable (content hiding handled below)
                !isWeekSelectable(week, isAdmin, selectedWeeks) && !isAdmin && 'opacity-50 cursor-not-allowed',
                // Hover/cursor for selectable admin view
                isAdmin && isWeekSelectable(week, isAdmin, selectedWeeks) && 'cursor-pointer hover:border-blue-400',
                // Status colors - only for admin (These might override bg too)
                isAdmin && week.status === 'hidden' && 'border-yellow-400 bg-yellow-500/10',
                isAdmin && week.status === 'deleted' && 'border-red-400 bg-red-500/10 border-dashed',
                isAdmin && week.status === 'visible' && week.isCustom && 'border-blue-400',
                // Default border color when not selected and not covered by other border logic
                !isWeekSelected(week) && !(selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks)) && !(isAdmin && (week.status === 'hidden' || week.status === 'deleted' || (week.status === 'visible' && week.isCustom))) && 'border-border'
              )}
              disabled={!isWeekSelectable(week, isAdmin, selectedWeeks)}
            >
              {/* Conditionally render the content */}
              {isContentVisible && (
                <div className="text-center flex flex-col justify-center h-full">
                  {week.name ? (
                    <>
                      <div className="text-lg xxs:text-xl xs:text-2xl sm:text-3xl font-display mb-1 xxs:mb-0.5 xs:mb-1 text-primary">
                        {week.name}
                      </div>
                      <div className="font-mono text-xs xxs:text-sm xs:text-base sm:text-lg text-secondary flex items-center justify-center gap-0.5 xs:gap-1">
                        <span>{formatInTimeZone(week.startDate, 'UTC', 'MMM d')}</span>
                        <svg className="w-2.5 h-2.5 xxs:w-3 xxs:h-3 xs:w-4 xs:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{formatInTimeZone(week.endDate, 'UTC', 'MMM d')}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg xxs:text-xl xs:text-2xl sm:text-3xl font-display text-primary">
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
                            const isIntermediary = selectedWeeks.some(sw => areSameWeeks(week, sw)) && !isFirstSelected && !isLastSelected;

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
                            if (isIntermediary) {
                              return null; // Intermediary weeks display nothing specific
                            }
                            // Fallthrough for non-selected weeks in multi-select mode handled below
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
                      {/* Show flex dates indicator only if no weeks are selected yet */}
                      {week.flexibleDates && week.flexibleDates.length > 0 && !selectedWeeks.length && (
                        <div className="text-xs xxs:text-xs xs:text-base sm:text-sm text-indigo-500 mt-1 font-regular flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3 xxs:w-3.5 xxs:h-3.5 xs:w-4 xs:h-4" />
                          <span>{week.flexibleDates.length} check-in {week.flexibleDates.length === 1 ? 'date' : 'dates'}</span>
                        </div>
                      )}
                    </>
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
                        <div className="text-[10px] xxs:text-xs text-indigo-500 mt-1 font-regular">
                          {diffDays} {diffDays === 1 ? 'day' : 'days'}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Refined: Only show status text if admin AND status is 'hidden' or 'deleted' */}
                  {isAdmin && (week.status === 'hidden' || week.status === 'deleted') && (
                    <div className={clsx(
                      'text-[10px] xxs:text-xs font-regular mt-1',
                      week.status === 'hidden' && 'text-yellow-500',
                      week.status === 'deleted' && 'text-red-500',
                    )}>
                      {week.status} 
                    </div>
                  )}
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
                  // Apply seasonal color ONLY IF content is visible (i.e., selectable or admin)
                  isContentVisible && {
                    'bg-[#A599FF]': getSeasonName(week.startDate) === 'Low Season',
                    'bg-[#FFB088]': getSeasonName(week.startDate) === 'Medium Season',
                    'bg-[#FF8F8F]': getSeasonName(week.startDate) === 'Summer Season',
                  }
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

function generateSquigglePath() {
  // implement your squiggle path generation logic here
  return '';
}

// Helper function needed for border logic
function isWeekBetweenSelection(week: Week, selectedWeeks: Week[]): boolean {
  if (selectedWeeks.length <= 1) return false;
  const firstSelectedStart = selectedWeeks[0].startDate;
  const lastSelectedStart = selectedWeeks[selectedWeeks.length - 1].startDate;
  return isAfter(week.startDate, firstSelectedStart) && isBefore(week.startDate, lastSelectedStart);
}