import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, BedDouble, WifiOff, ZapOff, Bath, Percent, Info } from 'lucide-react';
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
  'Master\'s Suite'
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-stone-200"></div>
              <div className="p-4 bg-white border border-t-0 border-stone-200 rounded-b-xl h-[140px]">
                <div className="h-4 bg-stone-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-stone-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-stone-200 rounded w-1/4 mb-4"></div>
                <div className="h-6 bg-stone-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : accommodations.length === 0 ? (
        <div className="text-center py-12 bg-stone-50 rounded-xl">
          <h3 className="text-lg font-medium text-stone-800 mb-2 font-regular">No accommodations available</h3>
          <p className="text-stone-600 font-regular">Please try different dates or check back later.</p>
        </div>
      ) : (
        <>
          {isDisabled && (
            <div className="text-stone-600 text-sm font-regular">
              <p>Select your dates to see booking details</p>
            </div>
          )}
          
          <div className={clsx(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6", 
            isDisabled && "opacity-70"
          )}>
            {visibleAccommodations.map((accommodation) => {
              const isAvailable = selectedWeeks.length === 0 ||
                availabilityMap[accommodation.id]?.isAvailable;
              const availableCapacity = availabilityMap[accommodation.id]?.availableCapacity;
              const isTent = accommodation.type === 'tent';
              const isOutOfSeason = isTent && !isTentSeason && selectedWeeks.length > 0;

              // Calculate discounts specific to this accommodation
              const durationDiscount = selectedWeeks.length > 0 ? getDurationDiscount(calculateDurationDiscountWeeks(selectedWeeks)) : 0;
              // Weighted seasonal discount considering accommodation type (handles dorms being 0%)
              const accommodationSpecificWeightedSeasonalDiscount = selectedWeeks.length > 0
                ? calculateWeightedSeasonalDiscount(selectedWeeks, accommodation.title)
                : 0;

              // Determine if *any* discount > 0 applies to *this* accommodation
              const showDiscountInfo = selectedWeeks.length > 0 &&
                                       accommodation.base_price > 0 &&
                                       (accommodationSpecificWeightedSeasonalDiscount > 0 || durationDiscount > 0);

              // Ensure endDate calculation is robust
              const firstStartDate = selectedWeeks[0]?.startDate;
              const lastWeek = selectedWeeks[selectedWeeks.length - 1];
              let endDateForBreakdown: Date | undefined = lastWeek?.endDate;

              // Refined checks to ensure we have dates before using them
              if (!(endDateForBreakdown instanceof Date) && lastWeek?.startDate instanceof Date) {
                  endDateForBreakdown = addDays(lastWeek.startDate, 6);
              } else if (!(endDateForBreakdown instanceof Date) && firstStartDate instanceof Date) {
                  // Estimate based on number of weeks if only start dates are somehow present
                  endDateForBreakdown = addDays(firstStartDate, (selectedWeeks.length * 7) - 1);
              } else if (!(endDateForBreakdown instanceof Date) && selectedWeeks.length > 0) {
                  // Fallback if no end date found and weeks are selected (use current date as base)
                  // Consider if this fallback logic is truly desired
                  console.warn('[CabinSelector] Falling back to current date for endDateBreakdown calculation.');
                  endDateForBreakdown = addDays(new Date(), 6);
              }
              // If none of the above conditions met, endDateForBreakdown remains undefined

              let seasonsData: { seasons: { name: string; nights: number; discount: number }[] } = { seasons: [] };
              // Ensure both firstStartDate and endDateForBreakdown are valid Date objects before calling
              if (selectedWeeks.length > 0 && firstStartDate instanceof Date && endDateForBreakdown instanceof Date) {
                // Only call if dates are valid
                seasonsData = getSeasonBreakdown(firstStartDate, endDateForBreakdown);
              }
              const { seasons } = seasonsData;

              // Determine status badge
              let statusBadge = null;
              const isDorm = accommodation.title.includes('Dorm');
              if (isDorm && availableCapacity !== null && availableCapacity !== undefined && availableCapacity > 0) {
                statusBadge = {
                  text: `${availableCapacity} spot${availableCapacity === 1 ? '' : 's'} available`,
                  bgColor: "bg-emerald-50",
                  textColor: "text-emerald-700"
                };
              } else if (availableCapacity !== null && availableCapacity !== undefined && availableCapacity > 1) {
                statusBadge = {
                  text: `${availableCapacity} spots available`,
                  bgColor: "bg-emerald-50",
                  textColor: "text-emerald-700"
                };
              }

              return (
                <motion.div
                  key={accommodation.id}
                  data-accommodation-id={accommodation.id}
                  className={clsx(
                    'relative rounded-xl overflow-hidden transition-all duration-200 h-full',
                    'border border-stone-200 hover:border-emerald-200',
                    'hover:shadow-md',
                    (!isAvailable || isDisabled) && 'opacity-60 grayscale-[0.3]',
                    isOutOfSeason && 'opacity-85'
                  )}
                  whileHover={{ y: -4, scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ isolation: 'isolate' }}
                >
                  {/* Booked out overlay */}
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-stone-50/50 z-[2] flex items-center justify-center">
                      <div className="bg-stone-100/80 backdrop-blur-[1px] text-stone-500 px-3 py-1.5 rounded-md font-medium text-xs shadow-sm border border-stone-200 font-regular">
                        Booked out
                      </div>
                    </div>
                  )}
                  
                  {/* Out of season overlay for tents - more subtle */}
                  {isOutOfSeason && (
                    <div className="absolute inset-0 bg-amber-50/40 z-[2] flex items-center justify-center pointer-events-none">
                      <div className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-md font-medium text-xs shadow-sm border border-amber-200 font-regular">
                        Seasonal: Apr 15 - Sep 1
                      </div>
                    </div>
                  )}
                  
                  {/* Selected indicator */}
                  {selectedAccommodationId === accommodation.id && (
                    <div className="absolute top-3 right-3 z-[3]">
                      <div className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full shadow-md font-regular">
                        Selected
                      </div>
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  {statusBadge && !isOutOfSeason && (
                    <div className="absolute top-3 right-3 z-[3] flex flex-col gap-1.5">
                      {selectedAccommodationId === accommodation.id && (
                        <div className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full shadow-md font-regular">
                          Selected
                        </div>
                      )}
                      <div className={`inline-flex items-center px-2 py-0.5 rounded-full ${statusBadge.bgColor} ${statusBadge.textColor} text-xs font-medium shadow-sm backdrop-blur-[1px] bg-white/90 font-regular`}>
                        {statusBadge.text}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleSelectAccommodation(accommodation.id)}
                    className={clsx(
                      'w-full h-full text-left focus:outline-none',
                      selectedAccommodationId === accommodation.id ? 'ring-2 ring-emerald-600' : '',
                      (!isAvailable || isOutOfSeason || isDisabled) && 'cursor-not-allowed'
                    )}
                    disabled={!isAvailable || isOutOfSeason || isDisabled}
                  >
                    <div className="aspect-[4/3] bg-stone-100 relative">
                      {accommodation.image_url && (
                        <img
                          src={accommodation.image_url}
                          alt={accommodation.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      
                      {/* Amenities overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-16 pb-3 px-3">
                        <div className="flex items-center justify-end space-x-3 text-white">
                          {/* WiFi indicator */}
                          <Tooltip.Provider>
                            <Tooltip.Root delayDuration={0}>
                              <Tooltip.Trigger asChild>
                                <div className="relative">
                                  {hasWifi(accommodation.title) ? (
                                    <Wifi size={18} className="text-emerald-300 hover:text-emerald-200" />
                                  ) : (
                                    <WifiOff size={18} className="text-stone-400 hover:text-stone-300" />
                                  )}
                                </div>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  className="bg-stone-800 text-white text-[8px] xxs:text-[10px] sm:text-xs px-1.5 xxs:px-2 py-0.5 xxs:py-1 rounded opacity-0 data-[state=delayed-open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity whitespace-nowrap pointer-events-none font-regular"
                                  sideOffset={5}
                                  side="top" 
                                  align="center" 
                                  collisionPadding={8}
                                >
                                  {hasWifi(accommodation.title) 
                                    ? "WiFi available in this accommodation"
                                    : "No WiFi available in this accommodation"}
                                  <Tooltip.Arrow className="fill-stone-800" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>

                          {/* Electricity indicator */}
                          <Tooltip.Provider>
                            <Tooltip.Root delayDuration={0}>
                              <Tooltip.Trigger asChild>
                                <div className="relative">
                                  {hasElectricity(accommodation.title) ? (
                                    <Zap size={18} className="text-emerald-300 hover:text-emerald-200" />
                                  ) : (
                                    <ZapOff size={18} className="text-stone-400 hover:text-stone-300" />
                                  )}
                                </div>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  className="bg-stone-800 text-white text-[8px] xxs:text-[10px] sm:text-xs px-1.5 xxs:px-2 py-0.5 xxs:py-1 rounded opacity-0 data-[state=delayed-open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity whitespace-nowrap pointer-events-none font-regular"
                                  sideOffset={5}
                                  side="top" 
                                  align="center" 
                                  collisionPadding={8}
                                >
                                  {hasElectricity(accommodation.title)
                                    ? "Electricity available in this accommodation"
                                    : "No electricity available in this accommodation"}
                                  <Tooltip.Arrow className="fill-stone-800" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>

                          {/* Bed size indicator */}
                          {BED_SIZES[accommodation.title as keyof typeof BED_SIZES] && 
                           BED_SIZES[accommodation.title as keyof typeof BED_SIZES] !== 'N/A' && 
                           BED_SIZES[accommodation.title as keyof typeof BED_SIZES] !== 'Bring your own' && (
                            <Tooltip.Provider>
                              <Tooltip.Root delayDuration={0}>
                                <Tooltip.Trigger asChild>
                                  <div className="relative">
                                    <BedDouble size={18} className="text-emerald-300 hover:text-emerald-200" />
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content
                                    className="bg-stone-800 text-white text-[8px] xxs:text-[10px] sm:text-xs px-1.5 xxs:px-2 py-0.5 xxs:py-1 rounded opacity-0 data-[state=delayed-open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity whitespace-nowrap pointer-events-none font-regular"
                                    sideOffset={5}
                                    side="top" 
                                    align="center" 
                                    collisionPadding={8}
                                  >
                                    Bed size: {BED_SIZES[accommodation.title as keyof typeof BED_SIZES]}
                                    <Tooltip.Arrow className="fill-stone-800" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-3 bg-white">
                      <div className="flex flex-col h-full">
                        {/* Title */}
                        <h3 className="text-base font-medium text-stone-900 mb-1.5 font-regular break-words" title={accommodation.title}>
                          {accommodation.title}
                        </h3>

                        {/* Price Section */}
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-light tracking-tight text-stone-900 font-display">
                              €{selectedWeeks.length > 0
                                ? calculateFinalPrice(accommodation.base_price, selectedWeeks, accommodation.title).toFixed(0)
                                : accommodation.base_price}
                            </span>
                            <span className="text-sm text-stone-500 font-regular"> / week</span>
                            {(() => {
                              // Use the pre-calculated showDiscountInfo flag
                              if (!showDiscountInfo) return null;

                              // --- Start: Calculations needed only if tooltip is shown ---
                              const seasonDates: { [key: string]: Date } = {
                                'Low Season': new Date(2024, 0, 15), // Mid-Jan (Correct key)
                                'Medium Season': new Date(2024, 5, 15), // Mid-JUNE (Month 5 = Medium Season) (Correct key)
                                'Summer Season': new Date(2024, 7, 15), // Mid-Aug (Correct key, corresponds to 0%)
                              };

                              // Filter seasons from getSeasonBreakdown to only those applicable to this accommodation
                              const applicableSeasonalBreakdowns = seasons
                                .map(season => {
                                  const representativeDate = seasonDates[season.name] || new Date();
                                  const actualSeasonDiscountForAcc = getSeasonalDiscount(representativeDate, accommodation.title);
                                  
                                  // Keep season if it occurred (nights > 0) AND applies to this accommodation type
                                  if (season.nights > 0 && actualSeasonDiscountForAcc > 0) {
                                    // Calculate weeks based on nights / 6
                                    const numWeeks = season.nights / 6;
                                    // Format conditionally: show .1 decimal only if not an integer
                                    const displayWeeksStr = (numWeeks % 1 === 0) ? numWeeks.toString() : numWeeks.toFixed(1);
                                    
                                    const discountedPricePerWeek = accommodation.base_price * (1 - actualSeasonDiscountForAcc);
                                    return {
                                      name: season.name,
                                      discountPercent: Math.round(actualSeasonDiscountForAcc * 100),
                                      pricePerWeek: discountedPricePerWeek.toFixed(0),
                                      weeks: displayWeeksStr, // Use conditionally formatted string
                                      nights: season.nights // Keep nights if needed later
                                    };
                                  }
                                  return null;
                                })
                                .filter(Boolean);

                              const hasApplicableSeasonalDiscount = applicableSeasonalBreakdowns.length > 0;
                              const hasApplicableDurationDiscount = durationDiscount > 0; // Already calculated

                              // Final check: If neither type of discount applies after filtering, hide tooltip
                              if (!hasApplicableSeasonalDiscount && !hasApplicableDurationDiscount) {
                                // This path should ideally not be hit if showDiscountInfo was true, but acts as a safeguard
                                console.warn("[CabinSelector] Tooltip render safety check failed for:", accommodation.title);
                                return null;
                              }
                              // --- End: Calculations needed only if tooltip is shown ---

                              // Render the tooltip
                              return (
                                <Tooltip.Provider>
                                  <Tooltip.Root delayDuration={0}>
                                    <Tooltip.Trigger asChild>
                                      <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 ml-1 cursor-help" />
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                      <Tooltip.Content
                                        className="bg-white p-3 rounded-lg shadow-lg border border-stone-200 max-w-xs z-50 data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 font-regular"
                                        sideOffset={5}
                                        side="top"
                                        align="center"
                                        collisionPadding={10}
                                      >
                                        <div className="space-y-1.5">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Percent className="w-4 h-4 text-emerald-600" />
                                            <h4 className="font-medium text-stone-800 font-regular">Booking Details</h4>
                                          </div>

                                          {/* Seasonal Discounts Breakdown */}
                                          {hasApplicableSeasonalDiscount && (
                                           <div className="space-y-1 pt-1.5">
                                             <p className="text-xs text-stone-600 font-medium mb-0.5">Seasonal Discounts:</p>
                                             {applicableSeasonalBreakdowns.map((breakdown, index) => (
                                                // Filter should prevent nulls, but check anyway
                                                breakdown && (
                                                  <div key={index} className={`flex justify-between items-center text-xs gap-2 font-regular pl-2 text-emerald-700`}>
                                                    <span>{breakdown.name} (<span className="font-medium">{breakdown.discountPercent}%</span>)</span>
                                                    <span className="font-medium">
                                                      {breakdown.pricePerWeek}€ x {breakdown.weeks} week{parseFloat(breakdown.weeks) !== 1 ? 's' : ''}
                                                    </span>
                                                  </div>
                                                )
                                             ))}
                                           </div>
                                          )}

                                          {/* Duration Discount Breakdown */}
                                          {hasApplicableDurationDiscount && (
                                            <div className={`flex items-center justify-between gap-2 text-xs text-stone-600 font-regular ${hasApplicableSeasonalDiscount ? 'pt-1.5' : 'pt-1.5'}`}> 
                                              <span>Duration Discount</span>
                                              <span className="font-medium text-emerald-700">
                                                ({Math.round(durationDiscount * 100)}% applied)
                                              </span>
                                            </div>
                                          )}

                                          {/* Separator - Now conditional based on if *both* sections were shown */}
                                           {hasApplicableSeasonalDiscount && hasApplicableDurationDiscount && <div className="pt-1.5"></div>}
                                        </div>
                                        <Tooltip.Arrow className="fill-white w-3 h-3" />
                                      </Tooltip.Content>
                                    </Tooltip.Portal>
                                  </Tooltip.Root>
                                </Tooltip.Provider>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}