import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, BedDouble, WifiOff, ZapOff, Bath } from 'lucide-react';
import clsx from 'clsx';
import type { Accommodation } from '../types';
import { Week } from '../types/calendar';
import { getSeasonalDiscount } from '../utils/pricing';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { addDays, isDate } from 'date-fns';

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
  '5m Bell Tent': '160×200cm (63×79") - Queen',
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
        if (!acc.parent_accommodation_id) { // Only check parent accommodations
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
    if (acc.parent_accommodation_id) return false;
    return true;
  });

  // Convert selectedWeeks to dates for comparison
  const selectedDates = selectedWeeks?.map(w => w.startDate || w) || [];
  
  // Get month for filtering
  const month = currentMonth.getMonth();
  const year = currentMonth.getFullYear();

  // Check if it's tent season (April 15 - September 1)
  const currentDate = selectedWeeks.length > 0 
    ? (selectedWeeks[0].startDate || new Date()) 
    : new Date();
  
  const isTentSeason = (month > 3 || (month === 3 && currentDate.getDate() >= 15)) && 
                      (month < 8 || (month === 8 && currentDate.getDate() <= 1));

  const seasonalDiscount = getSeasonalDiscount(currentMonth);

  return (
    <div className={clsx("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6", isDisabled && "opacity-70")}>
      {visibleAccommodations.map((accommodation) => {
        const isAvailable = selectedWeeks.length === 0 || 
          availabilityMap[accommodation.id]?.isAvailable;
        const availableCapacity = availabilityMap[accommodation.id]?.availableCapacity;
        const isTent = accommodation.type === 'tent';
        const isOutOfSeason = isTent && !isTentSeason && selectedWeeks.length > 0;

        const discountedPrice = Math.round(accommodation.base_price * (1 - seasonalDiscount));

        return (
          <motion.button
            key={accommodation.id}
            onClick={() => handleSelectAccommodation(accommodation.id)}
            className={clsx(
              'relative w-full text-left rounded-xl overflow-hidden transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-emerald-900 focus:ring-offset-2',
              selectedAccommodationId === accommodation.id ? 'ring-2 ring-emerald-900 ring-offset-2' : 'hover:ring-2 hover:ring-emerald-900/50 hover:ring-offset-2',
              (!isAvailable || isOutOfSeason || isDisabled) && 'opacity-50 cursor-not-allowed'
            )}
            disabled={!isAvailable || isOutOfSeason || isDisabled}
            whileHover={{ y: -4 }}
            whileTap={{ y: 0 }}
          >
            <div className="aspect-[4/3] bg-stone-100 relative">
              {accommodation.image_url && (
                <img
                  src={accommodation.image_url}
                  alt={accommodation.title}
                  className="w-full h-full object-cover"
                />
              )}
              {/* Amenities overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-12 pb-3 px-3">
                <div className="flex items-center justify-end space-x-3 text-white">
                  <div className="group/wifi">
                    {hasWifi(accommodation.title) ? (
                      <Wifi size={18} className="cursor-help transition-colors hover:text-emerald-400" />
                    ) : (
                      <WifiOff size={18} className="cursor-help transition-colors hover:text-stone-400" />
                    )}
                    <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover/wifi:opacity-100 transform translate-y-1 group-hover/wifi:translate-y-0 transition-all duration-200 pointer-events-none z-50">
                      <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                        {hasWifi(accommodation.title) ? 'WiFi Available' : 'No WiFi'}
                        <div className="absolute bottom-0 right-6 translate-y-full border-4 border-transparent border-t-stone-900"></div>
                      </div>
                    </div>
                  </div>

                  <div className="group/electricity">
                    {hasElectricity(accommodation.title) ? (
                      <Zap size={18} className="cursor-help transition-colors hover:text-emerald-400" />
                    ) : (
                      <ZapOff size={18} className="cursor-help transition-colors hover:text-stone-400" />
                    )}
                    <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover/electricity:opacity-100 transform translate-y-1 group-hover/electricity:translate-y-0 transition-all duration-200 pointer-events-none z-50">
                      <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                        {hasElectricity(accommodation.title) ? 'Electricity Available' : 'No Electricity'}
                        <div className="absolute bottom-0 right-6 translate-y-full border-4 border-transparent border-t-stone-900"></div>
                      </div>
                    </div>
                  </div>

                  <div className="group/bed">
                    <BedDouble size={18} className="cursor-help transition-colors hover:text-emerald-400" />
                    <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover/bed:opacity-100 transform translate-y-1 group-hover/bed:translate-y-0 transition-all duration-200 pointer-events-none z-50">
                      <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                        {BED_SIZES[accommodation.title as keyof typeof BED_SIZES]}
                        <div className="absolute bottom-0 right-6 translate-y-full border-4 border-transparent border-t-stone-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content Section */}
            <div className="p-4 bg-white border border-t-0 border-stone-200 rounded-b-xl h-[140px]">
              <div className="flex flex-col h-full">
                {/* Title */}
                <div className="relative h-[24px] mb-2">
                  <h3 className="text-[16px] font-medium text-stone-900 absolute whitespace-nowrap"
                    style={{
                      transform: `scale(${Math.min(1, 280 / (accommodation.title.length * 9))})`,
                      transformOrigin: 'left center'
                    }}>
                    {accommodation.title}
                  </h3>
                </div>

                {/* Price Section */}
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-light tracking-tight text-stone-900">€{discountedPrice}</span>
                  <div className="flex items-baseline gap-2 text-stone-400">
                    {seasonalDiscount > 0 && (
                      <span className="text-sm line-through">€{accommodation.base_price}</span>
                    )}
                    <span className="text-sm">/week</span>
                  </div>
                </div>

                {/* Status Messages */}
                <div className="mt-auto">
                  {!isAvailable && selectedWeeks.length > 0 && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-medium">
                      Not available for selected dates
                    </div>
                  )}

                  {isOutOfSeason && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
                      Available April 15 - September 1
                    </div>
                  )}
                  
                  {availableCapacity !== null && availableCapacity !== undefined && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                      {availableCapacity} {availableCapacity === 1 ? 'spot' : 'spots'} available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}