import React, { useState, useCallback, useMemo } from 'react';
import { isBefore, startOfToday, isSameDay, differenceInDays } from 'date-fns';
import { WeekBox } from './WeekBox';
import clsx from 'clsx';
import { Week } from '../types/calendar';
import { isWeekSelectable, formatWeekRange, formatDateForDisplay, normalizeToUTCDate, generateWeekId, canDeselectArrivalWeek, getWeeksToDeselect } from '../utils/dates';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar, X } from 'lucide-react';
import { FlexibleCheckInModal } from './FlexibleCheckInModal';
import { areSameWeeks } from '../utils/dates';

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
                  {/* Show indicator if this flex week has a selected date that matches one of its flex dates */}
                  {isWeekSelected(week) && selectedWeeks.length > 0 && 
                    selectedWeeks.some(sw => {
                      if (areSameWeeks(week, sw) && sw.selectedFlexDate && 
                          week.flexibleDates?.some(fd => isSameDay(normalizeToUTCDate(fd), normalizeToUTCDate(sw.selectedFlexDate!)))) {
                        return true;
                      }
                      return false;
                    }) && (
                      <span 
                        className="text-emerald-600 ml-1 flex items-center tooltip-container" 
                        title={`Check-in on ${format(selectedWeeks.find(sw => 
                          areSameWeeks(week, sw) && sw.selectedFlexDate
                        )?.selectedFlexDate || week.startDate, 'EEEE, MMM d')}`}
                      >
                        ★
                      </span>
                    )
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