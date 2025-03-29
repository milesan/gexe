import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, BedDouble, WifiOff, ZapOff, Bath, Percent, Info } from 'lucide-react';
import clsx from 'clsx';
import type { Accommodation } from '../types';
import { Week } from '../types/calendar';
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown } from '../utils/pricing';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { addDays, isDate, eachDayOfInterval, isBefore } from 'date-fns';
import * as Tooltip from '@radix-ui/react-tooltip';
import { calculateTotalNights, calculateDurationDiscountWeeks } from '../utils/dates';

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
  currentMonth = new Date(),
  isDisabled = false
}: Props) {
  console.log('[CabinSelector] Rendering with props:', {
    accommodationsCount: accommodations?.length,
    selectedAccommodationId,
    selectedWeeksCount: selectedWeeks?.length,
    currentMonth: currentMonth.toISOString(),
    currentMonthNumber: currentMonth.getMonth(),
    currentMonthName: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentMonth),
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
      accommodations.forEach(acc => {
        if (!(acc as any).parent_accommodation_id) { // Only check parent accommodations
          checkWeekAvailability(acc, selectedWeeks.map(w => w.startDate || w));
        }
      });
    }
  }, [selectedWeeks, accommodations, checkWeekAvailability]);

  const handleSelectAccommodation = useCallback((id: string) => {
    console.log('[CabinSelector] Accommodation selected:', {
      accommodationId: id,
      previousSelection: selectedAccommodationId
    });
    // Check availability when accommodation is selected and weeks are already chosen
    if (selectedWeeks.length > 0) {
      const accommodation = accommodations.find(a => a.id === id);
      if (accommodation) {
        checkWeekAvailability(accommodation, selectedWeeks.map(w => w.startDate || w));
      }
    }

    onSelectAccommodation(id);
  }, [accommodations, selectedWeeks, checkWeekAvailability, onSelectAccommodation, selectedAccommodationId]);

  // Filter accommodations based on season and type
  const visibleAccommodations = accommodations.filter(acc => {
    // Filter out individual bed entries
    if ((acc as any).parent_accommodation_id) return false;
    return true;
  });

  // Convert selectedWeeks to dates for comparison
  const selectedDates = selectedWeeks?.map(w => w.startDate || w) || [];
  
  // Get month for filtering - only used for display when no weeks are selected
  const month = currentMonth.getMonth();
  const year = currentMonth.getFullYear();

  // Check if it's tent season (April 15 - September 1)
  // For tent season calculation, we'll use the first selected week's start date
  // If no weeks are selected, we'll use the current month for display purposes
  const firstSelectedDate = selectedWeeks.length > 0 
    ? (selectedWeeks[0].startDate || new Date()) 
    : new Date();
  
  const isTentSeason = (() => {
    if (selectedWeeks.length === 0) {
      // If no weeks selected, use current month for display purposes
      const m = currentMonth.getMonth();
      return (m > 3 || (m === 3 && currentMonth.getDate() >= 15)) && 
             (m < 8 || (m === 8 && currentMonth.getDate() <= 1));
    }
    
    // For actual bookings, check if ALL of the selected days fall within tent season
    const isInTentSeason = (date: Date) => {
      const m = date.getMonth();
      const d = date.getDate();
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
      
      // Get all days in this week
      const daysInWeek = eachDayOfInterval({ start: startDate, end: endDate });
      allDays = [...allDays, ...daysInWeek];
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
      // If no weeks selected, use current month for display purposes
      return getSeasonalDiscount(currentMonth, accommodationType);
    }

    // Get all days in the selected period
    let allDays: Date[] = [];
    
    weeks.forEach(week => {
      const startDate = week.startDate || (week instanceof Date ? week : new Date());
      const endDate = week.endDate || addDays(startDate, 6); // 6 days = 1 week (inclusive)
      
      if (isBefore(endDate, startDate)) {
        console.warn('[CabinSelector] Invalid date range:', { startDate, endDate });
        return;
      }
      
      // Get all days in this week
      const daysInWeek = eachDayOfInterval({ start: startDate, end: endDate });
      allDays = [...allDays, ...daysInWeek];
    });
    
    if (allDays.length === 0) {
      return getSeasonalDiscount(currentMonth, accommodationType);
    }
    
    // Calculate discount for each day
    let totalDiscount = 0;
    
    allDays.forEach(day => {
      totalDiscount += getSeasonalDiscount(day, accommodationType);
    });
    
    // Calculate weighted average discount
    const weightedDiscount = totalDiscount / allDays.length;
    
    console.log('[CabinSelector] Weighted seasonal discount calculation:', {
      totalDays: allDays.length,
      firstDay: allDays[0]?.toISOString(),
      lastDay: allDays[allDays.length - 1]?.toISOString(),
      weightedDiscount: weightedDiscount,
      discountPercentage: `${(weightedDiscount * 100).toFixed(1)}%`,
      accommodationType
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
    month: month,
    monthName: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentMonth),
    year: year,
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
                >
                  {/* Booked out overlay */}
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-stone-50/50 z-10 flex items-center justify-center">
                      <div className="bg-stone-100/80 backdrop-blur-[1px] text-stone-500 px-3 py-1.5 rounded-md font-medium text-xs shadow-sm border border-stone-200 font-regular">
                        Booked out
                      </div>
                    </div>
                  )}
                  
                  {/* Out of season overlay for tents - more subtle */}
                  {isOutOfSeason && (
                    <div className="absolute inset-0 bg-amber-50/40 z-10 flex items-center justify-center">
                      <div className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-md font-medium text-xs shadow-sm border border-amber-200 font-regular">
                        Seasonal: Apr 15 - Sep 1
                      </div>
                    </div>
                  )}
                  
                  {/* Selected indicator */}
                  {selectedAccommodationId === accommodation.id && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full shadow-md font-regular">
                        Selected
                      </div>
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  {statusBadge && !isOutOfSeason && (
                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
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
                          <div 
                            className={clsx(
                              "relative",
                              selectedWeeks.length > 0 && 
                              !accommodation.title.includes('Dorm') && 
                              accommodation.base_price > 0 && "cursor-help"
                            )}
                          >
                            {hasWifi(accommodation.title) ? (
                              <Wifi size={18} className="text-emerald-300 hover:text-emerald-200" />
                            ) : (
                              <WifiOff size={18} className="text-stone-400 hover:text-stone-300" />
                            )}
                          </div>

                          {/* Electricity indicator */}
                          <div 
                            className="relative"
                          >
                            {hasElectricity(accommodation.title) ? (
                              <Zap size={18} className="text-emerald-300 hover:text-emerald-200" />
                            ) : (
                              <ZapOff size={18} className="text-stone-400 hover:text-stone-300" />
                            )}
                          </div>

                          {/* Bed size indicator */}
                          {BED_SIZES[accommodation.title as keyof typeof BED_SIZES] && 
                           BED_SIZES[accommodation.title as keyof typeof BED_SIZES] !== 'N/A' && 
                           BED_SIZES[accommodation.title as keyof typeof BED_SIZES] !== 'Bring your own' && (
                            <div 
                              className="relative"
                            >
                              <BedDouble size={18} className="text-emerald-300 hover:text-emerald-200" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-3 bg-white">
                      <div className="flex flex-col h-full">
                        {/* Title */}
                        <h3 className="text-base font-medium text-stone-900 mb-1.5 line-clamp-1 font-regular" title={accommodation.title}>
                          {accommodation.title}
                        </h3>

                        {/* Price Section */}
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-light tracking-tight text-stone-900 font-regular">
                              €{selectedWeeks.length > 0 
                                ? calculateFinalPrice(accommodation.base_price, selectedWeeks, accommodation.title).toFixed(0)
                                : accommodation.base_price}
                            </span>
                            <span className="text-sm text-stone-500 font-regular"> / week</span>
                            {(() => {
                              const durationDiscount = selectedWeeks.length > 0 ? getDurationDiscount(calculateDurationDiscountWeeks(selectedWeeks)) : 0;
                              return selectedWeeks.length > 0 && 
                                     !accommodation.title.includes('Dorm') && 
                                     accommodation.base_price > 0 && 
                                     (seasonalDiscount > 0 || durationDiscount > 0) && (
                                <Tooltip.Provider>
                                  <Tooltip.Root delayDuration={0}>
                                    <Tooltip.Trigger asChild>
                                      <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 ml-1 cursor-help" />
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                      <Tooltip.Content
                                        className="bg-white p-4 rounded-lg shadow-lg border border-stone-200 max-w-xs z-50 data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                                        sideOffset={5}
                                      >
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Percent className="w-4 h-4 text-emerald-600" />
                                            <h4 className="font-medium text-stone-800 font-regular">Discounts Applied</h4>
                                          </div>
                                          <div className="mt-2 space-y-2">
                                            {seasons
                                              .filter(season => season.nights > 0 && season.discount > 0)
                                              .map((season, index) => (
                                              <div key={index} className={`flex items-center text-xs gap-2 ${season.nights > 0 ? "text-emerald-700 font-medium" : ""} font-regular`}>
                                                <span className="min-w-[100px]">{season.name}</span>
                                                <span className="font-medium">
                                                  {season.nights} nights × {Math.round(season.discount * 100)}% off
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="text-xs text-stone-500 font-regular">
                                            {durationDiscount > 0 && `Duration discount: ${Math.round(durationDiscount * 100)}% off`}
                                          </div>
                                        </div>
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