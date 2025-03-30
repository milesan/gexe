import React, { useState, useCallback, useMemo } from 'react';
import { isBefore, startOfToday, isSameDay, differenceInDays, eachDayOfInterval, addDays } from 'date-fns';
import { WeekBox } from './WeekBox';
import clsx from 'clsx';
import { Week } from '../types/calendar';
import { isWeekSelectable, formatWeekRange, formatDateForDisplay, normalizeToUTCDate, generateWeekId, canDeselectArrivalWeek, getWeeksToDeselect } from '../utils/dates';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, ChevronDown, ChevronUp } from 'lucide-react';
import { FlexibleCheckInModal } from './FlexibleCheckInModal';
import { areSameWeeks } from '../utils/dates';
import { getSeasonalDiscount } from '../utils/pricing';

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
}

// Season legend component
const SeasonLegend = () => {
  return (
    <div className="flex flex-wrap justify-center xxs:justify-start gap-1.5 xs:gap-2 sm:gap-3 mb-2 xs:mb-3">
      <div className="flex items-center gap-1 xs:gap-1.5">
        <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full bg-blue-400"></div>
        <span className="text-[10px] xs:text-xs sm:text-sm text-stone-600 font-regular whitespace-nowrap">Low (Nov-May)</span>
      </div>
      <div className="flex items-center gap-1 xs:gap-1.5">
        <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full bg-orange-400"></div>
        <span className="text-[10px] xs:text-xs sm:text-sm text-stone-600 font-regular whitespace-nowrap">Medium (Jun, Oct)</span>
      </div>
      <div className="flex items-center gap-1 xs:gap-1.5">
        <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full bg-gray-400"></div>
        <span className="text-[10px] xs:text-xs sm:text-sm text-stone-600 font-regular whitespace-nowrap">Summer (Jul-Sep)</span>
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
    // Use our improved isWeekSelected function instead of doing a direct date match
    const isSelected = isWeekSelected(week);

    // Get seasonal discount for this week
    const seasonalDiscount = getSeasonalDiscount(week.startDate);
    
    // Add seasonal background styling
    let seasonalClasses = '';
    if (seasonalDiscount === 0.40) {
      seasonalClasses = isSelected ? 'border-blue-300' : 'bg-blue-50 border-blue-100';
    } else if (seasonalDiscount === 0.15) {
      seasonalClasses = isSelected ? 'border-orange-300' : 'bg-orange-50 border-orange-100';
    } else {
      seasonalClasses = isSelected ? 'border-gray-300' : 'bg-white border-gray-200';
    }

    // Add debug logging for each week's selection state
    if (week.flexibleDates?.length) {
      console.log('[getWeekClasses] Week with flexible dates:', {
        weekId: week.id,
        weekStartDate: formatDateForDisplay(week.startDate),
        weekEndDate: formatDateForDisplay(week.endDate),
        isSelected,
        hasFlexibleDates: true,
        flexibleDatesCount: week.flexibleDates.length,
        flexibleDates: week.flexibleDates.map(d => formatDateForDisplay(d)),
        selectedWeeks: selectedWeeks.map(sw => ({
          id: sw.id,
          startDate: formatDateForDisplay(sw.startDate),
          endDate: formatDateForDisplay(sw.endDate)
        }))
      });
    }

    // Check if this is the first selected week
    const isFirstSelected = isSelected && 
      selectedWeeks.length > 0 && 
      areSameWeeks(week, selectedWeeks[0]);

    // Check if this is the last selected week
    const isLastSelected = isSelected && 
      selectedWeeks.length > 0 && 
      areSameWeeks(week, selectedWeeks[selectedWeeks.length - 1]);

    const baseClasses = 'relative flex items-center justify-center border-2 rounded-lg p-4 transition-all duration-200';
    const selectedClasses = 'bg-emerald-50 shadow-lg transform scale-105';
    const defaultClasses = 'hover:border-emerald-300 hover:bg-stone-50';
    const nonSelectableClasses = 'opacity-30 bg-gray-100 border-gray-200 cursor-not-allowed';
    
    let statusClasses = '';
    if (week.isCustom) {
      switch (week.status) {
        case 'hidden':
          statusClasses = 'week-status-hidden';
          break;
        case 'deleted':
          statusClasses = 'week-status-deleted';
          break;
        case 'visible':
          statusClasses = 'week-status-visible';
          break;
        default:
          statusClasses = 'week-status-default';
      }
    }

    // Add flex dates indicator
    if (week.flexibleDates?.length) {
      statusClasses += ' border-indigo-300';
    }

    // Special handling for hidden weeks in admin mode
    const isHiddenButEditableByAdmin = isAdmin && week.status === 'hidden';
    const isDeletedAndAdmin = isAdmin && week.status === 'deleted';
    
    // Determine if the week is selectable
    const canSelect = isWeekSelectable(week, isAdmin, selectedWeeks);
    
    // Choose the appropriate class based on selection and selectability
    let stateClass = '';
    if (!canSelect && !isAdmin) {
      stateClass = nonSelectableClasses;
    } else if (isSelected) {
      stateClass = selectedClasses;
    } else {
      stateClass = defaultClasses;
    }

    // For hidden weeks in admin mode, add a special indicator but keep them clickable
    if (isHiddenButEditableByAdmin) {
      statusClasses += ' border-dashed border-yellow-400 bg-yellow-50';
      
      // If it's not already selected, don't apply the non-selectable classes
      if (!isSelected && stateClass === nonSelectableClasses) {
        stateClass = defaultClasses + ' opacity-70'; // Semi-transparent but still clickable
      }
    }

    // For deleted weeks in admin mode, add a special indicator
    if (isDeletedAndAdmin) {
      statusClasses += ' border-dashed border-red-400 bg-red-50';
      
      // If it's not already selected, make it semi-transparent but clickable
      if (!isSelected) {
        stateClass = defaultClasses + ' opacity-70';
      }
    }

    const classes = `${baseClasses} ${stateClass} ${statusClasses} ${seasonalClasses}`;

    console.log('[WeekSelector] Week classes:', {
      weekInfo: getSimplifiedWeekInfo(week, isAdmin, selectedWeeks),
      classes,
      states: {
        isSelected,
        isFirstSelected,
        isLastSelected,
        isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks),
        isHiddenButEditableByAdmin,
        isDeletedAndAdmin,
        seasonalDiscount
      }
    });

    return classes;
  }, [selectedWeeks, isAdmin, isWeekSelected]);

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
        {filteredWeeks.map((week, index) => (
          <button
            key={week.id || `week-${index}`}
            onClick={() => handleWeekClick(week)}
            className={clsx(
              'relative p-2 xxs:p-2.5 xs:p-3 sm:p-4 border-2 transition-all duration-300',
              'min-h-[80px] xxs:min-h-[90px] xs:min-h-[100px] sm:min-h-[110px]',
              'shadow-sm hover:shadow-md',
              'pixel-corners bg-white',
              // Selection states
              isWeekSelected(week) && 'border-emerald-600 shadow-lg',
              !isWeekSelected(week) && selectedWeeks.length > 1 && 'border-emerald-600/20',
              !isWeekSelectable(week, isAdmin, selectedWeeks) && !isAdmin && 'opacity-50 cursor-not-allowed',
              isAdmin && 'cursor-pointer hover:border-blue-400',
              // Status colors - only for admin
              isAdmin && week.status === 'hidden' && 'border-yellow-400 bg-yellow-50',
              isAdmin && week.status === 'deleted' && 'border-red-400 bg-red-50 border-dashed',
              isAdmin && week.status === 'visible' && week.isCustom && 'border-blue-400',
              // Week status classes
              week.isCustom && week.status === 'hidden' && 'week-status-hidden',
              week.isCustom && week.status === 'deleted' && 'week-status-deleted',
              week.isCustom && week.status === 'visible' && 'week-status-visible',
              week.isCustom && week.status === 'default' && 'week-status-default',
              // Default border color when not selected
              !isWeekSelected(week) && 'border-stone-200'
            )}
            disabled={!isWeekSelectable(week, isAdmin, selectedWeeks)}
          >
            <div className="text-center flex flex-col justify-center h-full">
              {week.name ? (
                <>
                  <div className="text-lg xxs:text-xl xs:text-2xl sm:text-3xl font-display mb-1 xxs:mb-0.5 xs:mb-1">
                    {week.name}
                  </div>
                  <div className="font-mono text-xs xxs:text-sm xs:text-base sm:text-lg text-stone-500 flex items-center justify-center gap-0.5 xs:gap-1">
                    <span>{format(week.startDate, 'MMM d')}</span>
                    <svg className="w-2.5 h-2.5 xxs:w-3 xxs:h-3 xs:w-4 xs:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{format(week.endDate, 'MMM d')}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg xxs:text-xl xs:text-2xl sm:text-3xl font-display">
                    {(() => {
                      // --- START: Determine effective start date for the first selected week ---
                      let effectiveStartDate: Date | undefined;
                      if (selectedWeeks.length > 0) {
                        const firstSelected = selectedWeeks[0];
                        // Find the corresponding week object from the initial props to access original flexibleDates
                        // Use filteredWeeks as it's the source for rendering
                        const originalWeekData = filteredWeeks.find(w => areSameWeeks(w, firstSelected));

                        if (firstSelected.selectedFlexDate) {
                          effectiveStartDate = firstSelected.selectedFlexDate;
                          console.log(`[WeekSelector] Using explicitly selected flex date ${formatDateForDisplay(effectiveStartDate)} for first week.`);
                        } else if (originalWeekData?.flexibleDates?.length) {
                          effectiveStartDate = new Date(Math.min(...originalWeekData.flexibleDates.map(d => d.getTime())));
                          console.log(`[WeekSelector] Displaying earliest flex date ${formatDateForDisplay(effectiveStartDate)} for first selected week starting ${formatDateForDisplay(firstSelected.startDate)}`);
                        } else {
                          effectiveStartDate = firstSelected.startDate;
                          console.log(`[WeekSelector] Using standard start date ${formatDateForDisplay(effectiveStartDate)} for first week.`);
                        }
                      }
                      // --- END: Determine effective start date ---

                      // If no weeks are selected, show the earliest potential check-in date
                      if (selectedWeeks.length === 0) {
                        let displayDate = week.startDate;
                        if (week.flexibleDates?.length) {
                          displayDate = new Date(Math.min(...week.flexibleDates.map(d => d.getTime())));
                          // console log already exists from previous change for this case
                        }
                        return (
                          <div className="flex items-center justify-center">
                            <span>{format(displayDate, 'MMM d')}</span>
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
                          return (
                            <div className="flex items-center justify-center gap-1">
                              <span>{format(effectiveStartDate, 'MMM d')}</span>
                              <span>→</span>
                            </div>
                          );
                        }
                        if (isLastSelected) {
                          return (
                            <div className="flex items-center justify-center gap-1">
                              <span>→</span>
                              <span>{format(week.endDate, 'MMM d')}</span>
                            </div>
                          );
                        }
                        if (isIntermediary) {
                          return null; // Intermediary weeks display nothing specific
                        }
                        // Fallthrough for non-selected weeks in multi-select mode handled below
                      }

                      // If a single week is selected (selectedWeeks.length === 1 implicitly falls here after length > 1 check)
                      const selectedWeek = selectedWeeks[0]; // Will exist if length > 0
                      const isSelected = areSameWeeks(week, selectedWeek);

                      if (isSelected && effectiveStartDate) { // Handles selectedWeeks.length === 1 case. Use effectiveStartDate.
                        return (
                          <div className="flex items-center justify-center gap-1">
                            <span>{format(effectiveStartDate, 'MMM d')}</span>
                            <span>→</span>
                            <span>{format(week.endDate, 'MMM d')}</span>
                          </div>
                        );
                      }

                      // Fallback display for any week not covered above (e.g., not selected when others are)
                      // Show the earliest potential check-in date for this week.
                      let fallbackDisplayDate = week.startDate;
                      if (week.flexibleDates?.length) {
                        fallbackDisplayDate = new Date(Math.min(...week.flexibleDates.map(d => d.getTime())));
                      }
                      return (
                        <div className="flex items-center justify-center">
                          <span>{format(fallbackDisplayDate, 'MMM d')}</span>
                        </div>
                      );

                    })()}
                  </div>
                  {/* Show flex dates indicator only if no weeks are selected yet */}
                  {week.flexibleDates && week.flexibleDates.length > 0 && !selectedWeeks.length && (
                    <div className="text-xs xxs:text-xs xs:text-base sm:text-sm text-indigo-600 mt-1 font-regular flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3 xxs:w-3.5 xxs:h-3.5 xs:w-4 xs:h-4" />
                      <span>{week.flexibleDates.length} check-in {week.flexibleDates.length === 1 ? 'date' : 'dates'}</span>
                    </div>
                  )}
                </>
              )}
              {(() => {
                const diffTime = week.endDate.getTime() - week.startDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                if (diffDays !== 7 && !week.isEdgeWeek) {
                  return (
                    <div className="text-[10px] xxs:text-xs text-indigo-600 mt-1 font-regular">
                      {diffDays} {diffDays === 1 ? 'day' : 'days'}
                    </div>
                  );
                }
                return null;
              })()}
              {isAdmin && week.status !== 'default' && (
                <div className={clsx(
                  'text-[10px] xxs:text-xs font-regular mt-1',
                  week.status === 'hidden' && 'text-yellow-600',
                  week.status === 'deleted' && 'text-red-600',
                  week.status === 'visible' && 'text-blue-600'
                )}>
                  {week.status}
                </div>
              )}
            </div>

            {/* Add squiggly line for selected weeks */}
            {isWeekSelected(week) && !week.isEdgeWeek && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                viewBox="0 0 100 30"
              >
                <path
                  d="M 0 15 Q 25 5, 50 15 T 100 15"
                  className="squiggle-path"
                  stroke="rgb(5, 150, 105)"
                  strokeWidth="2"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {/* Bottom border for season indication */}
            <div 
              className={clsx(
                'absolute bottom-0 left-0 right-0 transition-all duration-300',
                // Seasonal colors for bottom line
                getSeasonalDiscount(week.startDate) === 0.40 && 'bg-blue-400',
                getSeasonalDiscount(week.startDate) === 0.15 && 'bg-orange-400',
                !getSeasonalDiscount(week.startDate) && 'bg-gray-400',
                // Height based on selection and screen size
                isWeekSelected(week) ? 'h-1.5 sm:h-2' : 'h-1 sm:h-1.5'
              )}
            />
          </button>
        ))}
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