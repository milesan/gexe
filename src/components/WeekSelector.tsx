import React, { useState, useCallback, useMemo } from 'react';
import { isBefore, startOfToday, isSameDay } from 'date-fns';
import { WeekBox } from './WeekBox';
import clsx from 'clsx';
import { Week } from '../types/calendar';
import { isWeekSelectable, formatWeekRange, formatDateForDisplay, normalizeToUTCDate, generateWeekId } from '../utils/dates';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { FlexibleCheckInModal } from './FlexibleCheckInModal';

const MOBILE_WEEKS = 3;
const DESKTOP_WEEKS = 4;

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
  currentMonth?: Date;
  isMobile?: boolean;
  isAdmin?: boolean;
  isLoading?: boolean;
  onMonthChange?: (newMonth: Date) => void;
}

export function WeekSelector({
  weeks,
  selectedWeeks,
  onWeekSelect,
  currentMonth,
  isMobile,
  isAdmin = false,
  isLoading = false,
  onMonthChange,
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

  // Check if a week can be used as a valid first week (arrival)
  const isValidFirstWeek = useCallback((week: Week): boolean => {
    if (isAdmin) return true; // Admins can select any week
    
    const weekStartDate = normalizeToUTCDate(week.startDate);
    const weeksSinceEpoch = Math.floor(weekStartDate.getTime() / (7 * 24 * 60 * 60 * 1000));
    return weeksSinceEpoch % 2 === 0; // Only even-numbered weeks can be arrival weeks
  }, [isAdmin]);

  const handleWeekClick = useCallback((week: Week) => {
    console.log('[WeekSelector] Week clicked:', {
      weekInfo: getSimplifiedWeekInfo(week, isAdmin, selectedWeeks),
      selectedWeeksCount: selectedWeeks.length,
      hasFlexDates: Boolean(week.flexibleDates?.length),
      flexDatesCount: week.flexibleDates?.length || 0,
      flexDates: week.flexibleDates?.map(d => formatDateForDisplay(d)),
      isCurrentlySelected: isWeekSelected(week)
    });
    
    // Check if this week is already the first selected week - using our improved week matching
    // to properly handle flexible dates
    const isFirstSelectedWeek = selectedWeeks.length > 0 && (() => {
      const firstSelectedWeek = selectedWeeks[0];
      
      // Check exact date match
      const dateMatch = isSameDay(normalizeToUTCDate(week.startDate), normalizeToUTCDate(firstSelectedWeek.startDate));
      
      // Check ID match for flexible dates
      const idMatch = week.id && firstSelectedWeek.id && week.id === firstSelectedWeek.id;
      
      // Check if this is a flexible date within the same week
      const isFlexibleDateMatch = week.flexibleDates?.some(flexDate => 
        firstSelectedWeek.startDate && isSameDay(normalizeToUTCDate(flexDate), normalizeToUTCDate(firstSelectedWeek.startDate))
      ) || false;
      
      const result = dateMatch || idMatch || isFlexibleDateMatch;
      console.log('[handleWeekClick] Checking if week is first selected:', {
        dateMatch,
        idMatch,
        isFlexibleDateMatch,
        result
      });
      
      return result;
    })();
    
    // If the user is clicking on the first selected week (to deselect it) and there are multiple weeks selected
    if (isFirstSelectedWeek && selectedWeeks.length > 1) {
      // Check if the second week would be valid as a first week
      const potentialNewFirstWeek = selectedWeeks[1];
      
      // If the second week wouldn't be valid as a first week and we're not in admin mode,
      // prevent the deselection completely
      if (!isValidFirstWeek(potentialNewFirstWeek) && !isAdmin) {
        console.log('[WeekSelector] Cannot deselect first week - second week would violate every-other-week rule');
        console.error('Cannot deselect this week. Please deselect your departure week first.');
        return;
      }
    }
    
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
  }, [onWeekSelect, isAdmin, selectedWeeks, isValidFirstWeek]);

  const handleFlexDateSelect = useCallback((date: Date) => {
    if (!flexModalWeek) return;
    
    // Create a new week object with the selected check-in date
    // IMPORTANT: Ensure we explicitly keep the original ID!
    const selectedWeek: Week = {
      ...flexModalWeek,
      startDate: date,
      // Keep the same duration between original start and end dates
      endDate: new Date(date.getTime() + (flexModalWeek.endDate.getTime() - flexModalWeek.startDate.getTime())),
      // Explicitly preserve the original ID to ensure proper matching
      id: flexModalWeek.id,
      // Also preserve the flexibleDates array which might be needed for further selections
      flexibleDates: flexModalWeek.flexibleDates,
      // Explicitly mark this as derived from a flexible date selection
      isFlexibleSelection: true
    };
    
    console.log('[handleFlexDateSelect] Selecting flexible date:', {
      originalWeekId: flexModalWeek.id,
      originalWeekStart: formatDateForDisplay(flexModalWeek.startDate),
      originalWeekEnd: formatDateForDisplay(flexModalWeek.endDate),
      selectedDate: formatDateForDisplay(date),
      newWeekStart: formatDateForDisplay(selectedWeek.startDate),
      newWeekEnd: formatDateForDisplay(selectedWeek.endDate),
      // Track if we preserved the ID
      preservedId: flexModalWeek.id === selectedWeek.id,
      // Calculate if the new week duration matches the original
      durationMatches: Math.abs(
        (selectedWeek.endDate.getTime() - selectedWeek.startDate.getTime()) -
        (flexModalWeek.endDate.getTime() - flexModalWeek.startDate.getTime())
      ) < 1000 * 60 * 60 * 24,
      // Add explicit flag to help with debugging
      isFlexibleSelection: selectedWeek.isFlexibleSelection
    });
    
    onWeekSelect(flexModalWeek);
  }, [flexModalWeek, onWeekSelect]);

  const isWeekSelected = useCallback((week: Week) => {
    // Add debug logging for all weeks with flexible dates to help troubleshoot
    if (week.flexibleDates && week.flexibleDates.length > 0) {
      console.log('[isWeekSelected] Checking flexible week:', {
        weekId: week.id,
        weekStartDate: formatDateForDisplay(week.startDate),
        weekEndDate: formatDateForDisplay(week.endDate),
        flexDates: week.flexibleDates?.map(d => formatDateForDisplay(d)),
        selectedWeeks: selectedWeeks.map(sw => ({
          id: sw.id,
          startDate: formatDateForDisplay(sw.startDate),
          endDate: formatDateForDisplay(sw.endDate)
        }))
      });
    }
    
    return selectedWeeks.some(selectedWeek => {
      // Check by exact date match (standard case)
      const dateMatch = isSameDay(normalizeToUTCDate(selectedWeek.startDate), normalizeToUTCDate(week.startDate)) && 
                       isSameDay(normalizeToUTCDate(selectedWeek.endDate), normalizeToUTCDate(week.endDate));
      
      // Check if the ID matches (for custom or flexible dates)
      const idMatch = Boolean(week.id && selectedWeek.id && week.id === selectedWeek.id);
      
      // For flexible dates, we need to check if the selected week's start date
      // is one of this week's flexible check-in dates
      let flexDateMatch = false;
      
      if (week.flexibleDates && week.flexibleDates.length > 0 && selectedWeek.startDate) {
        // Normalize to prevent timezone issues
        const normalizedSelectedStart = normalizeToUTCDate(selectedWeek.startDate);
        
        // Check if the selected week's start date is one of this week's flexible dates
        flexDateMatch = week.flexibleDates.some(flexDate => 
          isSameDay(normalizeToUTCDate(flexDate), normalizedSelectedStart)
        );
        
        // If it's a flex date match, also verify that the duration matches
        if (flexDateMatch) {
          const weekDuration = week.endDate.getTime() - week.startDate.getTime();
          const selectedWeekDuration = selectedWeek.endDate.getTime() - selectedWeek.startDate.getTime();
          // Check if durations are within a day of each other
          const durationsMatch = Math.abs(weekDuration - selectedWeekDuration) < 1000 * 60 * 60 * 24;
          
          flexDateMatch = flexDateMatch && durationsMatch;
        }
      }
      
      // CRITICAL: Also check the reverse case - if this standard week needs to match a
      // selection that was made with a flexible date
      let reverseFlexMatch = false;
      
      // If this is a standard week (not a flex week itself) but the selected week
      // might be derived from a flexible check-in date from this week's original
      if (!flexDateMatch && !dateMatch && !idMatch && week.id && selectedWeek.id && 
          (!week.flexibleDates || week.flexibleDates.length === 0)) {
        // Find if there's another week with the same ID as this one but with flexible dates
        // that include the selected week's start date
        const matchingWeeks = weeks.filter(w => w.id === week.id && w.flexibleDates && w.flexibleDates.length > 0);
        
        if (matchingWeeks.length > 0) {
          for (const flexWeek of matchingWeeks) {
            // Check if the selected week's start date is one of the flexible weeks's flexible dates
            const hasFlexMatch = flexWeek.flexibleDates?.some(flexDate => 
              isSameDay(normalizeToUTCDate(flexDate), normalizeToUTCDate(selectedWeek.startDate))
            ) || false;
            
            if (hasFlexMatch) {
              console.log('[isWeekSelected] Found reverse flex match:', {
                standardWeekId: week.id,
                flexWeekId: flexWeek.id,
                standardWeekStart: formatDateForDisplay(week.startDate),
                flexWeekStart: formatDateForDisplay(flexWeek.startDate),
                selectedWeekStart: formatDateForDisplay(selectedWeek.startDate)
              });
              reverseFlexMatch = true;
              break;
            }
          }
        }
      }
      
      // Log detailed selection information for debugging
      if (week.id && (dateMatch || idMatch || flexDateMatch || reverseFlexMatch || 
          (week.flexibleDates && week.flexibleDates.length > 0))) {
        console.log('[isWeekSelected] Week match check details:', {
          weekId: week.id,
          weekStartDate: formatDateForDisplay(week.startDate),
          selectedWeekStartDate: formatDateForDisplay(selectedWeek.startDate),
          dateMatch,
          idMatch,
          flexDateMatch,
          reverseFlexMatch,
          hasFlexibleDates: Boolean(week.flexibleDates?.length),
          flexibleDatesCount: week.flexibleDates?.length || 0,
          flexibleDates: week.flexibleDates?.map(d => formatDateForDisplay(d)),
          result: dateMatch || idMatch || flexDateMatch || reverseFlexMatch
        });
      }
      
      return dateMatch || idMatch || flexDateMatch || reverseFlexMatch;
    });
  }, [selectedWeeks, weeks]);

  const getWeekClasses = useCallback((week: Week) => {
    // Use our improved isWeekSelected function instead of doing a direct date match
    const isSelected = isWeekSelected(week);

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

    const isFirstSelected = isSelected && 
      selectedWeeks.length > 0 && 
      isSameDay(week.startDate, selectedWeeks[0].startDate);

    const isLastSelected = isSelected && 
      selectedWeeks.length > 0 && 
      isSameDay(week.startDate, selectedWeeks[selectedWeeks.length - 1].startDate);

    const baseClasses = 'relative flex items-center justify-center border-2 rounded-lg p-4 transition-all duration-200';
    const selectedClasses = 'border-emerald-500 bg-emerald-50 shadow-lg transform scale-105';
    const defaultClasses = 'border-stone-200 hover:border-emerald-300 hover:bg-stone-50';
    const nonSelectableClasses = 'opacity-50 bg-gray-100 border-gray-200 cursor-not-allowed';
    
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

    const classes = `${baseClasses} ${stateClass} ${statusClasses}`;

    console.log('[WeekSelector] Week classes:', {
      weekInfo: getSimplifiedWeekInfo(week, isAdmin, selectedWeeks),
      classes,
      states: {
        isSelected,
        isFirstSelected,
        isLastSelected,
        isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks),
        isHiddenButEditableByAdmin,
        isDeletedAndAdmin
      }
    });

    return classes;
  }, [selectedWeeks, isAdmin, isWeekSelected]);

  const isConsecutiveWeek = (week: Week): boolean => {
    if (selectedWeeks.length !== 2) return false;
    
    const [start, end] = selectedWeeks;
    return week.startDate > start.startDate && week.startDate < end.startDate;
  };

  const isFirstOrLastSelected = (week: Week): boolean => {
    if (selectedWeeks.length === 0) return false;
    
    // For a single selected week, use our flexible date matching logic
    if (selectedWeeks.length === 1) {
      const matchingWeek = selectedWeeks[0];
      
      // Check exact date match
      const dateMatch = isSameDay(normalizeToUTCDate(week.startDate), normalizeToUTCDate(matchingWeek.startDate));
      
      // Check ID match for flexible dates
      const idMatch = Boolean(week.id && matchingWeek.id && week.id === matchingWeek.id);
      
      // Check if this is a flexible date within the same week - handle undefined case
      const isFlexibleDateMatch = Boolean(week.flexibleDates?.some(flexDate => 
        matchingWeek.startDate && isSameDay(normalizeToUTCDate(flexDate), normalizeToUTCDate(matchingWeek.startDate))
      ));
      
      // Calculate if durations match (for flexible dates)
      const weekDuration = week.endDate.getTime() - week.startDate.getTime();
      const matchingWeekDuration = matchingWeek.endDate.getTime() - matchingWeek.startDate.getTime();
      const durationMatch = Math.abs(weekDuration - matchingWeekDuration) < 1000 * 60 * 60 * 24;
      
      const isFlexibleWeekSelection = durationMatch && (isFlexibleDateMatch || idMatch);
      
      return dateMatch || idMatch || isFlexibleWeekSelection;
    }
    
    // For multiple weeks, check if it's the first or last selected week
    const firstWeek = selectedWeeks[0];
    const lastWeek = selectedWeeks[selectedWeeks.length - 1];
    
    // Check for first week matches using same pattern
    const isFirstWeekMatch = (() => {
      const dateMatch = isSameDay(normalizeToUTCDate(week.startDate), normalizeToUTCDate(firstWeek.startDate));
      const idMatch = Boolean(week.id && firstWeek.id && week.id === firstWeek.id);
      const isFlexibleDateMatch = Boolean(week.flexibleDates?.some(flexDate => 
        firstWeek.startDate && isSameDay(normalizeToUTCDate(flexDate), normalizeToUTCDate(firstWeek.startDate))
      ));
      
      const weekDuration = week.endDate.getTime() - week.startDate.getTime();
      const firstWeekDuration = firstWeek.endDate.getTime() - firstWeek.startDate.getTime();
      const durationMatch = Math.abs(weekDuration - firstWeekDuration) < 1000 * 60 * 60 * 24;
      
      const isFlexibleWeekSelection = durationMatch && (isFlexibleDateMatch || idMatch);
      
      return dateMatch || idMatch || isFlexibleWeekSelection;
    })();
    
    // Check for last week matches using same pattern
    const isLastWeekMatch = (() => {
      const dateMatch = isSameDay(normalizeToUTCDate(week.startDate), normalizeToUTCDate(lastWeek.startDate));
      const idMatch = Boolean(week.id && lastWeek.id && week.id === lastWeek.id);
      const isFlexibleDateMatch = Boolean(week.flexibleDates?.some(flexDate => 
        lastWeek.startDate && isSameDay(normalizeToUTCDate(flexDate), normalizeToUTCDate(lastWeek.startDate))
      ));
      
      const weekDuration = week.endDate.getTime() - week.startDate.getTime();
      const lastWeekDuration = lastWeek.endDate.getTime() - lastWeek.startDate.getTime();
      const durationMatch = Math.abs(weekDuration - lastWeekDuration) < 1000 * 60 * 60 * 24;
      
      const isFlexibleWeekSelection = durationMatch && (isFlexibleDateMatch || idMatch);
      
      return dateMatch || idMatch || isFlexibleWeekSelection;
    })();
    
    return isFirstWeekMatch || isLastWeekMatch;
  };

  const isFirstSelected = (week: Week): boolean => {
    if (selectedWeeks.length === 0) return false;
    
    const firstWeek = selectedWeeks[0];
    
    // Check exact date match
    const dateMatch = isSameDay(normalizeToUTCDate(week.startDate), normalizeToUTCDate(firstWeek.startDate));
    
    // Check ID match for flexible dates
    const idMatch = Boolean(week.id && firstWeek.id && week.id === firstWeek.id);
    
    // Check if this is a flexible date within the same week - handle undefined case
    const isFlexibleDateMatch = Boolean(week.flexibleDates?.some(flexDate => 
      firstWeek.startDate && isSameDay(normalizeToUTCDate(flexDate), normalizeToUTCDate(firstWeek.startDate))
    ));
    
    // Calculate if durations match (for flexible dates)
    const weekDuration = week.endDate.getTime() - week.startDate.getTime();
    const firstWeekDuration = firstWeek.endDate.getTime() - firstWeek.startDate.getTime();
    const durationMatch = Math.abs(weekDuration - firstWeekDuration) < 1000 * 60 * 60 * 24;
    
    const isFlexibleWeekSelection = durationMatch && (isFlexibleDateMatch || idMatch);
    
    return dateMatch || idMatch || isFlexibleWeekSelection;
  };

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
        'grid gap-4',
        isMobile ? 'grid-cols-3' : 'grid-cols-4'
      )}>
        {filteredWeeks.map((week, index) => (
          <button
            key={week.id || `week-${index}`}
            onClick={() => handleWeekClick(week)}
            className={getWeekClasses(week)}
            disabled={!isWeekSelectable(week, isAdmin, selectedWeeks)}
          >
            <div className="text-center">
              {week.name ? (
                <>
                  <div className="text-sm font-bold">
                    {week.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                    <span>{format(week.startDate, 'MMM d')}</span>
                    <span>-</span>
                    <span>{format(week.endDate, 'MMM d')}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium">
                    {format(week.startDate, 'MMM d')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(week.endDate, 'MMM d')}
                  </div>
                </>
              )}
              {/* Show flex dates indicator */}
              {week.flexibleDates && week.flexibleDates.length > 0 && (
                <div className="text-xs text-indigo-600 mt-1 font-medium flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{week.flexibleDates.length} check-in {week.flexibleDates.length === 1 ? 'date' : 'dates'}</span>
                  {isWeekSelected(week) && selectedWeeks.length > 0 && 
                    week.flexibleDates.some(fd => 
                      selectedWeeks.some(sw => 
                        isSameDay(normalizeToUTCDate(fd), normalizeToUTCDate(sw.startDate))
                      )
                    ) && <span className="text-emerald-600 ml-1">★</span>
                  }
                </div>
              )}
              {(() => {
                const diffTime = week.endDate.getTime() - week.startDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because both start and end dates are inclusive
                
                // Only show day count for non-standard weeks that are not at the edge of the view
                if (diffDays !== 7 && !week.isEdgeWeek) {
                  return (
                    <div className="text-xs text-indigo-600 mt-1 font-medium">
                      {diffDays} {diffDays === 1 ? 'day' : 'days'}
                    </div>
                  );
                }
                return null;
              })()}
              {isAdmin && week.status !== 'default' && (
                <div className={clsx(
                  'text-xs font-medium mt-1',
                  week.status === 'hidden' && 'text-yellow-600',
                  week.status === 'deleted' && 'text-red-600',
                  week.status === 'visible' && 'text-blue-600'
                )}>
                  {week.status}
                </div>
              )}
            </div>
            {isWeekSelected(week) && (
              <motion.svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5 }}
              >
                <path
                  d={squigglePaths[index]}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-emerald-500"
                />
              </motion.svg>
            )}
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