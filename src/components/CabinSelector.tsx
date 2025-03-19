import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, BedDouble, WifiOff, ZapOff, Bath } from 'lucide-react';
import clsx from 'clsx';
import type { Accommodation } from '../types';
import { Week } from '../types/calendar';
import { getSeasonalDiscount } from '../utils/pricing';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { addDays, isDate, eachDayOfInterval, isBefore } from 'date-fns';
import { createPortal } from 'react-dom';

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

// Simple tooltip component with portal
const Tooltip = ({ 
  content, 
  show, 
  x, 
  y, 
  type 
}: { 
  content: React.ReactNode, 
  show: boolean, 
  x: number, 
  y: number,
  type: 'wifi' | 'electricity' | 'bed'
}) => {
  if (!show) return null;
  
  return createPortal(
    <div 
      className={`fixed transition-all duration-200 pointer-events-none z-[9999] ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        // All tooltips now use the same positioning with no offset
        transform: 'translate(-50%, -130%)',
        marginBottom: '0.5rem'
      }}
    >
      <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
        {content}
      </div>
    </div>,
    document.body
  );
};

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
  const calculateWeightedSeasonalDiscount = (weeks: Week[]): number => {
    if (weeks.length === 0) {
      // If no weeks selected, use current month for display purposes
      return getSeasonalDiscount(currentMonth);
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
      return getSeasonalDiscount(currentMonth);
    }
    
    // Calculate discount for each day
    let totalDiscount = 0;
    
    allDays.forEach(day => {
      totalDiscount += getSeasonalDiscount(day);
    });
    
    // Calculate weighted average discount
    const weightedDiscount = totalDiscount / allDays.length;
    
    console.log('[CabinSelector] Weighted seasonal discount calculation:', {
      totalDays: allDays.length,
      firstDay: allDays[0]?.toISOString(),
      lastDay: allDays[allDays.length - 1]?.toISOString(),
      weightedDiscount: weightedDiscount,
      discountPercentage: `${(weightedDiscount * 100).toFixed(1)}%`
    });
    
    return weightedDiscount;
  };

  // Determine if the booking spans multiple seasons with different discount rates
  const getSeasonBreakdown = (weeks: Week[]): { hasMultipleSeasons: boolean, seasons: { name: string, discount: number, days: number }[] } => {
    if (weeks.length === 0) {
      const discount = getSeasonalDiscount(currentMonth);
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      return { 
        hasMultipleSeasons: false, 
        seasons: [{ name: seasonName, discount, days: 0 }] 
      };
    }

    // Get all days in the selected period
    let allDays: Date[] = [];
    
    weeks.forEach(week => {
      const startDate = week.startDate || (week instanceof Date ? week : new Date());
      const endDate = week.endDate || addDays(startDate, 6);
      
      if (isBefore(endDate, startDate)) {
        return;
      }
      
      const daysInWeek = eachDayOfInterval({ start: startDate, end: endDate });
      allDays = [...allDays, ...daysInWeek];
    });
    
    if (allDays.length === 0) {
      const discount = getSeasonalDiscount(currentMonth);
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      return { 
        hasMultipleSeasons: false, 
        seasons: [{ name: seasonName, discount, days: 0 }] 
      };
    }
    
    // Group days by season
    const seasonMap: Record<string, { name: string, discount: number, days: number }> = {};
    
    allDays.forEach(day => {
      const discount = getSeasonalDiscount(day);
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      const key = `${seasonName}-${discount}`;
      
      if (!seasonMap[key]) {
        seasonMap[key] = { name: seasonName, discount, days: 0 };
      }
      
      seasonMap[key].days++;
    });
    
    const seasons = Object.values(seasonMap).sort((a, b) => b.days - a.days);
    const hasMultipleSeasons = seasons.length > 1;
    
    console.log('[CabinSelector] Season breakdown:', { 
      hasMultipleSeasons, 
      seasons,
      totalDays: allDays.length
    });
    
    return { hasMultipleSeasons, seasons };
  };

  const seasonalDiscount = calculateWeightedSeasonalDiscount(selectedWeeks);
  const { hasMultipleSeasons, seasons } = getSeasonBreakdown(selectedWeeks);
  
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

  // Instead use simple tooltip state for each type
  const [wifiTooltip, setWifiTooltip] = useState({ show: false, x: 0, y: 0, content: '' });
  const [electricityTooltip, setElectricityTooltip] = useState({ show: false, x: 0, y: 0, content: '' });
  const [bedTooltip, setBedTooltip] = useState({ show: false, x: 0, y: 0, content: '' });
  
  // Functions to handle tooltip visibility
  const showTooltip = (
    e: React.MouseEvent, 
    content: string, 
    setTooltipState: React.Dispatch<React.SetStateAction<{show: boolean, x: number, y: number, content: string}>>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipState({
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      content
    });
  };
  
  const hideTooltip = (
    setTooltipState: React.Dispatch<React.SetStateAction<{show: boolean, x: number, y: number, content: string}>>
  ) => {
    setTooltipState(prev => ({ ...prev, show: false }));
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
          <h3 className="text-lg font-medium text-stone-800 mb-2">No accommodations available</h3>
          <p className="text-stone-600">Please try different dates or check back later.</p>
        </div>
      ) : (
        <>
          {isDisabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                Please select dates above to see availability for each accommodation.
              </p>
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
              if (!isAvailable && selectedWeeks.length > 0) {
                statusBadge = {
                  text: "Not available for selected dates",
                  bgColor: "bg-rose-50",
                  textColor: "text-rose-600"
                };
              } else if (availableCapacity !== null && availableCapacity !== undefined) {
                statusBadge = {
                  text: `${availableCapacity} ${availableCapacity === 1 ? 'spot' : 'spots'} available`,
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
                    (!isAvailable || isDisabled) && 'opacity-70',
                    isOutOfSeason && 'opacity-85'
                  )}
                  whileHover={{ y: -4, scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Out of season overlay for tents - more subtle */}
                  {isOutOfSeason && (
                    <div className="absolute inset-0 bg-amber-50/40 z-10 flex items-center justify-center">
                      <div className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-md font-medium text-xs shadow-sm border border-amber-200">
                        Seasonal: Apr 15 - Sep 1
                      </div>
                    </div>
                  )}
                  
                  {/* Selected indicator */}
                  {selectedAccommodationId === accommodation.id && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full shadow-md">
                        Selected
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
                            className="relative"
                            onMouseEnter={(e) => showTooltip(
                              e, 
                              hasWifi(accommodation.title) ? 'WiFi Available' : 'No WiFi',
                              setWifiTooltip
                            )}
                            onMouseLeave={() => hideTooltip(setWifiTooltip)}
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
                            onMouseEnter={(e) => showTooltip(
                              e, 
                              hasElectricity(accommodation.title) ? 'Electricity Available' : 'No Electricity',
                              setElectricityTooltip
                            )}
                            onMouseLeave={() => hideTooltip(setElectricityTooltip)}
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
                              onMouseEnter={(e) => showTooltip(
                                e, 
                                BED_SIZES[accommodation.title as keyof typeof BED_SIZES],
                                setBedTooltip
                              )}
                              onMouseLeave={() => hideTooltip(setBedTooltip)}
                            >
                              <BedDouble size={18} className="text-emerald-300 hover:text-emerald-200" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-4 bg-white">
                      <div className="flex flex-col h-full">
                        {/* Title */}
                        <h3 className="text-base font-medium text-stone-900 mb-2 line-clamp-1" title={accommodation.title}>
                          {accommodation.title}
                        </h3>

                        {/* Price Section - Show base price with discount indicator */}
                        <div className="flex flex-col mb-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-light tracking-tight text-stone-900">€{accommodation.base_price}</span>
                            <span className="text-sm text-stone-500">/week</span>
                          </div>
                          
                          {/* Discount indicator - only show for available, non-free accommodations and during tent season for tents */}
                          {selectedWeeks.length > 0 && 
                           seasonalDiscount > 0 && 
                           accommodation.base_price > 0 && 
                           isAvailable &&
                           (!isTent || (isTent && isTentSeason)) && (
                            <div className="mt-1">
                              {hasMultipleSeasons ? (
                                <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                                  Seasonal discounts available
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                                  {Math.round(seasonalDiscount * 100)}% off
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Status Badge - don't show "Available Apr 15..." for tents when we already have the overlay */}
                        {statusBadge && !isOutOfSeason && (
                          <div className="mt-auto">
                            <div className={`inline-flex items-center px-2 py-1 rounded-full ${statusBadge.bgColor} ${statusBadge.textColor} text-xs font-medium`}>
                              {statusBadge.text}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
      
      {/* Render tooltip portals */}
      <Tooltip 
        content={wifiTooltip.content} 
        show={wifiTooltip.show} 
        x={wifiTooltip.x} 
        y={wifiTooltip.y}
        type="wifi"
      />
      <Tooltip 
        content={electricityTooltip.content} 
        show={electricityTooltip.show} 
        x={electricityTooltip.x} 
        y={electricityTooltip.y}
        type="electricity"
      />
      <Tooltip 
        content={bedTooltip.content} 
        show={bedTooltip.show} 
        x={bedTooltip.x} 
        y={bedTooltip.y}
        type="bed"
      />
    </div>
  );
}