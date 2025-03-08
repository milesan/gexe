import React, { useState, useCallback } from 'react';
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
const getSimplifiedWeekInfo = (week: Week, isAdmin: boolean = false) => {
  return {
    weekStartDate: formatDateForDisplay(week.startDate),
    weekEndDate: formatDateForDisplay(week.endDate),
    weekStatus: week.status,
    weekName: week.name,
    isCustom: week.isCustom,
    isSelectable: isWeekSelectable(week, isAdmin),
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
  console.log('[WeekSelector] Rendering weeks:', weeks?.map(w => getSimplifiedWeekInfo(w, isAdmin)));

  console.log('[WeekSelector] Rendering with props:', {
    weeksCount: weeks?.length,
    selectedWeeksCount: selectedWeeks?.length,
    isAdmin,
    isLoading,
    currentMonth: currentMonth ? formatDateForDisplay(currentMonth) : undefined,
    isMobile,
    weeks: weeks?.map(w => getSimplifiedWeekInfo(w, isAdmin))
  });

  const [squigglePaths] = useState(() => 
    Array.from({ length: isMobile ? MOBILE_WEEKS : DESKTOP_WEEKS }, () => generateSquigglePath())
  );
  const [selectedFlexDate, setSelectedFlexDate] = useState<Date | null>(null);
  const [flexModalWeek, setFlexModalWeek] = useState<Week | null>(null);

  const handleWeekClick = useCallback((week: Week) => {
    console.log('[WeekSelector] Week clicked:', getSimplifiedWeekInfo(week, isAdmin));
    
    if (!isWeekSelectable(week, isAdmin)) {
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
  }, [onWeekSelect, isAdmin, selectedWeeks]);

  const handleFlexDateSelect = useCallback((date: Date) => {
    if (!flexModalWeek) return;
    
    // Create a new week object with the selected check-in date
    const selectedWeek: Week = {
      ...flexModalWeek,
      startDate: date,
      // Keep the same duration between original start and end dates
      endDate: new Date(date.getTime() + (flexModalWeek.endDate.getTime() - flexModalWeek.startDate.getTime()))
    };
    
    onWeekSelect(selectedWeek);
    setFlexModalWeek(null);
  }, [flexModalWeek, onWeekSelect]);

  const isWeekSelected = useCallback((week: Week) => {
    return selectedWeeks.some(selectedWeek => 
      isSameDay(normalizeToUTCDate(selectedWeek.startDate), normalizeToUTCDate(week.startDate)) && 
      isSameDay(normalizeToUTCDate(selectedWeek.endDate), normalizeToUTCDate(week.endDate))
    );
  }, [selectedWeeks]);

  const getWeekClasses = useCallback((week: Week) => {
    const isSelected = selectedWeeks.some(w => 
      isSameDay(w.startDate, week.startDate) && isSameDay(w.endDate, week.endDate)
    );

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
    const canSelect = isWeekSelectable(week, isAdmin);
    
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
      weekInfo: getSimplifiedWeekInfo(week, isAdmin),
      classes,
      states: {
        isSelected,
        isFirstSelected,
        isLastSelected,
        isSelectable: isWeekSelectable(week, isAdmin),
        isHiddenButEditableByAdmin,
        isDeletedAndAdmin
      }
    });

    return classes;
  }, [selectedWeeks, isAdmin]);

  const isConsecutiveWeek = (week: Week): boolean => {
    if (selectedWeeks.length !== 2) return false;
    
    const [start, end] = selectedWeeks;
    return week.startDate > start.startDate && week.startDate < end.startDate;
  };

  const isFirstOrLastSelected = (week: Week): boolean => {
    if (selectedWeeks.length === 0) return false;
    if (selectedWeeks.length === 1) return week.startDate.getTime() === selectedWeeks[0].startDate.getTime();
    
    const [start, end] = selectedWeeks;
    return week.startDate.getTime() === start.startDate.getTime() || 
           week.startDate.getTime() === end.startDate.getTime();
  };

  const isFirstSelected = (week: Week): boolean => {
    return selectedWeeks.length > 0 && week.startDate.getTime() === selectedWeeks[0].startDate.getTime();
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
        {weeks.map((week, index) => (
          <button
            key={week.id || `week-${index}`}
            onClick={() => handleWeekClick(week)}
            className={getWeekClasses(week)}
            disabled={!isWeekSelectable(week, isAdmin)}
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