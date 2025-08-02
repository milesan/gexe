import React, { useState, useCallback, useMemo } from 'react';
import { isBefore, startOfToday, isSameDay, differenceInDays, addDays, isAfter } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { WeekBox } from './WeekBox';
import clsx from 'clsx';
import { Week } from '../types/calendar';
import { isWeekSelectable, formatWeekRange, formatDateForDisplay, normalizeToUTCDate, generateWeekId, canDeselectArrivalWeek, getWeeksToDeselect, calculateTotalWeeksDecimal, areSameWeeks, isBlockedFranceEventWeek, hasBlockedWeeksBetween } from '../utils/dates';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, ChevronDown, ChevronUp } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { FlexibleCheckInModal } from './FlexibleCheckInModal';
import { SecretEventModal } from './SecretEventModal';
import { getSeasonalDiscount, getSeasonName } from '../utils/pricing';
import { FitText } from './FitText';
import { Fireflies } from './Fireflies';
import { useMediaQuery } from '../hooks/useMediaQuery';



// Helper function to log week dates consistently without timezone confusion
const getSimplifiedWeekInfo = (week: Week, isAdmin: boolean = false, selectedWeeks: Week[] = [], testMode: boolean = false, allWeeks?: Week[]) => {
  return {
    weekStartDate: formatDateForDisplay(week.startDate),
    weekEndDate: formatDateForDisplay(week.endDate),
    weekStatus: week.status,
    weekName: week.name,
    isCustom: week.isCustom,
    isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode, allWeeks),
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
  testMode?: boolean;
  columns?: number;
  disableFireflies?: boolean;
  disabledWeeks?: Week[];
  extensionWeeks?: Week[];
}

// Helper function to check if a week is between selected weeks
function isWeekBetweenSelection(week: Week, selectedWeeks: Week[]): boolean {
  if (selectedWeeks.length <= 1) return false;
  const firstSelectedStart = selectedWeeks[0].startDate;
  const lastSelectedStart = selectedWeeks[selectedWeeks.length - 1].startDate;
  return isAfter(week.startDate, firstSelectedStart) && isBefore(week.startDate, lastSelectedStart);
}



// Add the memoized WeekComponent before the main WeekSelector component
interface WeekComponentProps {
  week: Week;
  index: number;
  isContentVisible: boolean;
  selectedWeeks: Week[];
  extensionWeeks: Week[];
  isAdmin: boolean;
  testMode: boolean;
  handleWeekClick: (week: Week) => void;
  isWeekSelected: (week: Week) => boolean;
  isWeekDisabled: (week: Week) => boolean;
  filteredWeeks: Week[];
  disableFireflies: boolean;
}

const WeekComponent = React.memo(function WeekComponent({
  week,
  index,
  isContentVisible,
  selectedWeeks,
  extensionWeeks,
  isAdmin,
  testMode,
  handleWeekClick,
  isWeekSelected,
  isWeekDisabled,
  filteredWeeks,
  disableFireflies,
}: WeekComponentProps) {
  // Detect larger screens for bigger font sizes
  const isLargeScreen = useMediaQuery('(min-width: 1280px)');
  
  // Performance optimization: Only compute expensive values once
  const isSelected = isWeekSelected(week);
  const disabled = isWeekDisabled(week);
  const isSelectableForHeight = isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode);
  
  // FIXED: Use consistent font sizes instead of dynamic sizing
  const singleDateFontSize = isLargeScreen ? 'text-2xl' : 'text-xl';
  const multiElementFontSize = isLargeScreen ? 'text-2xl' : 'text-xl';
  
  // Remove excessive logging for performance
  // console.log(`[WeekSelector RENDER LOOP] Rendering week ${index}:`, { id: week.id, startDate: formatDateForDisplay(week.startDate), endDate: formatDateForDisplay(week.endDate) });

  const fixedHeightClass = 'h-[80px] xxs:h-[90px] xs:h-[100px] sm:h-[110px]';
  const paddingClass = 'p-2.5 xxs:p-3 xs:p-3.5 sm:p-4.5';
  const isIntermediateSelected = isSelected && isWeekBetweenSelection(week, selectedWeeks);

  return (
    <button
      key={week.id || `week-${index}`}
      onClick={() => !disabled && handleWeekClick(week)}
      className={clsx(
        'relative border-2 transition-all duration-300',
        paddingClass,
        fixedHeightClass,
        'shadow-sm hover:shadow-md',
        'bg-card-highlight',
        !isSelected && !(selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks)) && !(isAdmin && (week.status === 'hidden' || week.status === 'deleted' || (week.status === 'visible' && week.isCustom))) && 'bg-surface-dark',
        isSelected && 'border-accent-primary shadow-lg bg-surface-dark',
        !isSelected && selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks) && 'border-accent-primary/20 bg-surface/50',
        (!isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode) || disabled) && !isAdmin && !testMode && 'opacity-50 cursor-not-allowed',
        isAdmin && isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode) && 'cursor-pointer hover:border-blue-400',
        isAdmin && week.status === 'hidden' && 'border-yellow-400 bg-yellow-500/10',
        isAdmin && week.status === 'deleted' && 'border-red-400 bg-red-500/10 border-dashed',
        isAdmin && week.status === 'visible' && week.isCustom && 'border-blue-400',
        (() => {
          const season = getSeasonName(week.startDate);
          if (!isSelected && !isAdmin) {
            if (season === 'Low Season') return 'border-season-low';
            if (season === 'Medium Season') return 'border-season-medium';
            if (season === 'Summer Season') return 'border-season-summer';
          }
          if (!isSelected && !(selectedWeeks.length > 1 && isWeekBetweenSelection(week, selectedWeeks)) && !(isAdmin && (week.status === 'hidden' || week.status === 'deleted' || (week.status === 'visible' && week.isCustom)))) {
            return 'border-border';
          }
          return null;
        })()
      )}
             disabled={disabled}
    >
      {/* Conditionally render the content */}
      {isContentVisible && (
        <div className="text-center flex flex-col h-full overflow-hidden">
          {/* --- START: Unified Date Display Logic with FIXED font sizes --- */}
          <div className="font-display text-primary mb-2 flex-1 min-h-0 flex items-center justify-center px-1">
            {(() => {
              // Special case: Secret event week should ALWAYS show the same content regardless of selection
              if (isBlockedFranceEventWeek(week)) {
                return (
                  <div className="flex flex-col items-center justify-center text-center w-full max-w-full">
                    <div className="text-xs">SECRET EVENT</div>
                    <div className="text-xs mt-1">
                      <a
                        href="mailto:dawn@thegarden.pt?subject=Garden Rental Inquiry&body=Hi, I am interested in renting the garden for all or part of Sep 23-29th"
                        className="text-primary hover:text-accent-primary underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        GARDEN RENTAL
                      </a>
                    </div>
                  </div>
                );
              }

              // Simplified date calculation without excessive logging
              let effectiveStartDate: Date | undefined;

              if (selectedWeeks.length > 0) {
                const firstSelected = selectedWeeks[0];
                const originalWeekData = filteredWeeks.find(w => areSameWeeks(w, firstSelected));

                if (firstSelected.selectedFlexDate) {
                  effectiveStartDate = firstSelected.selectedFlexDate;
                } else if (originalWeekData?.flexibleDates?.length) {
                  const sortedFlexDates = [...originalWeekData.flexibleDates].sort((a, b) => a.getTime() - b.getTime());
                  effectiveStartDate = sortedFlexDates[0]; 
                } else {
                  effectiveStartDate = firstSelected.startDate;
                }
              }

              // If no weeks are selected, show the earliest potential check-in date
              if (selectedWeeks.length === 0) {
                let displayDate = week.startDate;
                if (week.flexibleDates?.length) {
                  const sortedFlexDates = [...week.flexibleDates].sort((a, b) => a.getTime() - b.getTime());
                  displayDate = sortedFlexDates[0];
                }
                const dateText = formatInTimeZone(displayDate, 'UTC', 'MMM d');
                return (
                  <div className="flex items-center justify-center w-full max-w-full">
                    <span className={`${singleDateFontSize} font-display`}>{dateText}</span>
                  </div>
                );
              }

              // If multiple weeks are selected
              if (selectedWeeks.length > 1) {
                const firstSelected = selectedWeeks[0];
                const lastSelected = selectedWeeks[selectedWeeks.length - 1];
                const isFirstSelected = areSameWeeks(week, firstSelected);
                const isLastSelected = areSameWeeks(week, lastSelected);
                const isAnySelectedWeek = selectedWeeks.some(sw => areSameWeeks(week, sw));
                const isExtensionWeek = extensionWeeks?.some(ew => areSameWeeks(week, ew));

                // Special case: Show checkout date for extension weeks
                if (isExtensionWeek && isAnySelectedWeek) {
                  const checkoutText = formatInTimeZone(week.endDate, 'UTC', 'MMM d');
                  const isActualCheckout = extensionWeeks && extensionWeeks.length > 0 && 
                    areSameWeeks(week, extensionWeeks[extensionWeeks.length - 1]);
                  
                  if (isActualCheckout) {
                    return (
                      <div className="flex items-center justify-center text-primary w-full max-w-full">
                        <span className={`${multiElementFontSize} font-display`}>→ {checkoutText}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center justify-center text-secondary w-full max-w-full">
                        <span className={`${multiElementFontSize} font-display`}>{checkoutText}</span>
                      </div>
                    );
                  }
                }

                if (isFirstSelected && effectiveStartDate) {
                  const dateText = formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d');
                  return (
                    <div className="flex items-center justify-center gap-1 text-primary w-full max-w-full">
                      <span className={`${multiElementFontSize} font-display`}>{dateText}</span>
                      <span>→</span>
                    </div>
                  );
                }
                if (isLastSelected && !isExtensionWeek) {
                  const dateText = formatInTimeZone(week.endDate, 'UTC', 'MMM d');
                  return (
                    <div className="flex items-center justify-center gap-1 text-primary w-full max-w-full">
                      <span>→</span>
                      <span className={`${multiElementFontSize} font-display`}>{dateText}</span>
                    </div>
                  );
                }
                if (isAnySelectedWeek && !isFirstSelected && !isLastSelected && !isExtensionWeek) {
                  return null;
                }
                if (!isAnySelectedWeek) {
                  if (isAfter(week.startDate, firstSelected.startDate)) {
                    const dateText = formatInTimeZone(week.endDate, 'UTC', 'MMM d');
                    return (
                      <div className="flex items-center justify-center text-primary w-full max-w-full">
                        <span className={`${multiElementFontSize} font-display`}>{dateText}</span>
                      </div>
                    );
                  }
                }
              }

              // If a single week is selected
              if (selectedWeeks.length === 1) {
                const selectedWeek = selectedWeeks[0];
                const isSelectedWeek = areSameWeeks(week, selectedWeek);
                const isExtensionWeek = extensionWeeks?.some(ew => areSameWeeks(week, ew));
                
                if (isSelectedWeek && isExtensionWeek) {
                  const checkoutText = formatInTimeZone(week.endDate, 'UTC', 'MMM d');
                  const isActualCheckout = extensionWeeks && extensionWeeks.length > 0 && 
                    areSameWeeks(week, extensionWeeks[extensionWeeks.length - 1]);
                  
                  if (isActualCheckout) {
                    return (
                      <div className="flex items-center justify-center text-primary w-full max-w-full">
                        <span className={`${multiElementFontSize} font-display`}>→ {checkoutText}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center justify-center text-secondary w-full max-w-full">
                        <span className={`${multiElementFontSize} font-display`}>{checkoutText}</span>
                      </div>
                    );
                  }
                }
                
                if (isSelectedWeek && effectiveStartDate && !isExtensionWeek) {
                  const startText = formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d');
                  const endText = formatInTimeZone(week.endDate, 'UTC', 'MMM d');
                  return (
                    <div className="flex items-center justify-center gap-1 text-primary w-full max-w-full">
                      <span className={`${multiElementFontSize} font-display`}>{startText}</span>
                      <span>→</span>
                      <span className={`${multiElementFontSize} font-display`}>{endText}</span>
                    </div>
                  );
                }
                else {
                  const isSubsequent = isAfter(week.startDate, selectedWeek.endDate);
                  const isNextSelectable = isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode); 
                  if (isSubsequent && isNextSelectable) {
                    const dateText = formatInTimeZone(week.endDate, 'UTC', 'MMM d');
                    return (
                      <div className="flex items-center justify-center text-primary w-full max-w-full">
                        <span className={`${multiElementFontSize} font-display`}>{dateText}</span>
                      </div>
                    );
                  }
                }
              }

              // Fallback display
              let fallbackDisplayDate = week.startDate;
              if (week.flexibleDates?.length) {
                const sortedFlexDates = [...week.flexibleDates].sort((a, b) => a.getTime() - b.getTime());
                fallbackDisplayDate = sortedFlexDates[0];
              }
              const fallbackText = formatInTimeZone(fallbackDisplayDate, 'UTC', 'MMM d');
              return (
                <div className="flex items-center justify-center text-primary w-full max-w-full">
                  <span className={`${singleDateFontSize} font-display`}>{fallbackText}</span>
                </div>
              );
            })()}
          </div>

          {/* Combined info display */}
          {(() => {
            const diffTime = week.endDate.getTime() - week.startDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const isMultiWeekSelection = selectedWeeks.length > 2;
            const isFirstSelected = selectedWeeks.length > 0 && areSameWeeks(week, selectedWeeks[0]);
            const isLastSelected = selectedWeeks.length > 0 && areSameWeeks(week, selectedWeeks[selectedWeeks.length - 1]);
            const isInBetween = isMultiWeekSelection && !isFirstSelected && !isLastSelected;

            const infoParts = [];

            if (!isIntermediateSelected && week.name) {
              infoParts.push(week.name);
            }

            if (week.flexibleDates && week.flexibleDates.length > 0 && !selectedWeeks.length) {
              infoParts.push(`${week.flexibleDates.length} ${week.flexibleDates.length === 1 ? 'date' : 'dates'}`);
            }

            if (diffDays !== 7 && !week.isEdgeWeek && !isInBetween) {
              infoParts.push(`${diffDays} ${diffDays === 1 ? 'day' : 'days'}`);
            }

            if (isAdmin && (week.status === 'hidden' || week.status === 'deleted')) {
              infoParts.push(week.status);
            }

            if (infoParts.length === 0) return null;

            const isAnySelectedWeek = selectedWeeks.some(sw => areSameWeeks(week, sw));
            if (isAnySelectedWeek) return null;

            const combinedText = infoParts.join(' • ');
            const hasLink = !!week.link;

            if (hasLink && week.name) {
              const safeHref = week.link?.startsWith('http') || week.link?.startsWith('//')
                ? week.link
                : `//${week.link}`;

              return (
                <div className="w-full px-1 overflow-hidden flex-shrink-0 h-[14px] xs:h-[16px] sm:h-[28px] flex items-start sm:items-center">
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={clsx(
                      'font-display text-[8px] xs:text-[9px] sm:text-[10px] underline hover:text-accent-primary transition-colors duration-200 block w-full',
                      'truncate sm:whitespace-normal sm:line-clamp-2 sm:leading-tight',
                      isAdmin && (week.status === 'hidden' || week.status === 'deleted') ? (
                        week.status === 'hidden' ? 'text-yellow-500' : 'text-red-500'
                      ) : 'text-secondary'
                    )}
                    title={`${combinedText} (opens external link)`}
                  >
                    {combinedText}
                  </a>
                </div>
              );
            }

            return (
              <div className="w-full px-1 overflow-hidden flex-shrink-0 h-[14px] xs:h-[16px] sm:h-[28px] flex items-start sm:items-center">
                <div 
                  className={clsx(
                    'font-display text-[8px] xs:text-[9px] sm:text-[10px] w-full',
                    'truncate sm:whitespace-normal sm:line-clamp-2 sm:leading-tight',
                    isAdmin && (week.status === 'hidden' || week.status === 'deleted') ? (
                      week.status === 'hidden' ? 'text-yellow-500' : 'text-red-500'
                    ) : week.flexibleDates && week.flexibleDates.length > 0 && !selectedWeeks.length ? 'text-indigo-500' : 'text-secondary'
                  )}
                  title={combinedText}
                >
                  {combinedText}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Fireflies for selected weeks */}
      {isSelected && !disableFireflies && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
          <Fireflies 
            count={2}
            color="#fddba3"
            minSize={0.5}
            maxSize={2}
            ambient={true}
            contained={true}
            className="relative w-full h-full"
          />
        </div>
      )}

      {/* Bottom border for season indication */}
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0 transition-all duration-300',
          isSelected ? 'h-1.5 sm:h-2' : 'h-1 sm:h-1.5',
          isContentVisible && !isSelected && {
            'bg-season-low': getSeasonName(week.startDate) === 'Low Season',
            'bg-season-medium': getSeasonName(week.startDate) === 'Medium Season',
            'bg-season-summer': getSeasonName(week.startDate) === 'Summer Season',
          },
          isSelected && 'bg-accent-primary'
        )}
      />
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  const prevSelectedIds = prevProps.selectedWeeks.map(w => w.id).join(',');
  const nextSelectedIds = nextProps.selectedWeeks.map(w => w.id).join(',');
  
  return (
    prevProps.week.id === nextProps.week.id &&
    prevSelectedIds === nextSelectedIds &&
    prevProps.isAdmin === nextProps.isAdmin &&
    prevProps.testMode === nextProps.testMode &&
    prevProps.extensionWeeks?.length === nextProps.extensionWeeks?.length
  );
});

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
  testMode = false,
  columns,
  disableFireflies = false,
  disabledWeeks = [],
  extensionWeeks = [],
}: WeekSelectorProps) {
  // PERFORMANCE: Removed double render investigation logging for better performance
  
  // === PERFORMANCE TIMING START ===
  const renderStart = performance.now();
  console.log('[PERF] WeekSelector render START');
  
  // PERFORMANCE: Removed verbose prop logging

  // Filter out partial weeks at the edges of the date range
  const filteredWeeks = weeks.filter(week => {
    // If it's an edge week (first or last in the range)
    if (week.isEdgeWeek) {
      // Check if it's a partial week (not a full 7 days)
      const diffTime = week.endDate.getTime() - week.startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because both start and end dates are inclusive
      
      // If it's a partial week at the edge, filter it out
      if (diffDays !== 7) {
        console.log('[WeekSelector] Filtering out partial edge week:', getSimplifiedWeekInfo(week, isAdmin, selectedWeeks, testMode, weeks));
        return false;
      }
    }
    return true;
  });

  // PERFORMANCE: Removed filtered weeks logging


  
  const [selectedFlexDate, setSelectedFlexDate] = useState<Date | null>(null);
  const [flexModalWeek, setFlexModalWeek] = useState<Week | null>(null);
  const [showSecretEventModal, setShowSecretEventModal] = useState(false);
  const [isRangeSelectionModal, setIsRangeSelectionModal] = useState(false);
  
  // PERFORMANCE: Removed prop change monitoring for better performance

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
    // PERFORMANCE: Removed verbose click logging
    
    // Add debug logging for blocked week detection
    console.log('[WeekSelector] Week clicked:', {
      weekId: week.id,
      startDate: formatDateForDisplay(week.startDate),
      endDate: formatDateForDisplay(week.endDate),
      isBlocked: isBlockedFranceEventWeek(week),
      isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode, weeks),
      clickedWeekDetails: {
        startMonth: week.startDate.getMonth(),
        startDay: week.startDate.getDate(),
        startYear: week.startDate.getFullYear(),
        endMonth: week.endDate.getMonth(),
        endDay: week.endDate.getDate(),
        endYear: week.endDate.getFullYear()
      }
    });

    // If the week is already selected, we're trying to deselect it
    if (isWeekSelected(week)) {
      // Get all weeks that should be deselected when clicking this week
      const weeksToDeselect = getWeeksToDeselect(week, selectedWeeks, isAdmin, weeks);
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
        // PERFORMANCE: Removed debug logging
        onWeeksDeselect(weeksToDeselect);
        return;
      }
      
      // Otherwise fall back to single week deselection
      console.log('[WeekSelector] Using single week deselection');
              // PERFORMANCE: Removed debug logging
      onWeekSelect(week);
      
      // Log a warning if there are more weeks to deselect but we can't
      if (weeksToDeselect.length > 1) {
        console.warn('[WeekSelector] Multiple weeks should be deselected, but onWeeksDeselect is not provided. Some weeks may remain selected incorrectly.');
      }
      
      return;
    }
    
    // Check if this week itself is blocked
    if (isBlockedFranceEventWeek(week)) {
      console.log('[WeekSelector] 🚨 BLOCKED WEEK DETECTED - Opening SecretEventModal');
      console.log('[WeekSelector] Setting modal state:', { isRangeSelectionModal: false, showSecretEventModal: true });
      setIsRangeSelectionModal(false); // Direct click
      setShowSecretEventModal(true);
      return;
    }
    
    // Check if selecting this week would create a range that includes blocked weeks (only for "after" selections)
    if (selectedWeeks.length > 0) {
      const firstSelected = selectedWeeks[0];
      
      // Check if the new week would be after the first selected week (and after the blocked week)
      if (week.startDate.getTime() > firstSelected.startDate.getTime()) {
        // Check if there are blocked weeks between the first selected week and the new week
        if (hasBlockedWeeksBetween(firstSelected, week, weeks)) {
          console.log('[WeekSelector] 🚨 BLOCKED WEEKS BETWEEN DETECTED (after selection) - Opening SecretEventModal');
          console.log('[WeekSelector] Setting modal state:', { isRangeSelectionModal: true, showSecretEventModal: true });
          setIsRangeSelectionModal(true); // Range selection
          setShowSecretEventModal(true);
          return;
        }
      }
    }
    
    // REMOVED: Range selection modal logic since UX doesn't allow changing check-in dates that way
    
    // If we're selecting a new week (not deselecting)
    if (!isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode, weeks)) {
      console.log('[WeekSelector] Week not selectable:', {
        isAdmin,
        weekStatus: week.status,
        weekStartDate: formatDateForDisplay(week.startDate),
        isBlockedFranceEvent: isBlockedFranceEventWeek(week),
        isSelectable: isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode, weeks)
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
      onMaxWeeksReached?.(); // Show the "Hold Your Horses!" modal
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
  }, [onWeekSelect, onWeeksDeselect, isAdmin, selectedWeeks, isWeekSelected, onMaxWeeksReached]);

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
      durationDays: Math.floor((flexModalWeek.endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      originalDurationDays: Math.floor((flexModalWeek.endDate.getTime() - flexModalWeek.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
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
    const isSelectableFlag = isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode, weeks);
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
  }, [isWeekSelected, isAdmin, selectedWeeks, accommodationTitle, testMode]);

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
      console.log(`[DOUBLE_RENDER] STATE UPDATE: onWeeksDeselect(clear) - fallback`);
      onWeeksDeselect(selectedWeeks);
      return;
    }
    
    // Last resort: fallback to deselecting the arrival week, which should cascade
    if (selectedWeeks.length > 0) {
      console.log('[WeekSelector] Using arrival week deselection to clear all weeks');
      console.log(`[DOUBLE_RENDER] STATE UPDATE: onWeekSelect(clear) - fallback`);
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

  // Group weeks by month
  const weeksByMonth = useMemo(() => {
    const weekGroupingStart = performance.now();
    console.log('[PERF] Week grouping START');
    
    const grouped = new Map<string, Week[]>();
    
    filteredWeeks.forEach(week => {
      // Use the week's start date to determine which month it belongs to
      // Use formatInTimeZone to ensure UTC-based month grouping
      const monthKey = formatInTimeZone(week.startDate, 'UTC', 'yyyy-MM');
      const monthWeeks = grouped.get(monthKey) || [];
      monthWeeks.push(week);
      grouped.set(monthKey, monthWeeks);
    });
    
    // Convert to array and sort by month
    const result = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, weeks]) => ({
        monthKey,
        // Use UTC to create the month date to avoid timezone issues
        monthDate: new Date(Date.UTC(
          parseInt(monthKey.substring(0, 4)), // year
          parseInt(monthKey.substring(5, 7)) - 1, // month (0-indexed)
          1 // day
        )),
        weeks
      }));
    
    const weekGroupingEnd = performance.now();
    console.log(`[PERF] Week grouping DONE: ${(weekGroupingEnd - weekGroupingStart).toFixed(2)}ms`);
    
    return result;
  }, [filteredWeeks]);

  // Helper to check if a week is disabled (always selected, not clickable)
  const isWeekDisabled = useCallback((week: Week) => {
    return disabledWeeks.some(dw => areSameWeeks(dw, week));
  }, [disabledWeeks]);

  // === PERFORMANCE TIMING - BEFORE RENDER ===
  const mainRenderStart = performance.now();
  console.log('[PERF] Main render loop START');

  return (
    <>
      <div className="space-y-6">
        {/* Render each month as its own row */}
        {weeksByMonth.map(({ monthKey, monthDate, weeks: monthWeeks }) => {
          const monthRenderStart = performance.now();
          console.log(`[PERF] Month ${monthKey} render START (${monthWeeks.length} weeks)`);
          
          return (
          <div key={monthKey}>
            {/* Week grid for this month */}
            <div className={clsx(
              'grid gap-1.5 xs:gap-2 sm:gap-3 md:gap-4',
              columns ? `grid-cols-${columns}` : 'grid-cols-1 xxs:grid-cols-2 xs:grid-cols-3 sm:grid-cols-5'
            )}>
              {monthWeeks.map((week, index) => {
                // PERFORMANCE OPTIMIZATION: Removed excessive logging for faster rendering
                const isContentVisible = isWeekSelectable(week, isAdmin, selectedWeeks, undefined, testMode) || isAdmin || isBlockedFranceEventWeek(week);

                // Define fixed height classes - Using the larger dimensions for consistency
                const fixedHeightClass = 'h-[80px] xxs:h-[90px] xs:h-[100px] sm:h-[110px]';

                // Adjust padding based on column count for better fit
                const paddingClass = 'p-2.5 xxs:p-3 xs:p-3.5 sm:p-4.5';

                // Determine if the week is an intermediate selected week
                const isIntermediateSelected = isWeekSelected(week) && isWeekBetweenSelection(week, selectedWeeks);

                const disabled = isWeekDisabled(week);

                return (
                  <WeekComponent
                    key={week.id || `week-${index}`}
                    week={week}
                    index={index}
                    isContentVisible={isContentVisible}
                    selectedWeeks={selectedWeeks}
                    extensionWeeks={extensionWeeks}
                    isAdmin={isAdmin}
                    testMode={testMode}
                    handleWeekClick={handleWeekClick}
                    isWeekSelected={isWeekSelected}
                    isWeekDisabled={isWeekDisabled}
                    filteredWeeks={filteredWeeks}
                    disableFireflies={disableFireflies}
                  />
                );
              })}
            </div>
          </div>
          );
          
          const monthRenderEnd = performance.now();
          console.log(`[PERF] Month ${monthKey} render DONE: ${(monthRenderEnd - monthRenderStart).toFixed(2)}ms`);
        })}
      </div>

      {/* === PERFORMANCE TIMING COMPLETE === */}
      {(() => {
        const renderEnd = performance.now();
        console.log(`[PERF] WeekSelector render COMPLETE: ${(renderEnd - renderStart).toFixed(2)}ms`);
        console.log(`[PERF] Main render loop DONE: ${(renderEnd - mainRenderStart).toFixed(2)}ms`);
        return null;
      })()}

      <FlexibleCheckInModal
        week={flexModalWeek!}
        isOpen={!!flexModalWeek}
        onClose={() => setFlexModalWeek(null)}
        onDateSelect={handleFlexDateSelect}
      />
      
      <SecretEventModal
        isOpen={showSecretEventModal}
        onClose={() => setShowSecretEventModal(false)}
        isRangeSelection={isRangeSelectionModal}
      />
    </>
  );
}
