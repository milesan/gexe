import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, Bed, BedDouble, WifiOff, ZapOff, Bath, Percent, Info, Ear } from 'lucide-react';
import clsx from 'clsx';
import type { Accommodation } from '../types';
import { Week } from '../types/calendar';
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown, calculateWeeklyAccommodationPrice } from '../utils/pricing';
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
  displayWeeklyAccommodationPrice: (accommodationId: string) => { price: number | null; avgSeasonalDiscount: number | null } | null;
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
  isDisabled = false,
  displayWeeklyAccommodationPrice
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
      const m = normalizedCurrentMonth.getUTCMonth();
      const d = normalizedCurrentMonth.getUTCDate();
      return (m > 3 || (m === 3 && d >= 15)) && 
             (m < 8 || (m === 8 && d <= 1));
    }
    
    const isInTentSeason = (date: Date) => {
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      return (m > 3 || (m === 3 && d >= 15)) && (m < 8 || (m === 8 && d <= 1));
    };
    
    let allDays: Date[] = [];
    selectedWeeks.forEach(week => {
      const startDate = normalizeToUTCDate(week.startDate || (week instanceof Date ? week : new Date()));
      const endDate = normalizeToUTCDate(week.endDate || addDays(startDate, 6));
      if (isBefore(endDate, startDate)) return;
      let currentDay = new Date(startDate);
      while (currentDay < endDate) { // Use < to match pricing util logic (nights)
        allDays.push(new Date(currentDay));
        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }
    });
    // Fix: Tent season means *any* day is IN season for it to be potentially available
    // It is only *out* of season if *all* days are outside the tent season window.
    // However, the original filter logic was: hide if it *is* tent but it's *not* tent season.
    // Let's stick to the original logic for now: Check if ALL days are within tent season
    // return allDays.length > 0 && allDays.every(isInTentSeason);
    // Reverting to simpler check based on first selected date for initial display filtering,
    // but acknowledge the availability logic might be more complex.
    // For filtering visibility, checking the first day is usually sufficient UI feedback.
     const firstDay = allDays[0];
     return firstDay ? isInTentSeason(firstDay) : false; // If no days, assume not tent season for filtering
  })();

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
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
            {visibleAccommodations.map((acc) => {
              const isSelected = selectedAccommodationId === acc.id;
              const availability = availabilityMap[acc.id];
              const isAvailable = availability?.isAvailable ?? true;
              const isFullyBooked = !isAvailable;
              const spotsAvailable = availability?.availableCapacity;
              const canSelect = !isDisabled && !isFullyBooked;

              const isTent = acc.type === 'tent';
              const isOutOfSeason = isTent && !isTentSeason && selectedWeeks.length > 0;
              const finalCanSelect = canSelect && !isOutOfSeason;

              // Get the whole info object
              const weeklyInfo = displayWeeklyAccommodationPrice(acc.id);
              const weeklyPrice = weeklyInfo?.price; // Extract price
              const avgSeasonalDiscountForTooltip = weeklyInfo?.avgSeasonalDiscount; // Extract discount

              // Keep duration discount calculation local to tooltip
              const completeWeeksForDiscount = calculateDurationDiscountWeeks(selectedWeeks);
              const currentDurationDiscount = getDurationDiscount(completeWeeksForDiscount);
              // Use the avgSeasonalDiscount from the prop for the flag
              const hasAnyDiscount = (avgSeasonalDiscountForTooltip !== null && avgSeasonalDiscountForTooltip > 0 && !acc.title.toLowerCase().includes('dorm')) || currentDurationDiscount > 0;

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
                      'border-border hover:border-accent-primary/50 bg-surface', // Default state: Use theme surface color, removed /50 and backdrop-blur
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
                      <div className="text-xs font-medium px-3 py-1 rounded-full shadow-md bg-accent-primary text-stone-800 font-regular border border-yellow-500">Selected</div>
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
                        {acc.capacity !== undefined && acc.capacity !== null && acc.capacity > 1 && acc.type !== 'tent' && (
                          <Tooltip.Provider delayDuration={50}>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button 
                                  className="flex items-center gap-1 cursor-help bg-transparent border-none p-0.5" 
                                  title={`Capacity: ${acc.capacity ?? 'N/A'}`}
                                  onTouchStart={(e) => e.preventDefault()}
                                > 
                                  <BedDouble size={12} /> {acc.capacity} 
                                </button>
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
                        
                        {/* Conditionally render the Electricity/No Electricity Tooltip - hide for Van Parking */}
                        {acc.title !== 'Van Parking' && (
                          <Tooltip.Provider delayDuration={50}>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button 
                                  className="flex items-center gap-1 cursor-help bg-transparent border-none p-0.5" 
                                  title={hasElectricity(acc.title) ? 'Has Electricity' : 'No Electricity'}
                                  onTouchStart={(e) => e.preventDefault()}
                                >
                                  {hasElectricity(acc.title) ? <Zap size={12} /> : <ZapOff size={12} className="opacity-50"/>}
                                </button>
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
                        )}
                        
                        <Tooltip.Provider delayDuration={50}>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button 
                                className="flex items-center gap-1 cursor-help bg-transparent border-none p-0.5" 
                                title={hasWifi(acc.title) ? 'Has WiFi' : 'No WiFi'}
                                onTouchStart={(e) => e.preventDefault()}
                              >
                                {hasWifi(acc.title) ? <Wifi size={12} /> : <WifiOff size={12} className="opacity-50"/>}
                              </button>
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
                              <button 
                                className="flex items-center gap-1 cursor-help bg-transparent border-none p-0.5"
                                onTouchStart={(e) => e.preventDefault()}
                              >
                                <Bed size={12} />
                              </button>
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

                        {/* NEW: Quiet Zone Tooltip for Microcabins */}
                        {acc.title.includes('Microcabin') && (
                          <Tooltip.Provider delayDuration={50}>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button className="flex items-center gap-1 cursor-help text-secondary"><Ear size={12} /></button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  sideOffset={5}
                                  className="tooltip-content !font-regular"
                                >
                                  <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                                  <span className="text-white">We invite those who seek quiet to stay here.</span>
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>
                        )}

                        {/* NEW: Power Hookup Tooltip for Van Parking */}
                        {acc.title === 'Van Parking' && (
                          <Tooltip.Provider delayDuration={50}>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button className="flex items-center gap-1 cursor-help text-secondary"><Zap size={12} /></button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  sideOffset={5}
                                  className="tooltip-content !font-regular"
                                >
                                  <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                                  <span className="text-white">Power hook-ups available on request</span>
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </Tooltip.Provider>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div className="text-primary font-medium font-regular">
                        {/* Check if weeklyPrice (from prop) is null or 0 */}
                        {weeklyPrice === null || weeklyPrice === 0 ? (
                          <span className="text-accent-primary">{weeklyPrice === 0 ? 'Free' : 'N/A'}</span>
                        ) : (
                          <>
                            €{weeklyPrice} 
                            <span className="text-sm text-secondary font-regular"> / week</span>
                          </>
                        )}
                      </div>
                      
                      {/* Ensure weeklyPrice is not null for discount display */}
                      {weeklyPrice !== null && weeklyPrice > 0 && hasAnyDiscount && (
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
                                <h4 className="font-medium font-regular text-white mb-2">Weekly Rate Breakdown</h4>
                                <div className="text-sm space-y-2">
                                   {/* Base Price */}
                                   <div className="flex justify-between items-center text-gray-300">
                                      <span>Base Rate:</span>
                                      <span>€{Math.round(acc.base_price)} / week</span>
                                   </div>
                                  
                                  {/* Seasonal Discount - Use avgSeasonalDiscount from prop */}
                                  {!acc.title.toLowerCase().includes('dorm') && avgSeasonalDiscountForTooltip !== null && avgSeasonalDiscountForTooltip > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-300">Seasonal Discount:</span>
                                      <span className="text-accent-primary font-medium">
                                        -{Math.round(avgSeasonalDiscountForTooltip * 100)}%
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Duration Discount - Use Math.round */}
                                  {currentDurationDiscount > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-300">Duration Discount ({completeWeeksForDiscount} wks):</span>
                                      <span className="text-accent-primary font-medium">
                                      -{Math.round(currentDurationDiscount * 100)}%
                                      </span>
                                    </div>
                                  )}

                                  {/* Separator */}
                                   <div className="border-t border-gray-600 my-1"></div>

                                   {/* Final Weekly Price - Use weeklyPrice from prop */}
                                   <div className="flex justify-between items-center font-medium text-white">
                                      <span>Final Weekly Rate:</span>
                                      {/* Ensure weeklyPrice is not null before rounding */}
                                      <span>€{weeklyPrice !== null ? weeklyPrice : 'N/A'}</span>
                                   </div>
                                </div>
                                 <p className="text-xs text-gray-400 mt-2 font-regular">Discounts applied multiplicatively.</p>
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