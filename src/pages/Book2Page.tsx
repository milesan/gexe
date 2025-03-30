import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Home, X, HelpCircle } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths, subMonths, startOfDay, isSameDay, addDays, eachDayOfInterval, differenceInDays } from 'date-fns';
import { WeekSelector } from '../components/WeekSelector';
import { formatDateForDisplay, normalizeToUTCDate, doDateRangesOverlap, calculateDurationDiscountWeeks } from '../utils/dates';
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
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown } from '../utils/pricing';
import { areSameWeeks } from '../utils/dates';
import { clsx } from 'clsx';
import { calculateDaysBetween } from '../utils/dates';

const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=2940&auto=format&fit=crop";

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

  // Calculate combined discount
  const calculateCombinedDiscount = useCallback((weeks: Week[]): number => {
    // Find the accommodation object first
    const accommodation = selectedAccommodation && accommodations
        ? accommodations.find(a => a.id === selectedAccommodation)
        : null;
    const accommodationTitle = accommodation?.title || '';
    const accommodationPrice = accommodation?.base_price ?? 0;

    if (weeks.length === 0) return 0;

    // Calculate duration discount using complete weeks
    const totalDays = calculateDaysBetween(weeks[0].startDate, weeks[weeks.length - 1].endDate, true);
    const completeWeeks = Math.floor(totalDays / 7);
    const durationDiscount = getDurationDiscount(completeWeeks);

    // Calculate seasonal discount - only if it's not a dorm
    let seasonalDiscount = 0;
    if (accommodationPrice > 0 && !accommodationTitle.toLowerCase().includes('dorm')) {
      const seasonBreakdown = getSeasonBreakdown(weeks[0].startDate, weeks[weeks.length - 1].endDate);
      // Calculate weighted average seasonal discount
      const totalNights = seasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
      seasonalDiscount = seasonBreakdown.seasons.reduce((sum, season) => 
        sum + (season.discount * season.nights), 0) / totalNights;
    }
    
    // Calculate combined discount (multiplicative)
    return 1 - (1 - seasonalDiscount) * (1 - durationDiscount);
  }, [selectedAccommodation, accommodations]);

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
      if (newWeeks.length > 12) {
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
    
    // Get all dates in the stay (excluding checkout day)
    const allDates = eachDayOfInterval({
      start: startDate,
      end: addDays(endDate, -1) // Exclude checkout day
    });
    
    // Count the nights per season using the date of each night
    allDates.forEach(date => {
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
    console.log('[Book2Page] handleFlexDateSelect called with:', {
      date: formatDateForDisplay(date),
      weekId: week?.id,
      weekStart: week ? formatDateForDisplay(week.startDate) : null,
      weekEnd: week ? formatDateForDisplay(week.endDate) : null
    });
    
    if (!week) {
      console.error('[Book2Page] No week provided to handleFlexDateSelect');
      return;
    }
    
    // Always create a new week with the selected date as the start date
    // but preserve end date and ID from the original week
    const selectedWeek: Week = {
      ...week,
      startDate: date, // ALWAYS use the selected flex date as start date
      endDate: week.endDate,
      id: week.id,
      isCustom: true, // Ensure it's marked as custom
      isFlexibleSelection: true, // Flag to indicate this is a flexible selection
      flexibleDates: week.flexibleDates, // Preserve the flex dates array for reference
      // Mark the originally selected flex date for UI purposes
      selectedFlexDate: date 
    };
    
    console.log('[Book2Page] Created flexible week:', {
      weekId: selectedWeek.id,
      weekStart: formatDateForDisplay(selectedWeek.startDate),
      weekEnd: formatDateForDisplay(selectedWeek.endDate),
      isCustom: selectedWeek.isCustom,
      isFlexibleSelection: selectedWeek.isFlexibleSelection,
      selectedFlexDate: formatDateForDisplay(selectedWeek.selectedFlexDate!)
    });
    
    // Use a direct state update for the first selection to avoid any stale closures
    if (selectedWeeks.length === 0) {
      console.log('[Book2Page] Direct state update for first flex date selection');
      setSelectedWeeks([selectedWeek]);
    } else {
      // For subsequent selections, use the normal handler
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

  return (
    <div 
      className="min-h-screen tree-pattern"
      style={{
        backgroundImage: `linear-gradient(rgba(244, 240, 232, 0.9), rgba(244, 240, 232, 0.9)), url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="container mx-auto py-4 xs:py-6 sm:py-8 px-4">
        <h1 className="text-4xl xs:text-4xl font-display mb-3 xs:mb-4 text-stone-800">Book Your Stay</h1>
        
        <div className="lg:col-span-2 max-w-2xl bg-white/50 backdrop-blur-sm border border-stone-200/50 rounded-lg p-3 xs:p-4 sm:p-5 mb-4 xs:mb-6 sm:mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-2 xs:mb-3">
            <svg className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 className="text-xs xs:text-sm font-medium text-stone-700 font-regular">Note!</h2>
          </div>
          <div className="flex flex-col gap-2 xs:gap-3 text-stone-600">
            <p className="flex items-start gap-2 xs:gap-2.5 text-xs xs:text-sm font-regular">
              <span className="text-emerald-600 mt-0.5">•</span>
              The longer you stay, the less € you contribute on both lodging & base-rate
            </p>
            <p className="flex items-start gap-2 xs:gap-2.5 text-xs xs:text-sm font-regular">
              <span className="text-emerald-600 mt-0.5">•</span>
              The quieter the time of year, the less € you contribute on lodging.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6">
          {/* Left Column - Calendar and Cabin Selector */}
          <div className="lg:col-span-2">
            {/* Move admin controls here - above the calendar white box */}
            {isAdmin && (
              <div className="flex justify-end mb-3 xs:mb-4">
                {isAdminMode ? (
                  <div className="flex items-center gap-2 xs:gap-3">
                    <button
                      onClick={() => setIsAdminMode(false)}
                      className="flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm bg-amber-600 text-white hover:bg-amber-700 transition-all duration-200 font-medium font-regular"
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
                    className="flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-all duration-200 font-medium font-regular"
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

            <div className="bg-white rounded-xl shadow-sm p-3 xs:p-4 sm:p-6 mb-4 xs:mb-5 sm:mb-6">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg xxs:text-xl sm:text-2xl font-display font-light text-stone-800">
                    {selectedWeeks.length === 0 ? "When do you want to arrive?" : 
                     selectedWeeks.length === 1 ? "When do you want to depart?" : 
                     "Select your lodging below"}
                  </h2>

                  <div className="flex items-center gap-2 xxs:gap-3">
                    <button 
                      className="p-1 xxs:p-1.5 sm:p-2 rounded-full hover:bg-gray-100 text-emerald-600"
                      onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                      aria-label="Return to current month"
                      title="Return to today"
                    >
                      <Home className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 sm:h-5 sm:w-5" />
                    </button>

                    <div className="flex items-center bg-white/80 rounded-lg shadow-sm border border-stone-200/50">
                      <button 
                        className="p-1 xxs:p-1.5 sm:p-2 rounded-l-lg hover:bg-gray-100 border-r border-stone-200/50"
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 sm:h-5 sm:w-5 text-stone-600" />
                      </button>
                      <div className="px-2 xxs:px-3 sm:px-4 text-center text-stone-700 font-medium whitespace-nowrap text-[10px] xxs:text-xs sm:text-sm font-regular min-w-[120px] xxs:min-w-[140px] sm:min-w-[160px]">
                        {format(currentMonth, 'MMMM yyyy')}
                      </div>
                      <button 
                        className="p-1 xxs:p-1.5 sm:p-2 rounded-r-lg hover:bg-gray-100 border-l border-stone-200/50"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        aria-label="Next month"
                      >
                        <ChevronRight className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 sm:h-5 sm:w-5 text-stone-600" />
                      </button>
                    </div>
                  </div>
                </div>

                {selectedWeeks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 xxs:gap-2">
                    <button
                      onClick={() => setShowDiscountModal(true)}
                      className="group flex items-center gap-1 xxs:gap-1.5 px-2 xxs:px-2.5 py-1 xxs:py-1.5 text-[10px] xxs:text-xs sm:text-sm font-medium border rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 relative font-regular"
                    >
                      <span>{combinedDiscount > 0 ? `Discount: ${seasonBreakdown?.hasMultipleSeasons ? '~' : ''}${Math.round(combinedDiscount * 100)}%` : 'Discounts'}</span>
                      <HelpCircle className="w-3 h-3 xxs:w-3.5 xxs:h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 xxs:mb-1.5 px-1.5 xxs:px-2 py-0.5 xxs:py-1 bg-stone-800 text-white text-[8px] xxs:text-[10px] sm:text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-regular">
                        Click for detailed breakdown
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-stone-800"></div>
                      </div>
                    </button>
                    <button
                      onClick={handleClearSelection}
                      className={clsx(
                        "flex items-center gap-0.5 xxs:gap-1 px-2 xxs:px-2.5 py-1 xxs:py-1.5 text-[10px] xxs:text-xs sm:text-sm font-medium border rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 font-regular",
                        "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
                      )}
                      aria-label="Clear week selection"
                    >
                      <X size={12} className="xxs:w-3.5 xxs:h-3.5 sm:w-4 sm:h-4" />
                      <span>Clear Dates</span>
                    </button>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="h-48 xs:h-56 sm:h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 xs:h-10 xs:w-10 border-t-2 border-b-2 border-green-800"></div>
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
                  onMonthChange={setCurrentMonth}
                />
              )}
            </div>
            
            {/* Cabin Selector - Under the calendar */}
            <div className="bg-white rounded-xl shadow-sm p-3 xs:p-4 sm:p-6 mb-4 xs:mb-5 sm:mb-6 cabin-selector">
              <h2 className="text-lg xs:text-xl lg:text-2xl font-display font-light text-stone-800 mb-3 xs:mb-4">Select Accommodation</h2>
              <CabinSelector 
                accommodations={accommodations || []}
                selectedAccommodationId={selectedAccommodation}
                onSelectAccommodation={setSelectedAccommodation}
                selectedWeeks={selectedWeeks}
                currentMonth={currentMonth}
                isLoading={accommodationsLoading}
                isDisabled={selectedWeeks.length === 0}
              />
            </div>
          </div>

          {/* Right Column - Booking Summary (becomes a bottom column on mobile/tablet) */}
          <div>
            {/* Use regular position on small screens and sticky on large screens */}
            <div className="lg:sticky lg:top-8">
              <div className="bg-white rounded-xl shadow-sm p-3 xs:p-4 sm:p-6 mb-4 xs:mb-5 sm:mb-6">
                {selectedWeeks.length > 0 ? (
                  <BookingSummary 
                    selectedWeeks={selectedWeeks}
                    selectedAccommodation={selectedAccommodation && accommodations ? 
                      accommodations.find(a => a.id === selectedAccommodation) || null : null
                    }
                    onClearWeeks={() => setSelectedWeeks([])}
                    onClearAccommodation={() => setSelectedAccommodation(null)}
                    seasonBreakdown={seasonBreakdown}
                  />
                ) : (
                  <div className="text-stone-600 text-xs xs:text-sm font-regular">
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
        />
      )}
    </div>
  );
}