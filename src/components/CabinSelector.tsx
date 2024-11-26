import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, BedDouble, WifiOff, ZapOff, Bath } from 'lucide-react';
import clsx from 'clsx';
import type { Accommodation } from '../types';
import { getSeasonalDiscount } from '../utils/pricing';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';

interface Props {
  accommodations: Accommodation[];
  selectedAccommodation: string | null;
  onSelectAccommodation: (id: string) => void;
  selectedWeeks: Date[];
  currentMonth: Date;
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

const GLAMPING_SEASON = [4, 5, 6, 7, 8, 9, 10]; // April to October

export function CabinSelector({
  accommodations,
  selectedAccommodation,
  onSelectAccommodation,
  selectedWeeks,
  currentMonth
}: Props) {
  const { checkAvailability, availabilityMap } = useWeeklyAccommodations();
  
  const hasWifi = (title: string) => HAS_WIFI.includes(title);
  const hasElectricity = (title: string) => HAS_ELECTRICITY.includes(title);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      const startDate = selectedWeeks[0];
      const endDate = new Date(selectedWeeks[selectedWeeks.length - 1]);
      endDate.setDate(endDate.getDate() + 6); // Add 6 days to include the full last week
      checkAvailability(startDate, endDate);
    }
  }, [selectedWeeks, checkAvailability]);

  // Filter out individual bed entries and sort free accommodations first
  const visibleAccommodations = accommodations
    .filter(acc => {
      // Filter out individual bed entries
      if (acc.parent_accommodation_id) return false;

      // Check if it's glamping season for glamping accommodations
      const isGlamping = ['Tipi', 'Bell Tent', 'Your Own Tent'].some(type => acc.title.includes(type));
      if (isGlamping) {
        // If no weeks selected, check current date
        const dateToCheck = selectedWeeks.length > 0 ? selectedWeeks[0] : new Date();
        const month = dateToCheck.getMonth();
        return GLAMPING_SEASON.includes(month); // April to October
      }

      return true;
    })
    .sort((a, b) => {
      const aIsFree = a.price === 0;
      const bIsFree = b.price === 0;
      if (aIsFree && !bIsFree) return -1;
      if (!aIsFree && bIsFree) return 1;
      return 0;
    });

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-serif font-light text-stone-900 mb-6">
        Select Your Accommodation
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleAccommodations.map((accommodation) => {
          const seasonalDiscount = selectedWeeks.length > 0 ? 
            selectedWeeks.reduce((acc, week) => acc + getSeasonalDiscount(week), 0) / selectedWeeks.length : 
            0;
          
          const hasDiscount = seasonalDiscount > 0;
          const discountedPrice = Math.round(accommodation.price * (1 - seasonalDiscount));
          
          const availabilityStatus = availabilityMap[accommodation.id];
          const isAvailable = accommodation.is_unlimited || 
            (accommodation.title.includes('Dorm') ? availabilityStatus > 0 : availabilityStatus !== -1);
          
          return (
            <motion.button
              key={accommodation.id}
              onClick={() => isAvailable && onSelectAccommodation(accommodation.id)}
              className={clsx(
                'relative overflow-hidden transition-all duration-300 pixel-corners',
                selectedAccommodation === accommodation.id 
                  ? 'border-2 border-emerald-600 shadow-lg transform -translate-y-1' 
                  : 'border-2 border-stone-200 hover:border-emerald-600/20',
                accommodation.price === 0 && 'md:col-span-1 lg:col-span-1',
                !isAvailable && 'opacity-50 cursor-not-allowed'
              )}
              whileHover={isAvailable ? { scale: 1.02 } : undefined}
              whileTap={isAvailable ? { scale: 0.98 } : undefined}
            >
              <div className="aspect-[4/3] relative">
                <img
                  src={accommodation.image_url}
                  alt={accommodation.title}
                  className={clsx(
                    "absolute inset-0 w-full h-full object-cover",
                    !isAvailable && "grayscale"
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                {/* Available Units Counter for Dorms */}
                {(accommodation.title.includes('Dorm') || accommodation.is_fungible) && !accommodation.is_unlimited && availabilityStatus > 0 && (
                  <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-1 rounded-full text-sm">
                    {availabilityStatus} {availabilityStatus === 1 ? 'space' : 'spaces'} available
                  </div>
                )}

                {/* Utilities Icons */}
                <div className="absolute top-4 right-4 flex gap-2">
                  {hasWifi(accommodation.title) ? (
                    <div className="group relative">
                      <Wifi className="w-5 h-5 text-white" />
                      <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Dedicated 1000Mbps internet connection shared between seven guest house rooms
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <WifiOff className="w-5 h-5 text-white/70" />
                      <div className="absolute right-0 top-full mt-2 w-32 p-2 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        No WiFi available
                        {accommodation.title === 'A-Frame Pod' && (
                          <span className="block mt-1">Cabin being built nearby</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {hasElectricity(accommodation.title) ? (
                    <div className="group relative">
                      <Zap className="w-5 h-5 text-white" />
                      <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Electrical outlets available
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <ZapOff className="w-5 h-5 text-white/70" />
                      <div className="absolute right-0 top-full mt-2 w-32 p-2 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        No electricity
                      </div>
                    </div>
                  )}
                  
                  <div className="group relative">
                    <BedDouble className="w-5 h-5 text-white" />
                    <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {BED_SIZES[accommodation.title as keyof typeof BED_SIZES]}
                    </div>
                  </div>

                  {accommodation.title === 'Master\'s Suite' && (
                    <div className="group relative">
                      <Bath className="w-5 h-5 text-white" />
                      <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Ensuite bathroom (needs remodeling, price adjusted)
                      </div>
                    </div>
                  )}
                </div>

                {!isAvailable && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white font-display text-xl">Not Available</p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white">
                <h3 className="text-xl font-serif">{accommodation.title}</h3>
                <div className="mt-2">
                  {accommodation.price === 0 ? (
                    <p className="text-emerald-700 font-medium">Free</p>
                  ) : hasDiscount ? (
                    <>
                      <p className="text-emerald-700 font-medium">
                        €{discountedPrice}/week
                        <span className="text-stone-400 text-sm ml-2">❧</span>
                        <span className="text-stone-400 line-through text-sm ml-2">
                          €{accommodation.price}
                        </span>
                      </p>
                      <p className="text-sm text-emerald-600 mt-1">
                        Slower season rate
                      </p>
                    </>
                  ) : (
                    <p className="text-stone-600">€{accommodation.price} per week</p>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}