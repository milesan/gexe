import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Home, X, HelpCircle } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths, subMonths, startOfDay, isSameDay, addDays, differenceInDays } from 'date-fns';
import { WeekSelector } from '../components/WeekSelector';
import { formatDateForDisplay, normalizeToUTCDate, doDateRangesOverlap, calculateDurationDiscountWeeks, calculateTotalWeeksDecimal } from '../utils/dates';
import { CabinSelector } from '../components/CabinSelector';
import { BookingSummary, SeasonBreakdown } from '../components/BookingSummary';
import { MaxWeeksModal } from '../components/MaxWeeksModal';
import { WeekCustomizationModal } from '../components/admin/WeekCustomizationModal';
import { DiscountModal } from '../components/DiscountModal';
import { generateWeeksWithCustomizations, generateSquigglePath, getWeeksInRange } from '../utils/dates';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { useSession } from '../hooks/useSession';
import { motion } from 'framer-motion';
import { convertToUTC1 } from '../utils/timezone';
import { useCalendar } from '../hooks/useCalendar';
import { Week, WeekStatus } from '../types/calendar';
import { CalendarService } from '../services/CalendarService';
import { CalendarConfigButton } from '../components/admin/CalendarConfigButton';
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown, calculateWeeklyAccommodationPrice } from '../utils/pricing';
import { areSameWeeks } from '../utils/dates';
import { clsx } from 'clsx';
import { calculateDaysBetween } from '../utils/dates';
import { bookingService } from '../services/BookingService';
import { loadStripe } from '@stripe/stripe-js';
import * as Tooltip from '@radix-ui/react-tooltip';
import { InfoBox } from '../components/InfoBox';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Season legend component (Moved from WeekSelector)
const SeasonLegend = () => {
  return (
    // Decreased bottom margin to bring it closer to the header below
    <div className="flex flex-wrap justify-start gap-4 xs:gap-5 sm:gap-8 mb-4">
      {/* Increased spacing between circle and text */}
      <div className="flex items-center gap-1.5 xs:gap-2">
        {/* Made circle slightly larger */}
        <div className="w-4 h-4 xs:w-4.5 xs:h-4.5 rounded-full bg-season-low"></div>
        {/* Increased font size */}
        <span className="text-lg font-lettra-bold uppercase text-secondary whitespace-nowrap">Low (Nov-May)</span>
      </div>
      {/* Increased spacing between circle and text */}
      <div className="flex items-center gap-1.5 xs:gap-2">
        {/* Made circle slightly larger */}
        <div className="w-4 h-4 xs:w-4.5 xs:h-4.5 rounded-full bg-season-medium"></div>
        {/* Increased font size */}
        <span className="text-lg font-lettra-bold uppercase text-secondary whitespace-nowrap">Medium (Jun, Oct)</span>
      </div>
      {/* Increased spacing between circle and text */}
      <div className="flex items-center gap-1.5 xs:gap-2">
        {/* Made circle slightly larger */}
        <div className="w-4 h-4 xs:w-4.5 xs:h-4.5 rounded-full bg-season-summer"></div>
        {/* Increased font size */}
        <span className="text-lg font-lettra-bold uppercase text-secondary whitespace-nowrap">Summer (Jul-Sep)</span>
      </div>
    </div>
  );
};

export function Book2Page() {
  // Get current date and set the initial month
  const today = new Date();
  const initialMonth = startOfDay(startOfMonth(today));
  
  console.log('[Book2Page] Initializing with current month:', {
    today: formatDateForDisplay(today),
    initialMonth: formatDateForDisplay(initialMonth)
  });

  const { accommodations, loading: accommodationsLoading } = useWeeklyAccommodations();
  const [selectedWeeks, setSelectedWeeks] = useState<Week[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [showMaxWeeksModal, setShowMaxWeeksModal] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedWeekForCustomization, setSelectedWeekForCustomization] = useState<Week | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [seasonBreakdown, setSeasonBreakdown] = useState<SeasonBreakdown | undefined>(undefined);
  const [weeklyAccommodationInfo, setWeeklyAccommodationInfo] = useState<Record<string, { price: number | null; avgSeasonalDiscount: number | null }>>({});

  // Calculate combined discount
  const calculateCombinedDiscount = useCallback((weeks: Week[]): number => {
    console.log('[Book2Page] Calculating combined discount...');
    // Find the accommodation object first
    const accommodation = selectedAccommodation && accommodations
        ? accommodations.find(a => a.id === selectedAccommodation)
        : null;
    const accommodationTitle = accommodation?.title || '';
    const accommodationPrice = accommodation?.base_price ?? 0;

    if (!accommodation || weeks.length === 0) {
      console.log('[Book2Page] No accommodation or weeks selected, combined discount is 0.');
      return 0;
    }

    // === ALIGN DURATION CALCULATION ===
    // Use the consistent utility function
    const completeWeeks = calculateDurationDiscountWeeks(weeks);
    const durationDiscount = getDurationDiscount(completeWeeks);
    console.log('[Book2Page] Combined Discount - Duration:', { completeWeeks, durationDiscount });

    // === ALIGN SEASONAL CALCULATION (mimic useDiscounts logic) ===
    let averageSeasonalDiscount = 0;
    // Get breakdown based on the actual selected weeks
    const checkInDate = weeks[0].startDate;
    const checkOutDate = weeks[weeks.length - 1].endDate;
    const seasonBreakdown = getSeasonBreakdown(checkInDate, checkOutDate);
    
    // Determine if seasonal discount applies (same conditions as modal)
    const showSeasonalSection = accommodationPrice > 0 
        && seasonBreakdown.seasons.length > 0 
        && !accommodationTitle.toLowerCase().includes('dorm');

    if (showSeasonalSection) {
       const totalNightsInSeasons = seasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
       if (totalNightsInSeasons > 0) {
           averageSeasonalDiscount = seasonBreakdown.seasons.reduce((sum, season) => 
              sum + (season.discount * season.nights), 0) / totalNightsInSeasons;
           console.log('[Book2Page] Combined Discount - Seasonal (Calculated):', { totalNightsInSeasons, averageSeasonalDiscount, breakdown: seasonBreakdown.seasons });
       } else {
          averageSeasonalDiscount = 0; 
          console.warn("[Book2Page] Combined Discount - Calculated zero nights in seasons for seasonal discount.");
       }
    } else {
        console.log('[Book2Page] Combined Discount - Seasonal (Not Applicable):', { accommodationPrice, hasSeasons: seasonBreakdown.seasons.length > 0, isDorm: accommodationTitle.toLowerCase().includes('dorm') });
    }
    
    // Calculate combined discount (multiplicative)
    const combined = 1 - (1 - averageSeasonalDiscount) * (1 - durationDiscount);
    console.log('[Book2Page] Combined Discount - Final Calculation:', { averageSeasonalDiscount, durationDiscount, combined });
    
    // Return the combined discount factor (0 to 1)
    return combined;
    // The display logic will handle converting this to a percentage and rounding.
  }, [selectedAccommodation, accommodations, selectedWeeks]); // Added selectedWeeks dependency

  // This state holds the result of the calculation above
  const combinedDiscount = calculateCombinedDiscount(selectedWeeks);

  const session = useSession();
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' ||
    session?.user?.email === 'redis213@gmail.com' ||
    session?.user?.email === 'dawn@thegarden.pt' ||
    session?.user?.email === 'simone@thegarden.pt' ||
    session?.user?.email === 'samjlloa@gmail.com';
  const isMobile = window.innerWidth < 768;

  // Calculate end date based on current month and device type
  const calendarEndDate = addMonths(currentMonth, isMobile ? 3 : 4);

  console.log('[Book2Page] Calendar date range:', {
    startDate: formatDateForDisplay(currentMonth),
    endDate: formatDateForDisplay(calendarEndDate),
    monthsDifference: isMobile ? 3 : 4
  });

  // Use our calendar hook
  const { 
    weeks,
    customizations,
    isLoading: calendarLoading,
    createCustomization,
    updateCustomization,
    deleteCustomization,
    setLastRefresh: setCalendarRefresh
  } = useCalendar({
    startDate: currentMonth,
    endDate: calendarEndDate,
    isAdminMode
  });

  // Sync the local refresh state with the useCalendar hook's refresh state
  useEffect(() => {
    setCalendarRefresh(lastRefresh);
  }, [lastRefresh, setCalendarRefresh]);

  console.log('[Book2Page] Calendar state:', {
    weeksCount: weeks?.length,
    customizationsCount: customizations?.length,
    isLoading: calendarLoading
  });

  // Helper functions
  const isFirstOrLastSelectedHelper = useCallback((week: Week, currentSelection: Week[]) => {
    if (!currentSelection || currentSelection.length === 0) return false;
    
    // Get first and last selected weeks
    const firstWeek = currentSelection[0];
    const lastWeek = currentSelection[currentSelection.length - 1];
    
    // Use our consistent comparison helper
    return areSameWeeks(week, firstWeek) || areSameWeeks(week, lastWeek);
  }, []);
  
  // Original isFirstOrLastSelected function that uses the helper
  const isFirstOrLastSelected = useCallback((week: Week) => {
    return isFirstOrLastSelectedHelper(week, selectedWeeks);
  }, [selectedWeeks, isFirstOrLastSelectedHelper]);

  // Add a wrapped setCurrentMonth function with logging
  const handleMonthChange = useCallback((newMonth: Date) => {
    console.log('[Book2Page] Changing month:', {
      from: currentMonth ? formatDateForDisplay(currentMonth) : 'undefined',
      to: formatDateForDisplay(newMonth),
      selectedWeeksCount: selectedWeeks.length,
      calculatedWeeksDecimal: calculateTotalWeeksDecimal(selectedWeeks)
    });
    
    setCurrentMonth(newMonth);
  }, [currentMonth, selectedWeeks]);

  // Main handleWeekSelect function simplified
  const handleWeekSelect = useCallback((week: Week) => {
    console.log('[Book2Page] Handling week selection:', {
      weekId: week.id,
      weekStart: formatDateForDisplay(week.startDate),
      weekEnd: formatDateForDisplay(week.endDate),
      isCustom: week.isCustom,
      selectedWeeksCount: selectedWeeks?.length || 0,
      hasFlexDate: !!week.selectedFlexDate,
      flexDate: week.selectedFlexDate ? formatDateForDisplay(week.selectedFlexDate) : null
    });

    if (isAdminMode) {
      setSelectedWeekForCustomization(week);
      return;
    }

    setSelectedWeeks(prev => {
      // Safety check - if prev is undefined, initialize as empty array
      const currentSelection = prev || [];
      
      // Add detailed logging to show current selection state
      if (currentSelection.length > 0) {
        console.log('[Book2Page] Current selection details:', currentSelection.map((w, idx) => ({
          position: idx,
          id: w.id,
          start: formatDateForDisplay(w.startDate),
          end: formatDateForDisplay(w.endDate),
          hasFlexDate: !!w.selectedFlexDate,
          flexDate: w.selectedFlexDate ? formatDateForDisplay(w.selectedFlexDate) : null
        })));
      }
      
      // Check if already selected using our consistent helper
      const isSelected = currentSelection.some(selectedWeek => 
        areSameWeeks(week, selectedWeek)
      );
      
      // If selected and not first/last, do nothing
      if (isSelected && !isFirstOrLastSelectedHelper(week, currentSelection)) {
        return currentSelection;
      }
      
      // If selected, remove it
      if (isSelected) {
        return currentSelection.filter(selectedWeek => 
          !areSameWeeks(week, selectedWeek)
        );
      }
      
      // If first selection, just return the new week
      if (currentSelection.length === 0) {
        return [week];
      }

      // Handle range selection - get earliest and latest dates
      const earliestDate = currentSelection[0].startDate;
      const latestDate = currentSelection[currentSelection.length - 1].startDate;

      let newWeeks: Week[];
      
      // If selecting a week before the earliest selected week
      if (isBefore(week.startDate, earliestDate)) {
        // First, get all weeks in the range
        const weeksInRange = weeks.filter(w => 
          (w.startDate >= week.startDate && w.startDate <= latestDate) || 
          areSameWeeks(w, week) ||
          currentSelection.some(sw => areSameWeeks(w, sw))
        );
        
        // Then, build a new array using current selection for already selected weeks
        newWeeks = weeksInRange.map(w => {
          // For newly selected weeks that aren't the current week, just use them as-is
          if (!areSameWeeks(w, week) && !currentSelection.some(sw => areSameWeeks(w, sw))) {
            return w;
          }
          
          // For the newly clicked week, use the week parameter directly
          if (areSameWeeks(w, week)) {
            return week;
          }
          
          // For already selected weeks, return the exact same object from current selection
          // to preserve any properties like selectedFlexDate
          const matchingWeek = currentSelection.find(sw => areSameWeeks(w, sw));
          if (matchingWeek) {
            return matchingWeek;
          }
          
          // Fallback (shouldn't happen)
          return w;
        });
      } 
      // If selecting a week after the latest selected week
      else if (isAfter(week.startDate, latestDate)) {
        // First, get all weeks in the range
        const weeksInRange = weeks.filter(w => 
          (w.startDate >= earliestDate && w.startDate <= week.startDate) || 
          areSameWeeks(w, week) ||
          currentSelection.some(sw => areSameWeeks(w, sw))
        );
        
        // Then, build a new array using current selection for already selected weeks
        newWeeks = weeksInRange.map(w => {
          // For newly selected weeks that aren't the current week, just use them as-is
          if (!areSameWeeks(w, week) && !currentSelection.some(sw => areSameWeeks(w, sw))) {
            return w;
          }
          
          // For the newly clicked week, use the week parameter directly
          if (areSameWeeks(w, week)) {
            return week;
          }
          
          // For already selected weeks, return the exact same object from current selection
          // to preserve any properties like selectedFlexDate
          const matchingWeek = currentSelection.find(sw => areSameWeeks(w, sw));
          if (matchingWeek) {
            return matchingWeek;
          }
          
          // Fallback (shouldn't happen)
          return w;
        });
      } 
      // If selecting a week in the middle, don't change the selection
      else {
        return currentSelection;
      }

      // Add detailed logging to show new selection
      console.log('[Book2Page] New selection details:', newWeeks.map((w, idx) => ({
        position: idx,
        id: w.id,
        start: formatDateForDisplay(w.startDate),
        end: formatDateForDisplay(w.endDate),
        hasFlexDate: !!w.selectedFlexDate,
        flexDate: w.selectedFlexDate ? formatDateForDisplay(w.selectedFlexDate) : null
      })));

      // Check if we've exceeded the maximum number of allowed weeks
      const MAX_WEEKS_ALLOWED = 12;
      const totalWeeksDecimal = calculateTotalWeeksDecimal(newWeeks);
      
      if (totalWeeksDecimal > MAX_WEEKS_ALLOWED) {
        console.log('[Book2Page] Maximum weeks limit reached:', {
          weeksCount: newWeeks.length,
          calculatedWeeks: totalWeeksDecimal,
          max: MAX_WEEKS_ALLOWED
        });
        setShowMaxWeeksModal(true);
        return currentSelection;
      }

      return newWeeks;
    });
  }, [isAdminMode, weeks, isFirstOrLastSelectedHelper, selectedWeeks]);

  // New handler for deselecting multiple weeks at once
  const handleWeeksDeselect = useCallback((weeksToDeselect: Week[]) => {
    console.log('[Book2Page] Handling batch week deselection:', {
      count: weeksToDeselect.length,
      weeks: weeksToDeselect.map(w => ({
        id: w.id,
        start: formatDateForDisplay(w.startDate),
        end: formatDateForDisplay(w.endDate)
      }))
    });

    // Filter out all the weeks to deselect in one batch operation
    setSelectedWeeks(prev => {
      // Safety check - if prev is undefined, initialize as empty array
      const currentSelection = prev || [];
      
      // If nothing to deselect, return unchanged
      if (weeksToDeselect.length === 0) return currentSelection;
      
      // Filter out all weeks that should be deselected
      return currentSelection.filter(selectedWeek => 
        !weeksToDeselect.some(weekToDeselect => 
          areSameWeeks(weekToDeselect, selectedWeek)
        )
      );
    });
  }, [setSelectedWeeks]);

  /**
   * Handle clearing all selected weeks at once
   * 
   * This leverages the existing handleWeeksDeselect function to clear everything in one operation.
   * It's attached to the Clear Selection button in the WeekSelector component.
   */
  const handleClearSelection = useCallback(() => {
    console.log('[Book2Page] Clearing all selected weeks:', {
      count: selectedWeeks.length
    });
    
    // Simply pass all selected weeks to our existing deselection handler
    if (selectedWeeks.length > 0) {
      handleWeeksDeselect(selectedWeeks);
    }
  }, [handleWeeksDeselect, selectedWeeks]);

  /**
   * Handle saving week customization changes
   * 
   * This function is called when a user saves changes in the WeekCustomizationModal.
   * It delegates the actual update/create logic to the CalendarService, which handles
   * all the complex overlap resolution.
   */
  const handleSaveWeekCustomization = async (updates: {
    status: WeekStatus;
    name?: string;
    startDate?: Date;
    endDate?: Date;
    flexibleDates?: Date[];
  }) => {
    if (!selectedWeekForCustomization) return;

    try {
      // Normalize all dates for consistent handling
      const finalStartDate = normalizeToUTCDate(updates.startDate || selectedWeekForCustomization.startDate);
      const finalEndDate = normalizeToUTCDate(updates.endDate || selectedWeekForCustomization.endDate);
      const flexibleDates = updates.flexibleDates?.map(d => normalizeToUTCDate(d));

      console.log('[Book2Page] Saving week customization:', {
        weekId: selectedWeekForCustomization.id,
        startDate: formatDateForDisplay(finalStartDate),
        endDate: formatDateForDisplay(finalEndDate),
        status: updates.status,
        flexibleDatesCount: flexibleDates?.length || 0
      });

      // Check if this is an existing customization or a new one
      if (selectedWeekForCustomization.isCustom && selectedWeekForCustomization.id) {
        // Update existing customization
        await CalendarService.updateCustomization(selectedWeekForCustomization.id, {
          ...updates,
          startDate: finalStartDate,
          endDate: finalEndDate,
          flexibleDates
        });
      } else {
        // Create new customization
        await CalendarService.createCustomization({
                startDate: finalStartDate,
                endDate: finalEndDate,
                status: updates.status,
                name: updates.name,
          flexibleDates
        });
      }
      
      // Refresh calendar data and close modal
        setLastRefresh(Date.now());
        setSelectedWeekForCustomization(null);
    } catch (error) {
      console.error('[Book2Page] Error saving week customization:', error);
      // Show error to user (you could add a toast notification here)
    }
  };

  /**
   * Handle deleting a week customization (resetting to default)
   * 
   * This function is called when a user clicks the "Reset to Default" button in the WeekCustomizationModal.
   * It deletes the customization from the database, which effectively resets the week to its default state.
   */
  const handleDeleteWeekCustomization = async (weekId: string) => {
    try {
      console.log('[Book2Page] Deleting week customization:', { weekId });
      
      // Delete the customization
      const success = await CalendarService.deleteCustomization(weekId);
      
      if (success) {
        console.log('[Book2Page] Successfully deleted week customization');
      } else {
        console.error('[Book2Page] Failed to delete week customization');
      }
      
      // Refresh calendar data and close modal
      setLastRefresh(Date.now());
      setSelectedWeekForCustomization(null);
    } catch (error) {
      console.error('[Book2Page] Error deleting week customization:', error);
    }
  };

  useEffect(() => {
    if (!isAdmin && selectedWeeks.length > 0) {
      const today = startOfDay(new Date());
      const filteredWeeks = selectedWeeks.filter(week => {
        const weekStartDate = startOfDay(new Date(week.startDate));
        return weekStartDate >= today;
      });
      
      if (filteredWeeks.length !== selectedWeeks.length) {
        console.log('[Book2Page] Removing past weeks from selection', {
          originalCount: selectedWeeks.length,
          newCount: filteredWeeks.length
        });
        setSelectedWeeks(filteredWeeks);
      }
    }
  }, [selectedWeeks, isAdmin]);

  const isLoading = accommodationsLoading || calendarLoading;

  // Calculate season breakdown for the selected weeks
  const calculateSeasonBreakdown = useCallback((weeks: Week[]): SeasonBreakdown => {
    if (weeks.length === 0) {
      const discount = getSeasonalDiscount(currentMonth, accommodationTitle);
      const seasonName = discount === 0 ? 'Summer Season' : 
                         discount === 0.15 ? 'Medium Season' : 
                         'Low Season';
      return { 
        hasMultipleSeasons: false, 
        seasons: [{ name: seasonName, discount, nights: 0 }] 
      };
    }

    // Sort the weeks to ensure we're processing dates in chronological order
    const sortedWeeks = [...weeks].sort((a, b) => 
      a.startDate.getTime() - b.startDate.getTime()
    );
    
    // Get the overall stay period
    const startDate = sortedWeeks[0].startDate;
    const endDate = sortedWeeks[sortedWeeks.length - 1].endDate;
    
    // Calculate total nights - simple end date minus start date
    const totalNights = differenceInDays(endDate, startDate);
    
    // Group nights by season
    const seasonMap: Record<string, { name: string; discount: number; nights: number }> = {};
    
    console.log('[Book2Page] Calculating season breakdown:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalNights
    });

    // Manually generate dates in UTC to avoid timezone issues with eachDayOfInterval
    const allDates: Date[] = [];
    // Clone start date to avoid modifying the original
    let currentDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())); 
    // We want to iterate up to, but not including, the endDate
    const finalExclusiveEndDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    console.log('[Book2Page] Manual Date Generation Start:', { 
        start: currentDate.toISOString(), 
        endExclusive: finalExclusiveEndDate.toISOString() 
    });

    // Loop while the current date is strictly before the final end date
    while (currentDate.getTime() < finalExclusiveEndDate.getTime()) {
        // Add a clone of the current UTC date to the array
        allDates.push(new Date(currentDate)); 
        
        // Increment the day in UTC for the next iteration
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    console.log('[Book2Page] Manual Date Generation Complete:', { 
        count: allDates.length, 
        firstDate: allDates[0]?.toISOString(), 
        lastDate: allDates[allDates.length - 1]?.toISOString() 
    });

    // Count the nights per season using the date of each night
    allDates.forEach((date: Date) => {
      console.log('[Book2Page] Calculating season breakdown:', {
        date: date.toISOString(),
        discount: getSeasonalDiscount(date, accommodationTitle)
      });
      const discount = getSeasonalDiscount(date, accommodationTitle);
      const seasonName = discount === 0 ? 'Summer Season' : 
                         discount === 0.15 ? 'Medium Season' : 
                         'Low Season';
      const key = `${seasonName}-${discount}`;
      
      if (!seasonMap[key]) {
        seasonMap[key] = { name: seasonName, discount, nights: 0 };
      }
      
      seasonMap[key].nights++;
    });
    
    // Validate our calculations
    const totalCalculatedNights = Object.values(seasonMap).reduce(
      (sum, season) => sum + season.nights, 0
    );
    
    if (totalCalculatedNights !== totalNights) {
      console.warn(`[Book2Page] Night calculation mismatch: ${totalCalculatedNights} vs expected ${totalNights}`);
    }
    
    const seasons = Object.values(seasonMap).sort((a, b) => b.nights - a.nights);
    const hasMultipleSeasons = seasons.length > 1;
    
    console.log('[Book2Page] Season breakdown:', { 
      hasMultipleSeasons, 
      seasons,
      totalNights,
      dateRange: `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')}`,
      allDates: allDates.map(d => format(d, 'MMM dd')),
    });
    
    return { hasMultipleSeasons, seasons };
  }, [currentMonth]);

  // Update season breakdown when selected weeks or accommodation change
  useEffect(() => {
    // Find the selected accommodation first
    const accommodation = selectedAccommodation && accommodations
        ? accommodations.find(a => a.id === selectedAccommodation)
        : null;
    const accommodationPrice = accommodation?.base_price ?? 0;
    // Also get the title to check for Dorm
    const accommodationTitle = accommodation?.title ?? '';

    // Only calculate breakdown if weeks are selected, price > 0, AND it's not a Dorm
    if (selectedWeeks.length > 0 && accommodationPrice > 0 && accommodationTitle !== 'Dorm') {
      console.log('[Book2Page] Calculating season breakdown (Price > 0 and not Dorm).');
      const breakdown = calculateSeasonBreakdown(selectedWeeks);
      setSeasonBreakdown(breakdown);
    } else {
      // Clear breakdown if no weeks selected, no accommodation, price is 0, or it's a Dorm
      if (selectedWeeks.length === 0) {
         console.log('[Book2Page] Clearing season breakdown: No weeks selected.');
      } else if (!accommodation) {
         console.log('[Book2Page] Clearing season breakdown: No accommodation selected.');
      } else if (accommodationPrice === 0) {
         console.log('[Book2Page] Clearing season breakdown: Accommodation price is 0.');
      } else if (accommodationTitle === 'Dorm') {
         console.log('[Book2Page] Clearing season breakdown: Accommodation is Dorm.');
      }
      setSeasonBreakdown(undefined);
    }
    // Depend on selected weeks, selected accommodation ID, the list of accommodations, and the calculation function
  }, [selectedWeeks, selectedAccommodation, accommodations, calculateSeasonBreakdown]);

  // Fix the isWeekSelected function to safely handle undefined selectedWeeks
  const isWeekSelected = useCallback((week: Week) => {
    if (!selectedWeeks || selectedWeeks.length === 0) return false;
    
    return selectedWeeks.some(selectedWeek => areSameWeeks(week, selectedWeek));
  }, [selectedWeeks]);

  // FlexibleCheckInModal needs to pass both the week and the selected date
  const handleFlexDateSelect = useCallback((date: Date, week: Week) => {
    // --- Use the date directly from the modal --- 
    // It should already be normalized by the modal.
    const normalizedDate = date; // Reverted: Use the input date directly
    
    // --- Log the date received from the modal --- 
    console.log('[DATE_TRACE] Book2Page: Received date from modal:', { dateObj: normalizedDate, iso: normalizedDate?.toISOString?.() });
    
    console.log('[Book2Page] handleFlexDateSelect called with:', {
      dateArgFromModal: formatDateForDisplay(normalizedDate), // Log the date received
      weekId: week?.id,
      weekStartOriginal: week ? formatDateForDisplay(week.startDate) : null,
      weekEndOriginal: week ? formatDateForDisplay(week.endDate) : null,
      weekSelectedFlexOriginal: week?.selectedFlexDate ? formatDateForDisplay(week.selectedFlexDate) : null
    });
    
    if (!week) {
      console.error('[Book2Page] No week provided to handleFlexDateSelect');
      return;
    }
    
    // --- Explicitly construct the new week object ---
    // Use the date from the modal (which should be normalized UTC).
    const selectedWeek: Week = {
      id: week.id, // Preserve original ID
      startDate: normalizedDate, // Use the date from modal as the actual start date
      endDate: week.endDate, // Preserve original end date
      status: 'visible', // Explicitly set status
      name: week.name, // Preserve original name (if any)
      isCustom: true, // Mark as custom due to flex selection changing start date
      isEdgeWeek: week.isEdgeWeek, // Preserve edge status
      flexibleDates: week.flexibleDates, // Preserve the original list of flex dates
      selectedFlexDate: normalizedDate, // Store the chosen flex date
      isFlexibleSelection: true // Add flag
      // Ensure any other essential properties from 'Week' type are preserved if needed
    };
    
    // --- Log the object just before state update --- 
    console.log('[DATE_TRACE] Book2Page: Week object before state update:', { 
      startDateIso: selectedWeek.startDate?.toISOString?.(), 
      selectedFlexDateIso: selectedWeek.selectedFlexDate?.toISOString?.() 
    });
    
    console.log('[Book2Page] Created flexible week:', {
      weekId: selectedWeek.id,
      weekStart: formatDateForDisplay(selectedWeek.startDate),
      weekEnd: formatDateForDisplay(selectedWeek.endDate),
      isCustom: selectedWeek.isCustom,
      isFlexibleSelection: selectedWeek.isFlexibleSelection,
      selectedFlexDate: selectedWeek.selectedFlexDate ? formatDateForDisplay(selectedWeek.selectedFlexDate) : 'undefined'
    });
    
    // Use a direct state update for the first selection to avoid any stale closures
    if (selectedWeeks.length === 0) {
      console.log('[Book2Page] Direct state update for first flex date selection');
      setSelectedWeeks([selectedWeek]);
    } else {
      // For subsequent selections, use the normal handler
      // Make sure handleWeekSelect correctly preserves the selectedWeek object details
      console.log('[Book2Page] Calling handleWeekSelect for subsequent flex date selection');
      handleWeekSelect(selectedWeek);
    }
  }, [handleWeekSelect, selectedWeeks.length]); 

  // Calculates the accommodation title based on the selected accommodation ID
  const accommodationTitle = useMemo(() => {
    const accommodation = selectedAccommodation && accommodations
        ? accommodations.find(a => a.id === selectedAccommodation)
        : null;
    return accommodation?.title || '';
  }, [selectedAccommodation, accommodations]); // Dependencies
  console.log('[Book2Page] Accommodation title:', accommodationTitle);

  // Calculates the accommodation details based on the selected accommodation ID
  const selectedAccommodationDetails = useMemo(() => {
    const accommodation = selectedAccommodation && accommodations
        ? accommodations.find(a => a.id === selectedAccommodation)
        : null;
    // Return price and title for easy access
    return {
        // object: accommodation, // Keep this commented unless needed elsewhere
        title: accommodation?.title || '',
        price: accommodation?.base_price ?? 0
    };
  }, [selectedAccommodation, accommodations]); // Dependencies
  console.log('[Book2Page] Selected Accommodation Details:', selectedAccommodationDetails);

  // NEW: Effect to calculate weekly prices AND average seasonal discounts for ALL accommodations
  useEffect(() => {
    console.log('[Book2Page] useEffect - Calculating ALL weekly accommodation info triggered.');
    
    const normalizedCurrentMonth = normalizeToUTCDate(currentMonth);
    const newInfo: Record<string, { price: number | null; avgSeasonalDiscount: number | null }> = {};

    if (accommodations && accommodations.length > 0) {
      accommodations.forEach(acc => {
        if ((acc as any).parent_accommodation_id) return;

        try {
          // 2. Calculate average seasonal discount separately FIRST (for both display and calculation)
          let avgSeasonalDiscount: number = 0; // Default to number, handle null later if needed
          if (selectedWeeks.length > 0 && !acc.title.toLowerCase().includes('dorm') && acc.base_price > 0) {
            const breakdown = getSeasonBreakdown(selectedWeeks[0].startDate, selectedWeeks[selectedWeeks.length - 1].endDate);
            const totalNightsInSeasons = breakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
            if (totalNightsInSeasons > 0) {
              // Weighted average based on nights in each season
              avgSeasonalDiscount = Math.round(breakdown.seasons.reduce((sum, season) => 
                sum + (season.discount * season.nights), 0) / totalNightsInSeasons * 100) / 100;
            } else {
               avgSeasonalDiscount = 0; // Or handle as needed if no nights found
            }
          } else if (!acc.title.toLowerCase().includes('dorm') && acc.base_price > 0) {
            // Fallback for no selected weeks - use reference date
             avgSeasonalDiscount = getSeasonalDiscount(normalizedCurrentMonth, acc.title);
          } else {
            // Dorms or free accommodations have no seasonal discount
            avgSeasonalDiscount = 0;
          }

          // 1. Calculate final weekly price using the pre-calculated seasonal discount
          const weeklyPrice = calculateWeeklyAccommodationPrice(
            acc, 
            selectedWeeks,
            // Pass the calculated avgSeasonalDiscount here
            avgSeasonalDiscount 
          );
          
          // Store both the final price and the definitive seasonal discount used
          newInfo[acc.id] = { price: weeklyPrice, avgSeasonalDiscount };

        } catch (error) {
          console.error(`[Book2Page] Error calculating info for ${acc.title} (ID: ${acc.id}):`, error);
          newInfo[acc.id] = { price: null, avgSeasonalDiscount: null }; // Set defaults on error
        }
      });
    } else {
      console.log('[Book2Page] No accommodations loaded, clearing info.');
    }
    
    console.log('[Book2Page] Setting updated weekly info state:', newInfo);
    setWeeklyAccommodationInfo(newInfo);

  }, [selectedWeeks, accommodations, currentMonth]); 

  // NEW: Memoized lookup function returns the info object
  const getDisplayInfo = useCallback((accommodationId: string): { price: number | null; avgSeasonalDiscount: number | null } | null => {
    const info = weeklyAccommodationInfo[accommodationId];
    return info ?? null;
  }, [weeklyAccommodationInfo]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto py-4 xs:py-6 sm:py-8 px-4">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6">
          {/* Left Column - Calendar and Cabin Selector */}
          <div className="lg:col-span-2">
            {/* == START: New wrapper div with horizontal padding == */}
            <div>
              {/* Moved h1 inside wrapper - REMOVING px-* padding now */}
              <h1 className="text-4xl lg:text-[78px] font-display mb-3 xs:mb-4 text-primary pt-14 leading-[1.1] tracking-[-0.02em]">BEGIN YOUR <br /><em>EXISTENTIAL</em> CYCLE</h1>
              
              {/* Outer Note box keeps py-* padding - Setting bottom margin to 32px (mb-8) */}
              <div className="bg-surface/50 py-3 xs:py-4 sm:py-6 mb-8 shadow-sm rounded-sm">
                {/* Using InfoBox component, passing specific padding and max-width */}
                <InfoBox className="px-3 xs:px-4 sm:px-6 max-w-3xl">
                  <div className="flex flex-col gap-3 xs:gap-3 text-primary">
                    <p className="flex items-start gap-2 xs:gap-2.5 text-base font-lettra">
                      The longer you stay, the less € you contribute on both lodging & base-rate per week
                    </p>
                    <p className="flex items-start gap-2 xs:gap-2.5 text-base font-lettra">
                      The quieter the time of year, the less € you contribute on lodging
                    </p>
                  </div>
                </InfoBox>
              </div>
              {/* == END: Moved Admin controls inside wrapper == */}

              {/* Add the admin controls block here */}
              {isAdmin && (
                <div className="flex justify-end mb-3 xs:mb-4">
                  {isAdminMode ? (
                    <div className="flex items-center gap-2 xs:gap-3">
                      <button
                        onClick={() => setIsAdminMode(false)}
                        className="flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-sm font-medium font-mono transition-colors duration-200 bg-[var(--color-button-secondary-bg)] text-primary hover:bg-[var(--color-button-secondary-bg-hover)] border border-border"
                      >
                        <svg 
                          className="h-4 w-4 xs:h-5 xs:w-5" 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                        <span>Exit Edit Mode</span>
                      </button>
                      
                      <CalendarConfigButton 
                        onConfigChanged={() => {
                          // Refresh data when config changes
                          setLastRefresh(Date.now());
                        }} 
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAdminMode(true)}
                      className="flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-sm bg-accent-primary text-stone-800 hover:bg-accent-secondary transition-all duration-200 font-medium font-mono"
                    >
                      <svg 
                        className="h-4 w-4 xs:h-5 xs:w-5" 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      <span>Edit Mode</span>
                    </button>
                  )}
                </div>
              )}

              {/* Adding the custom SVG divider here - Setting vertical margins to 32px (my-8) */}
              <img 
                src="/images/horizontal-line.svg" 
                alt="Decorative divider" 
                className="w-full max-w-3xl my-8 block" 
              />

              {/* Moved Calendar card inside wrapper - CHANGING p-* to py-* now */}
              <div className="rounded-xl shadow-sm py-3 xs:py-4 sm:py-6 mb-4 xs:mb-5 sm:mb-6">
                {/* REMOVING px-* padding from this inner div */}
                <SeasonLegend />
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Increased font size for the header */}
                    <h2 className="text-2xl sm:text-3xl font-display font-light text-primary">
                      {selectedWeeks.length === 0 ? "When do you wish to arrive?" : 
                       selectedWeeks.length === 1 ? <><span className="underline">One</span> week selected! Any more?</> : 
                       "Set your timeline"}
                    </h2>

                    <div className="flex items-center gap-2 xxs:gap-3">
                      {/* REMOVED Home button */}
                      {/* <button 
                        className="p-1 xxs:p-1.5 sm:p-2 rounded-full hover:bg-[var(--color-bg-surface-hover)] text-accent-primary"
                        onClick={() => handleMonthChange(startOfMonth(new Date()))} // Use handleMonthChange
                        aria-label="Return to current month"
                        title="Return to today"
                      >
                        <Home className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 sm:h-5 sm:w-5" />
                      </button> */}

                      {/* UPDATED: Single border, bg, custom icons, rounded-sm */}
                      <div className="flex items-center rounded-sm border border-shade-1 bg-surface-dark"> {/* Added bg, changed rounded-lg to rounded-sm */}
                        <button 
                          className="p-1 xxs:p-1.5 sm:p-2 rounded-l-sm hover:bg-[var(--color-bg-surface-hover)]" /* Removed border-r, changed rounded-l-lg to rounded-l-sm */
                          onClick={() => handleMonthChange(subMonths(currentMonth, 1))} // Use handleMonthChange
                          aria-label="Previous month"
                        >
                          {/* Replaced ChevronLeft with img */}
                          <img src="/images/arrow-left.svg" alt="Previous month" className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 sm:h-5 sm:w-5" />
                        </button>
                        {/* UPDATED styles to match header button, now bold, removed border/rounded */}
                        <div 
                          className="p-1.5 font-lettra-bold text-sm uppercase transition-colors bg-surface-dark text-primary hover:opacity-80 text-center whitespace-nowrap min-w-[120px] xxs:min-w-[140px] sm:min-w-[160px] cursor-pointer rounded-sm" /* Removed border, rounded-sm */
                          onClick={() => handleMonthChange(startOfMonth(new Date()))} // Use handleMonthChange
                          title="Go to current month"
                        >
                          {format(currentMonth, 'MMMM yyyy')}
                        </div>
                        <button 
                          className="p-1 xxs:p-1.5 sm:p-2 rounded-r-sm hover:bg-[var(--color-bg-surface-hover)]" /* Removed border-l, changed rounded-r-lg to rounded-r-sm */
                          onClick={() => handleMonthChange(addMonths(currentMonth, 1))} // Use handleMonthChange
                          aria-label="Next month"
                        >
                          {/* Replaced ChevronRight with img */}
                          <img src="/images/arrow-right.svg" alt="Next month" className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedWeeks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 xxs:gap-2">
                      <Tooltip.Provider delayDuration={50}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button
                              onClick={() => setShowDiscountModal(true)}
                              className="group flex items-center gap-1 xxs:gap-1.5 px-2 xxs:px-2.5 py-1 xxs:py-1.5 text-sm font-medium border rounded-sm transition-colors duration-200 relative font-lettra-bold text-accent-primary bg-[color-mix(in_srgb,_var(--color-accent-primary)_10%,_transparent)] border-[color-mix(in_srgb,_var(--color-accent-primary)_30%,_transparent)] hover:bg-[color-mix(in_srgb,_var(--color-accent-primary)_20%,_transparent)] hover:border-[color-mix(in_srgb,_var(--color-accent-primary)_40%,_transparent)]"
                            >
                              <span>{combinedDiscount > 0 ? `Discount: ${seasonBreakdown?.hasMultipleSeasons ? '~' : ''}${Math.round(combinedDiscount * 100)}%` : 'DISCOUNTS'}</span>
                              <HelpCircle className="w-3 h-3 xxs:w-3.5 xxs:h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              sideOffset={5}
                              className="tooltip-content !font-mono"
                            >
                              Click for detailed breakdown
                              <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                      <button
                        onClick={handleClearSelection}
                        className={clsx(
                          "flex items-center gap-0.5 xxs:gap-1 px-2 xxs:px-2.5 py-1 xxs:py-1.5 text-sm border rounded-sm transition-colors duration-200",
                          "font-lettra-bold",
                          "text-accent-primary bg-[color-mix(in_srgb,_var(--color-accent-primary)_10%,_transparent)] border-[color-mix(in_srgb,_var(--color-accent-primary)_30%,_transparent)] hover:bg-[color-mix(in_srgb,_var(--color-accent-primary)_20%,_transparent)] hover:border-[color-mix(in_srgb,_var(--color-accent-primary)_40%,_transparent)]"
                        )}
                        aria-label="Clear week selection"
                      >
                        <X size={12} className="xxs:w-3.5 xxs:h-3.5 sm:w-4 sm:h-4" />
                        <span>CLEAR DATES</span>
                      </button>
                    </div>
                  )}
                </div>

                {isLoading ? (
                  <div className="h-48 xs:h-56 sm:h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 xs:h-10 xs:w-10 border-t-2 border-b-2 border-accent-primary"></div>
                  </div>
                ) : (
                  <WeekSelector 
                    weeks={weeks}
                    selectedWeeks={selectedWeeks}
                    onWeekSelect={handleWeekSelect}
                    onWeeksDeselect={handleWeeksDeselect}
                    isAdmin={isAdminMode}
                    onDateSelect={handleFlexDateSelect}
                    currentMonth={currentMonth}
                    onMonthChange={handleMonthChange}
                    accommodationTitle={accommodationTitle}
                    onMaxWeeksReached={() => setShowMaxWeeksModal(true)}
                  />
                )}
              </div> {/* Closing Calendar card div */}
              
              {/* Outer Cabin Selector keeps py-* padding */}
              <div className="rounded-xl shadow-sm py-3 xs:py-4 sm:py-6 mb-4 xs:mb-5 sm:mb-6 cabin-selector">
                {/* REMOVING px-* padding from this h2 */}
                <h2 className="text-2xl sm:text-3xl  font-display font-light text-primary mb-3 xs:mb-4">Pick your nest</h2>
                <CabinSelector 
                  accommodations={accommodations || []}
                  selectedAccommodationId={selectedAccommodation}
                  onSelectAccommodation={setSelectedAccommodation}
                  selectedWeeks={selectedWeeks}
                  currentMonth={currentMonth}
                  isLoading={accommodationsLoading}
                  isDisabled={selectedWeeks.length === 0}
                  displayWeeklyAccommodationPrice={getDisplayInfo}
                />
              </div> {/* Closing Cabin Selector div */}
            </div> {/* == END: New wrapper div == */}
          </div> {/* Closing lg:col-span-2 div */}

          {/* Right Column - Booking Summary (becomes a bottom column on mobile/tablet) */}
          <div>
            {/* Re-add sticky, add max-height and overflow for independent scrolling on large screens */}
            <div className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
              {/* This inner div now just handles the styling */}
              <div className="rounded-xl shadow-sm p-3 xs:p-4 sm:p-6 mb-4 xs:mb-5 sm:mb-6">
                {selectedWeeks.length > 0 ? (
                  <BookingSummary 
                    selectedWeeks={selectedWeeks}
                    selectedAccommodation={selectedAccommodation && accommodations ? 
                      accommodations.find(a => a.id === selectedAccommodation) || null : null
                    }
                    onClearWeeks={() => setSelectedWeeks([])}
                    onClearAccommodation={() => setSelectedAccommodation(null)}
                    seasonBreakdown={seasonBreakdown}
                    calculatedWeeklyAccommodationPrice={selectedAccommodation ? weeklyAccommodationInfo[selectedAccommodation]?.price ?? null : null}
                  />
                ) : (
                  <div className="text-secondary text-sm xs:text-sm font-mono">
                    <p>Select your dates to see booking details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showMaxWeeksModal && (
        <MaxWeeksModal 
          isOpen={showMaxWeeksModal} 
          onClose={() => setShowMaxWeeksModal(false)} 
        />
      )}
      
      {isAdmin && isAdminMode && selectedWeekForCustomization && (
        <WeekCustomizationModal
          week={selectedWeekForCustomization}
          onClose={() => setSelectedWeekForCustomization(null)}
          onSave={handleSaveWeekCustomization}
          onDelete={handleDeleteWeekCustomization}
        />
      )}

      {showDiscountModal && (
        <DiscountModal
          isOpen={showDiscountModal}
          onClose={() => setShowDiscountModal(false)}
          checkInDate={selectedWeeks[0]?.startDate || new Date()}
          checkOutDate={selectedWeeks[selectedWeeks.length - 1]?.endDate || new Date()}
          accommodationName={selectedAccommodationDetails?.title || ''}
          basePrice={selectedAccommodationDetails?.price || 0}
          calculatedWeeklyPrice={selectedAccommodation ? weeklyAccommodationInfo[selectedAccommodation]?.price ?? null : null}
          averageSeasonalDiscount={selectedAccommodation ? weeklyAccommodationInfo[selectedAccommodation]?.avgSeasonalDiscount ?? null : null}
        />
      )}
    </div>
  );
}
