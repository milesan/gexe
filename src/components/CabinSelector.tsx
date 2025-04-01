import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, Bed, BedDouble, WifiOff, ZapOff, Bath, Percent, Info } from 'lucide-react';
import clsx from 'clsx';
import type { Accommodation } from '../types';
import { Week } from '../types/calendar';
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown } from '../utils/pricing';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { addDays, isDate, isBefore } from 'date-fns';
import * as Tooltip from '@radix-ui/react-tooltip';
import { calculateTotalNights, calculateDurationDiscountWeeks, normalizeToUTCDate } from '../utils/dates';

interface Props {
  accommodations: Accommodation[];
  selectedAccommodationId: string | null;
  onSelectAccommodation: (id: string) => void;
  isLoading?: boolean;
  selectedWeeks?: Week[];
  currentMonth?: Date;
  isDisabled?: boolean;
}

const BED_SIZES = {
  '6-Bed Dorm': '90×200cm (35×79") - Single',
  '3-Bed Dorm': '90×200cm (35×79") - Single',
  'A-Frame Pod': '140×200cm (55×79") - Double',
  'Microcabin Left': '140×200cm (55×79") - Double',
  'Microcabin Middle': '140×200cm (55×79") - Double',
  'Microcabin Right': '140×200cm (55×79") - Double',
  'Writer\'s Room': '135×200cm (53×79") - Double',
  'Valleyview Room': '160×200cm (63×79") - Queen',
  'The Hearth': '180×200cm (71×79") - King',
  'Master\'s Suite': '160×200cm (63×79") - Queen',
  '2.2 Meter Tipi': '90×200cm (35×79") - Single',
  '4 Meter Bell Tent': '140×200cm (55×79") - Double',
  '5 Meter Bell Tent': '160×200cm (63×79") - Queen',
  'Your Own Tent': 'Bring your own',
  'Van Parking': 'Bring your own',
  'I\'m staying with someone else / +1': 'N/A'
} as const;

const HAS_ELECTRICITY = [
  'Microcabin Left',
  'Microcabin Middle',
  'Microcabin Right',
  '6-Bed Dorm',
  '3-Bed Dorm',
  'Writer\'s Room',
  'Valleyview Room',
  'The Hearth',
  'Master\'s Suite'
];

const HAS_WIFI = [
  'Writer\'s Room',
  'The Hearth',
  'Valleyview Room',
  'Master\'s Suite',
  '3-Bed Dorm',
  '6-Bed Dorm'
];

export function CabinSelector({ 
  accommodations, 
  selectedAccommodationId, 
  onSelectAccommodation,
  isLoading = false,
  selectedWeeks = [],
  currentMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())),
  isDisabled = false
}: Props) {
  console.log('[CabinSelector] Rendering with props:', {
    accommodationsCount: accommodations?.length,
    selectedAccommodationId,
    selectedWeeksCount: selectedWeeks?.length,
    currentMonth: currentMonth.toISOString(),
    currentMonthNumber: currentMonth.getUTCMonth(),
    currentMonthName: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(currentMonth),
    selectedWeeks: selectedWeeks?.map(w => {
      if (!w || typeof w === 'string') return null;
      
      // Check if it's a Week object with startDate and endDate properties
      if (w.startDate && w.endDate) {
        return {
          startDate: w.startDate.toISOString(),
          endDate: w.endDate.toISOString()
        };
      }
      
      // If it's a plain Date object
      if (w instanceof Date) {
        return {
          startDate: w.toISOString(),
          endDate: addDays(w, 7).toISOString()
        };
      }
      
      return null;
    }).filter(Boolean)
  });

  // --- Normalization Step ---
  // Create a date representing midnight UTC of the received currentMonth's date.
  // This ensures consistency whether the prop was local midnight or the UTC midnight default.
  const normalizedCurrentMonth = new Date(Date.UTC(
    currentMonth.getUTCFullYear(),
    currentMonth.getUTCMonth(),
    currentMonth.getUTCDate()
  ));
  // --- End Normalization ---

  const { checkWeekAvailability, availabilityMap } = useWeeklyAccommodations();
  
  const hasWifi = (title: string) => HAS_WIFI.includes(title);
  const hasElectricity = (title: string) => HAS_ELECTRICITY.includes(title);

  // Clear selection if selected accommodation becomes unavailable
  useEffect(() => {
    if (selectedAccommodationId && selectedWeeks.length > 0) {
      const isAvailable = availabilityMap[selectedAccommodationId]?.isAvailable;
      if (!isAvailable) {
        console.log('[CabinSelector] Clearing selection - accommodation became unavailable:', {
          accommodationId: selectedAccommodationId,
          availability: availabilityMap[selectedAccommodationId]
        });
        onSelectAccommodation('');
      }
    }
  }, [selectedAccommodationId, selectedWeeks, availabilityMap, onSelectAccommodation]);

  // NEW: Clear accommodation selection when dates are cleared
  useEffect(() => {
    if (selectedWeeks.length === 0 && selectedAccommodationId) {
      console.log('[CabinSelector] Clearing accommodation selection because dates were cleared.');
      onSelectAccommodation('');
    }
  }, [selectedWeeks, selectedAccommodationId, onSelectAccommodation]);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      // Check availability for all accommodations when weeks are selected
      
      // MODIFIED: Determine overall check-in and check-out dates
      const checkInDate = selectedWeeks.length > 0 ? selectedWeeks[0].startDate : null;
      const checkOutDate = selectedWeeks.length > 0 ? selectedWeeks[selectedWeeks.length - 1].endDate : null;
      
      console.log('[CabinSelector] useEffect[selectedWeeks] - Checking availability with range:', {
        checkInDate: checkInDate?.toISOString(),
        checkOutDate: checkOutDate?.toISOString()
      });

      accommodations.forEach(acc => {
        if (!(acc as any).parent_accommodation_id) { // Only check parent accommodations
          // MODIFIED: Pass derived dates to checkWeekAvailability
          checkWeekAvailability(acc, checkInDate, checkOutDate);
        }
      });
    }
    // MODIFIED: Dependency array includes derived dates implicitly via selectedWeeks
  }, [selectedWeeks, accommodations, checkWeekAvailability]);

  const handleSelectAccommodation = useCallback((id: string) => {
    console.log('[CabinSelector] Accommodation selected:', {
      accommodationId: id,
      previousSelection: selectedAccommodationId
    });
    // Check availability when accommodation is selected and weeks are already chosen
    if (selectedWeeks.length > 0) {
      // MODIFIED: Determine overall check-in and check-out dates
      const checkInDate = selectedWeeks.length > 0 ? selectedWeeks[0].startDate : null;
      const checkOutDate = selectedWeeks.length > 0 ? selectedWeeks[selectedWeeks.length - 1].endDate : null;
      
      console.log('[CabinSelector] handleSelectAccommodation - Checking availability with range:', {
        checkInDate: checkInDate?.toISOString(),
        checkOutDate: checkOutDate?.toISOString()
      });
      
      const accommodation = accommodations.find(a => a.id === id);
      if (accommodation) {
        // MODIFIED: Pass derived dates to checkWeekAvailability
        checkWeekAvailability(accommodation, checkInDate, checkOutDate);
      }
    }

    onSelectAccommodation(id);
    // MODIFIED: Dependency array includes derived dates implicitly via selectedWeeks
  }, [accommodations, selectedWeeks, checkWeekAvailability, onSelectAccommodation, selectedAccommodationId]);

  // Filter accommodations based on season and type
  const visibleAccommodations = accommodations
    .filter(acc => {
      // Filter out individual bed entries
      if ((acc as any).parent_accommodation_id) return false;
      return true;
    })
    .sort((a, b) => a.base_price - b.base_price); // Sort by base price in ascending order

  // Convert selectedWeeks to dates for comparison
  const selectedDates = selectedWeeks?.map(w => w.startDate || w) || [];
  
  // Check if it's tent season (April 15 - September 1)
  // For tent season calculation, we'll use the first selected week's start date
  // If no weeks are selected, we'll use the current month for display purposes
  const firstSelectedDate = selectedWeeks.length > 0 
    ? (selectedWeeks[0].startDate || new Date()) 
    : new Date();
  
  const isTentSeason = (() => {
    if (selectedWeeks.length === 0) {
      // If no weeks selected, use normalized UTC date for display purposes
      const m = normalizedCurrentMonth.getUTCMonth(); // Use UTC month
      const d = normalizedCurrentMonth.getUTCDate(); // Use UTC date
      // Tent season logic (Apr 15th to Sep 1st UTC)
      return (m > 3 || (m === 3 && d >= 15)) && 
             (m < 8 || (m === 8 && d <= 1));
    }
    
    // For actual bookings, check if ALL of the selected days fall within tent season
    const isInTentSeason = (date: Date) => {
      const m = date.getUTCMonth(); // Use UTC month
      const d = date.getUTCDate();  // Use UTC date
      // Tent season logic (Apr 15th to Sep 1st UTC)
      return (m > 3 || (m === 3 && d >= 15)) && (m < 8 || (m === 8 && d <= 1));
    };
    
    // Get all days in the selected period (reusing logic from discount calculation)
    let allDays: Date[] = [];
    
    selectedWeeks.forEach(week => {
      const startDate = week.startDate || (week instanceof Date ? week : new Date());
      const endDate = week.endDate || addDays(startDate, 6); // 6 days = 1 week (inclusive)
      
      if (isBefore(endDate, startDate)) {
        console.warn('[CabinSelector] Invalid date range:', { startDate, endDate });
        return;
      }
      
      // *** Manually generate days in UTC to avoid timezone shifts ***
      const daysInWeek: Date[] = [];
      let currentDay = new Date(startDate); // Start with the normalized UTC start date
      
      while (currentDay <= endDate) {
        daysInWeek.push(new Date(currentDay)); // Add a *copy* of the current day
        // Increment the day using UTC methods
        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }
      
      allDays = [...allDays, ...daysInWeek];

      // *** Log the days generated for this week (verify they are T00:00:00.000Z) ***
      const currentWeekIndex = selectedWeeks.indexOf(week); // Calculate index beforehand
      console.log('[CabinSelector] Processing week - Days generated:', { 
        weekIndex: currentWeekIndex, // Use the variable here
        daysInWeek: daysInWeek.map(d => d.toISOString())
      });
    });
    
    // Check if ALL days fall within tent season
    return allDays.length > 0 && allDays.every(isInTentSeason);
  })();
  
  console.log('[CabinSelector] Tent season calculation:', {
    firstSelectedDate: firstSelectedDate.toISOString(),
    isTentSeason: isTentSeason,
    selectedWeeksCount: selectedWeeks.length,
    tentSeasonRequirement: "ALL days must be within tent season (April 15 - September 1)"
  });

  // Calculate weighted seasonal discount based on all selected days
  const calculateWeightedSeasonalDiscount = (weeks: Week[], accommodationType?: string): number => {
    if (weeks.length === 0) {
      // If no weeks selected, use normalized UTC date for display purposes
      return getSeasonalDiscount(normalizedCurrentMonth, accommodationType || '');
    }

    // Get all days in the selected period
    let allDays: Date[] = [];

    weeks.forEach(week => {
      // Get initial dates
      const initialStartDate = week.startDate || (week instanceof Date ? week : new Date());
      const initialEndDate = week.endDate || addDays(initialStartDate, 6); // 6 days = 1 week (inclusive)

      // *** Log the initial dates BEFORE normalization ***
      console.log('[CabinSelector] Processing week - Initial dates:', { 
        weekIndex: weeks.indexOf(week), // Log index for clarity
        initialStartDate: initialStartDate?.toISOString ? initialStartDate.toISOString() : initialStartDate, 
        initialEndDate: initialEndDate?.toISOString ? initialEndDate.toISOString() : initialEndDate,
        weekData: week // Log the raw week object too
      });

      // *** Normalize dates ***
      const startDate = normalizeToUTCDate(initialStartDate);
      const endDate = normalizeToUTCDate(initialEndDate);

      // *** Log the normalized dates ***
      console.log('[CabinSelector] Processing week - Normalized dates:', { 
        weekIndex: weeks.indexOf(week), // Log index for clarity
        normalizedStartDate: startDate?.toISOString ? startDate.toISOString() : startDate,
        normalizedEndDate: endDate?.toISOString ? endDate.toISOString() : endDate,
        weekData: week // Log the raw week object too
      });

      if (isBefore(endDate, startDate)) { // Use normalized dates for comparison
        console.warn('[CabinSelector] Invalid date range (normalized):', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });
        return;
      }

      // *** Manually generate days in UTC to avoid timezone shifts ***
      const daysInWeek: Date[] = [];
      let currentDay = new Date(startDate); // Start with the normalized UTC start date
      
      while (currentDay <= endDate) {
        daysInWeek.push(new Date(currentDay)); // Add a *copy* of the current day
        // Increment the day using UTC methods
        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }
      
      allDays = [...allDays, ...daysInWeek];

      // *** Log the days generated for this week (verify they are T00:00:00.000Z) ***
      const currentWeekIndex = weeks.indexOf(week); // Calculate index beforehand
      console.log('[CabinSelector] Processing week - Days generated:', { 
        weekIndex: currentWeekIndex, // Use the variable here
        daysInWeek: daysInWeek.map(d => d.toISOString())
      });
    });

    if (allDays.length === 0) {
      return getSeasonalDiscount(normalizedCurrentMonth, accommodationType || '');
    }

    // Calculate discount for each day
    let totalDiscount = 0;

    allDays.forEach(day => { // 'day' is now guaranteed to be a normalized UTC date
      // Pass normalized date to getSeasonalDiscount
      totalDiscount += getSeasonalDiscount(day, accommodationType || '');
    });

    // Calculate weighted average discount
    const weightedDiscount = totalDiscount / allDays.length;

    // Log with normalized dates for consistency
    console.log('[CabinSelector] Weighted seasonal discount calculation (using normalized dates):', {
       totalDays: allDays.length,
       firstDay: allDays.length > 0 ? allDays[0].toISOString() : 'N/A', // Should be YYYY-MM-DDT00:00:00.000Z
       lastDay: allDays.length > 0 ? allDays[allDays.length - 1].toISOString() : 'N/A', // Should be YYYY-MM-DDT00:00:00.000Z
       weightedDiscount,
       discountPercentage: `${(weightedDiscount * 100).toFixed(1)}%`,
       accommodationType: accommodationType ?? 'Undefined'
    });

    return weightedDiscount;
  };

  const seasonalDiscount = calculateWeightedSeasonalDiscount(selectedWeeks);
  const { hasMultipleSeasons, seasons } = getSeasonBreakdown(
    selectedWeeks[0]?.startDate || new Date(),
    selectedWeeks[selectedWeeks.length - 1]?.endDate || new Date()
  );
  
  console.log('[CabinSelector] Seasonal discount calculation:', {
    currentMonth: currentMonth.toISOString(),
    normalizedMonthForCalculations: normalizedCurrentMonth.toISOString(),
    month: normalizedCurrentMonth.getUTCMonth(),
    monthName: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(normalizedCurrentMonth),
    year: normalizedCurrentMonth.getUTCFullYear(),
    seasonalDiscount: seasonalDiscount,
    discountPercentage: `${(seasonalDiscount * 100).toFixed(1)}%`,
    selectedWeeksCount: selectedWeeks.length,
    hasMultipleSeasons: hasMultipleSeasons,
    isTentSeason: isTentSeason
  });

  // Calculate final price with both seasonal and duration discounts
  const calculateFinalPrice = (basePrice: number, weeks: Week[], accommodationType?: string): number => {
    if (weeks.length === 0) return basePrice;
    
    const seasonalDiscount = calculateWeightedSeasonalDiscount(weeks, accommodationType);
    
    // Calculate duration discount using utility functions
    const completeWeeks = calculateDurationDiscountWeeks(weeks);
    const durationDiscount = getDurationDiscount(completeWeeks);
    
    // Apply both discounts multiplicatively (not additively)
    const finalPrice = basePrice * (1 - seasonalDiscount) * (1 - durationDiscount);
    
    console.log('[CabinSelector] Price calculation:', {
      basePrice,
      seasonalDiscount: `${(seasonalDiscount * 100).toFixed(1)}%`,
      durationDiscount: `${(durationDiscount * 100).toFixed(1)}%`,
      finalPrice,
      totalNights: calculateTotalNights(weeks),
      completeWeeks,
      accommodationType
    });
    
    return finalPrice;
  };

  return (
    <div className="space-y-6">
      {/* Filter options could be added here in the future */}
      
      {isLoading ? (
        <div className="max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4 h-[300px] animate-pulse">
                <div className="h-32 bg-border/50 rounded mb-3"></div>
                <div className="h-4 bg-border/50 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-border/50 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-border/50 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      ) : visibleAccommodations.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-xl border border-border">
          <h3 className="text-lg font-medium text-primary mb-2 font-regular">No accommodations available</h3>
          <p className="text-secondary font-regular">Please adjust your dates or check back later.</p>
        </div>
      ) : (
        <div className="max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleAccommodations.map((acc) => {
              const isSelected = selectedAccommodationId === acc.id;
              const availability = availabilityMap[acc.id];
              const isAvailable = availability?.isAvailable ?? true;
              const isFullyBooked = !isAvailable;
              const spotsAvailable = availability?.availableCapacity;
              const canSelect = !isDisabled && !isFullyBooked;

              // Re-introduce tent season logic checks
              const isTent = acc.type === 'tent';
                const isOutOfSeason = isTent && !isTentSeason && selectedWeeks.length > 0;
              const finalCanSelect = canSelect && !isOutOfSeason; // Tent cannot be selected if out of season

              const finalPrice = calculateFinalPrice(acc.base_price, selectedWeeks, acc.title);
              const currentDurationDiscount = getDurationDiscount(calculateDurationDiscountWeeks(selectedWeeks));
              const currentSeasonalDiscount = calculateWeightedSeasonalDiscount(selectedWeeks, acc.title);

                return (
                  <motion.div
                  key={acc.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                    className={clsx(
                    'relative rounded-xl border overflow-hidden transition-all duration-200 flex flex-col justify-between group',
                    // Selected State: Accent border, slight scale, shadow, AND subtle background highlight
                    isSelected ? 
                      'border-accent-primary scale-[1.01] shadow-lg bg-[color-mix(in_srgb,_var(--color-bg-surface)_95%,_var(--color-accent-primary)_5%)]' : 
                      'border-border hover:border-accent-primary/50 bg-surface/50 backdrop-blur-sm', // Default state uses the new background
                    // Pointer state:
                    finalCanSelect && !isDisabled && 'cursor-pointer'
                  )}
                  onClick={() => finalCanSelect && !isDisabled && handleSelectAccommodation(acc.id)}
                  style={{ minHeight: '300px' }} 
                >
                  {/* Overlays - Reverted to simple positioning containers */}
                  {/* 1. Disabled Overlay (highest priority) */}
                  {isDisabled && (
                    <div className="absolute inset-0 z-[4] flex items-center justify-center p-4"> {/* Positioning only */}
                      <div className="bg-bg-surface text-text-primary px-4 py-2 rounded-md font-regular text-sm text-center border border-border shadow-md">
                        Select dates first
                      </div>
                    </div>
                  )}
                  {/* 2. Fully Booked Overlay */}
                  {!isDisabled && isFullyBooked && (
                    <div className="absolute inset-0 z-[3] flex items-center justify-center p-4"> {/* Positioning only */}
                      <div className="bg-bg-surface text-text-primary px-4 py-2 rounded-md font-regular text-sm text-center border border-border shadow-md">
                        Booked out
                      </div>
                    </div>
                  )}
                  {/* 3. Out of Season Overlay */}
                  {!isDisabled && isOutOfSeason && !isFullyBooked && (
                    <div className="absolute inset-0 z-[2] flex items-center justify-center p-4"> {/* Positioning only */}
                      <div className="bg-bg-surface text-text-primary px-4 py-2 rounded-md font-regular text-sm text-center border border-amber-500 dark:border-amber-600 shadow-md">
                        Seasonal<br />Apr 15 - Sep 1
                      </div>
                    </div>
                  )}

                  {/* Badge container - place above overlays */}
                  <div className="absolute top-2 left-2 z-[5] flex flex-col gap-2"> 
                    {/* Spots Available Indicator */}
                    {spotsAvailable !== undefined && spotsAvailable !== null && spotsAvailable < (acc.capacity ?? Infinity) && !isFullyBooked && !isOutOfSeason && !isDisabled && (
                      <div className="text-xs font-medium px-3 py-1 rounded-full shadow-lg bg-gray-600/90 text-white border border-white/30 font-regular">{spotsAvailable} {spotsAvailable === 1 ? 'spot' : 'spots'} available</div>
                    )}
                    
                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="text-xs font-medium px-3 py-1 rounded-full shadow-md bg-accent-primary text-white font-regular border border-white/30">Selected</div>
                    )}
                  </div>

                  {/* Image */}
                  <div className={clsx(
                    "relative h-40 bg-gradient-to-br from-border/10 to-border/20 overflow-hidden",
                    // Apply blur and corresponding opacity/grayscale conditionally
                    isDisabled && "blur-sm opacity-20 grayscale-[0.5]",
                    (!isDisabled && isFullyBooked) && "blur-sm opacity-20 grayscale-[0.7]",
                    (!isDisabled && isOutOfSeason && !isFullyBooked) && "blur-sm opacity-40 grayscale-[0.3]"
                  )}>
                    {acc.image_url ? (
                      <img 
                        src={acc.image_url} 
                        alt={acc.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary">
                         <BedDouble size={32} /> 
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div> {/* Increased gradient opacity from 40% to 60% */}
                  </div>

                  {/* Content */}
                  <div className={clsx(
                    "p-3 bg-transparent flex-grow flex flex-col justify-between", // Make content bg transparent
                    // Apply blur and corresponding opacity/grayscale conditionally
                    isDisabled && "blur-sm opacity-20 grayscale-[0.5]",
                    (!isDisabled && isFullyBooked) && "blur-sm opacity-20 grayscale-[0.7]",
                    (!isDisabled && isOutOfSeason && !isFullyBooked) && "blur-sm opacity-40 grayscale-[0.3]"
                  )}>
                    <div>
                      <h3 className="font-medium mb-1 text-primary font-regular">{acc.title}</h3>
                      <div className="flex items-center gap-3 text-secondary text-xs mb-2">
                        {acc.capacity !== undefined && acc.capacity !== null && acc.capacity > 1 && (
                          <Tooltip.Provider delayDuration={50}>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <span className="flex items-center gap-1 cursor-help" title={`Capacity: ${acc.capacity ?? 'N/A'}`}> 
                                  <BedDouble size={12} /> {acc.capacity} 
                                </span>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  sideOffset={5}
                                  className="tooltip-content !font-regular"
                                >
                                  <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                                  <span className="text-white">Capacity: {acc.capacity} persons</span>
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>
                        )}
                        
                        <Tooltip.Provider delayDuration={50}>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <span className="flex items-center gap-1 cursor-help" title={hasElectricity(acc.title) ? 'Has Electricity' : 'No Electricity'}>
                                {hasElectricity(acc.title) ? <Zap size={12} /> : <ZapOff size={12} className="opacity-50"/>}
                              </span>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content
                                sideOffset={5}
                                className="tooltip-content !font-regular"
                              >
                                <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                                <span className="text-white">{hasElectricity(acc.title) ? 'Has Electricity' : 'No Electricity'}</span>
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </Tooltip.Provider>
                        
                        <Tooltip.Provider delayDuration={50}>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <span className="flex items-center gap-1 cursor-help" title={hasWifi(acc.title) ? 'Has WiFi' : 'No WiFi'}>
                                {hasWifi(acc.title) ? <Wifi size={12} /> : <WifiOff size={12} className="opacity-50"/>}
                              </span>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content
                                sideOffset={5}
                                className="tooltip-content !font-regular"
                              >
                                <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                                <span className="text-white">{hasWifi(acc.title) ? 'Has WiFi' : 'No WiFi'}</span>
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </Tooltip.Provider>
                        
                        {/* Bed Size Tooltip */}
                        <Tooltip.Provider delayDuration={50}>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button className="flex items-center gap-1 cursor-help"><Bed size={12} /></button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content
                                sideOffset={5}
                                className="tooltip-content !font-regular"
                              >
                                <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                                <h4 className="font-medium font-regular text-white mb-1">Bed Size</h4>
                                <p className="text-sm text-gray-300 font-regular">
                                  {BED_SIZES[acc.title as keyof typeof BED_SIZES] || 'N/A'}
                                </p>
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </Tooltip.Provider>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div className="text-primary font-medium font-regular">
                        {finalPrice === 0 ? (
                          <span className="text-accent-primary">Free</span>
                        ) : (
                          <>
                            €{Math.round(finalPrice)}
                            <span className="text-sm text-secondary font-regular"> / week</span>
                          </>
                        )}
                      </div>
                      {/* Discount Tooltip - only show if final price is not 0 and there are applicable discounts */}
                      {finalPrice !== 0 && (
                        (acc.title.includes('Dorm') 
                          ? currentDurationDiscount > 0 
                          : currentSeasonalDiscount + currentDurationDiscount > 0
                        )
                      ) && (
                        <Tooltip.Provider delayDuration={50}>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button className="text-accent-primary flex items-center gap-0.5 cursor-help">
                                <Percent size={14} />
                              </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content
                                sideOffset={5}
                                className="tooltip-content tooltip-content--accent !font-regular"
                              >
                                <Tooltip.Arrow className="tooltip-arrow tooltip-arrow--accent" width={11} height={5} />
                                <h4 className="font-medium font-regular text-white mb-2">Booking Details</h4>
                                <div className="text-sm">
                                  {/* Seasonal discount with season info - don't show for dorms */}
                                  {!acc.title.includes('Dorm') && (
                                    <div className="py-2 border-b border-gray-600">
                                      {/* Enhanced season breakdown with discounted prices */}
                                      <div className="text-gray-300">
                                        {(() => {
                                          const seasonBreakdown = getSeasonBreakdown(
                                            selectedWeeks[0]?.startDate || new Date(),
                                            selectedWeeks[selectedWeeks.length - 1]?.endDate || new Date()
                                          );
                                          
                                          if (seasonBreakdown.hasMultipleSeasons) {
                                            return (
                                              <div className="space-y-3">
                                                <div className="font-medium text-white mb-1">Mixed Season Rates</div>
                                                {seasonBreakdown.seasons.map((season, index) => (
                                                  <div key={index} className="mb-2">
                                                    <div className="flex justify-between items-center mb-1">
                                                      <span className="font-medium">
                                                        {season.name === 'Summer Season' ? 'High' : 
                                                         season.name === 'Medium Season' ? 'Mid' : 'Low'} Season:
                                                      </span>
                                                      {/* Conditionally render discount % only if > 0 */}
                                                      {season.discount > 0 && (
                                                        <span className="text-accent-primary font-medium">
                                                          -{Math.round(season.discount * 100)}%
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="text-xs text-gray-400 pl-2">
                                                      {(() => {
                                                        const weeksValue = season.nights / 7;
                                                        const formattedWeeks = weeksValue % 1 === 0 ? 
                                                          Math.round(weeksValue) : 
                                                          weeksValue.toFixed(1);
                                                        return `${formattedWeeks} week${formattedWeeks === "1" ? "" : "s"}`;
                                                      })()} × €{Math.round(acc.base_price * (1 - season.discount))}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          } else {
                                            const seasonName = seasonalDiscount > 0.3 ? 'Low' : 
                                                               seasonalDiscount > 0.1 ? 'Mid' : 'High';
                                            const discountedPrice = acc.base_price * (1 - seasonalDiscount);
                                            return (
                                              <div>
                                                <div className="font-medium text-white mb-2">{seasonName} Season Rate</div>
                                                {/* Conditionally render the discount line only if > 0 */}
                                                {seasonalDiscount > 0 && (
                                                  <div className="flex justify-between items-center mb-1">
                                                    <span>Discount:</span>
                                                    <span className="text-accent-primary font-medium">
                                                      -{Math.round(seasonalDiscount * 100)}%
                                                    </span>
                                                  </div>
                                                )}
                                                <div className="text-xs text-gray-400 pl-2">
                                                  {(() => {
                                                    const weeksValue = calculateDurationDiscountWeeks(selectedWeeks);
                                                    const formattedWeeks = weeksValue % 1 === 0 ? 
                                                      Math.round(weeksValue) : 
                                                      weeksValue.toFixed(1);
                                                    return `${formattedWeeks} week${formattedWeeks === "1" ? "" : "s"}`;
                                                  })()} × €{discountedPrice.toFixed(2)}
                                                </div>
                                              </div>
                                            );
                                          }
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Simplified duration discount */}
                                  {currentDurationDiscount > 0 && (
                                    <div className="py-2"> 
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-white font-medium">Duration discount:</span>
                                        <span className="text-accent-primary font-medium">
                                          -{Math.round(currentDurationDiscount * 100)}%
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </Tooltip.Provider>
                      )}
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </div>
        </div>
      )}
    </div>
  );
}