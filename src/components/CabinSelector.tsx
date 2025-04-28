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
import * as Popover from '@radix-ui/react-popover';
import { calculateTotalNights, calculateDurationDiscountWeeks, normalizeToUTCDate } from '../utils/dates';
import { useSession } from '../hooks/useSession';

// Define admin emails (consider moving to a central config/env variable later)
const ADMIN_EMAILS = [
  'andre@thegarden.pt',
  'redis213@gmail.com',
  'dawn@thegarden.pt',
  'simone@thegarden.pt',
  'samjlloa@gmail.com'
];

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

// Helper Component for Overlays
const StatusOverlay: React.FC<{ 
  isVisible: boolean; 
  zIndex: number; 
  children: React.ReactNode; 
  className?: string; 
}> = ({ isVisible, zIndex, children, className }) => {
  if (!isVisible) return null;

  return (
    <div className={clsx("absolute inset-0 flex items-center justify-center p-4", `z-[${zIndex}]`)}> {/* Positioning only */}
      <div className={clsx(
        "bg-surface text-text-primary px-4 py-2 rounded-md font-mono text-sm text-center border border-border shadow-md",
        className // Allow specific styling overrides like border color
      )}>
        {children}
      </div>
    </div>
  );
};

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
  const session = useSession();
  const isAdmin = session?.user?.email ? ADMIN_EMAILS.includes(session.user.email) : false;

  console.log('[CabinSelector] Rendering with props:', {
    accommodationsCount: accommodations?.length,
    selectedAccommodationId,
    selectedWeeksCount: selectedWeeks?.length,
    currentMonth: currentMonth.toISOString(),
    currentMonthNumber: currentMonth.getUTCMonth(),
    currentMonthName: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(currentMonth),
    isAdmin,
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
  
  // Helper function for consistent price formatting
  const formatPrice = (price: number | null, isTest: boolean): string => {
    if (price === null) return 'N/A';
    if (price === 0) return 'Free';
    if (price === 0.5) return '0.5'; // Preserve specific edge case
    if (isTest) return price.toString(); // Show exact value for test accommodations

    // For regular accommodations, show integer if whole number, otherwise two decimals
    return Number.isInteger(price) ? price.toString() : price.toFixed(2);
  };

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
    console.log("[CabinSelector] Accommodation selected:", {
      accommodationId: id,
      previousSelection: selectedAccommodationId
    });
    
    // NEW: If clicking the already selected accommodation, deselect it
    if (id === selectedAccommodationId) {
      console.log("[CabinSelector] Deselecting accommodation:", { accommodationId: id });
      onSelectAccommodation('');
      return; // Stop further execution
    }

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

      // Filter out 'test' accommodations if the user is NOT an admin
      if (acc.type === 'test' && !isAdmin) {
         console.log(`[CabinSelector] Filtering out test accommodation "${acc.title}" for non-admin user.`);
         return false;
      }

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
          <h3 className="text-lg font-medium text-primary mb-2 font-mono">No accommodations available</h3>
          <p className="text-secondary font-mono">Please adjust your dates or check back later.</p>
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
              // Ensure weeklyInfo and its properties are defined before accessing
              let weeklyPrice = weeklyInfo?.price ?? null; // Use null as default if undefined
              const avgSeasonalDiscountForTooltip = weeklyInfo?.avgSeasonalDiscount ?? null; // Use null as default

              // Keep duration discount calculation local to tooltip
              const completeWeeksForDiscount = calculateDurationDiscountWeeks(selectedWeeks);
              const currentDurationDiscount = getDurationDiscount(completeWeeksForDiscount);
              
              // --- START TEST ACCOMMODATION OVERRIDE ---
              let isTestAccommodation = acc.type === 'test';
              if (isTestAccommodation) {
                weeklyPrice = 0.5; // Override price
              }
              // --- END TEST ACCOMMODATION OVERRIDE ---

              // Use the avgSeasonalDiscount from the prop for the flag, exclude test accommodations
              // Original check: (avgSeasonalDiscountForTooltip !== null && avgSeasonalDiscountForTooltip > 0 && !acc.title.toLowerCase().includes('dorm')) || currentDurationDiscount > 0;
              const hasSeasonalDiscount = avgSeasonalDiscountForTooltip !== null && avgSeasonalDiscountForTooltip > 0 && !acc.title.toLowerCase().includes('dorm');
              const hasDurationDiscount = currentDurationDiscount > 0;
              const hasAnyDiscount = !isTestAccommodation && (hasSeasonalDiscount || hasDurationDiscount); // <-- Modified: Exclude test type

              return (
                <motion.div
                  key={acc.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={clsx(
                    'relative rounded-sm overflow-hidden transition-all duration-200 flex flex-col justify-between group mb-4', // Base classes
                    // Apply bg-surface by default, override when selected, add shadow only when selected
                    isSelected 
                      ? "shadow-lg bg-[color-mix(in_srgb,_var(--color-bg-surface)_95%,_var(--color-accent-primary)_5%)]" 
                      : "bg-surface", // Use the renamed class
                    // Pointer state:
                    finalCanSelect && !isDisabled && 'cursor-pointer'
                  )}
                  onClick={(e) => {
                    // Prevent event bubbling to parent elements
                    e.stopPropagation();
                    finalCanSelect && !isDisabled && handleSelectAccommodation(acc.id);
                  }}
                  style={{ minHeight: '300px' }} 
                >
                  {/* Use the StatusOverlay helper component */}
                  <StatusOverlay isVisible={isDisabled} zIndex={4}>
                    Select dates first
                  </StatusOverlay>
                  <StatusOverlay isVisible={!isDisabled && isFullyBooked} zIndex={3}>
                    Booked out
                  </StatusOverlay>
                  <StatusOverlay 
                    isVisible={!isDisabled && isOutOfSeason && !isFullyBooked} 
                    zIndex={2}
                    className="border-amber-500 dark:border-amber-600" // Pass specific class for amber border
                  >
                    Seasonal<br />Apr 15 - Sep 1
                  </StatusOverlay>

                  {/* Badge container - place above overlays */}
                  <div className="absolute top-2 left-2 z-[5] flex flex-col gap-2"> 
                    {/* Spots Available Indicator */}
                    {spotsAvailable !== undefined && spotsAvailable !== null && spotsAvailable < (acc.capacity ?? Infinity) && !isFullyBooked && !isOutOfSeason && !isDisabled && acc.type !== 'tent' && (
                      <div className="text-xs font-medium px-3 py-1 rounded-full shadow-lg bg-gray-600/90 text-white border border-white/30 font-mono">{spotsAvailable} {spotsAvailable === 1 ? 'spot' : 'spots'} available</div>
                    )}
                  </div>

                  {/* Image */}
                  <div className={clsx(
                    "relative h-56 overflow-hidden", // REMOVED bg-surface
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
                    "p-3 flex-grow flex flex-col justify-between", // Base classes
                    // REMOVED background logic here - relies on parent motion.div now
                    // Apply blur and corresponding opacity/grayscale conditionally
                    isDisabled && "blur-sm opacity-20 grayscale-[0.5]",
                    (!isDisabled && isFullyBooked) && "blur-sm opacity-20 grayscale-[0.7]",
                    (!isDisabled && isOutOfSeason && !isFullyBooked) && "blur-sm opacity-40 grayscale-[0.3]"
                  )}>
                    <div>
                      <h3 className="text-lg font-medium mb-1 text-primary font-lettra-bold uppercase">{acc.title}</h3>
                      <div className="flex items-center gap-3 text-secondary text-xs mb-4"> {/* Increased bottom margin to mb-4 */}
                        
                        {/* Conditionally render the Electricity/No Electricity Popover - hide for Van Parking */}
                        {acc.title !== 'Van Parking' && (
                          <Popover.Root>
                            <Popover.Trigger asChild>
                              <button
                                className="flex items-center gap-1 cursor-help bg-transparent border-none p-0.5"
                                title={acc.has_electricity ? 'Has Electricity' : 'No Electricity'}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {acc.has_electricity ? <Zap size={12} /> : <ZapOff size={12} className="opacity-50"/>}
                              </button>
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content
                                sideOffset={5}
                                className="tooltip-content !font-mono z-50"
                                onOpenAutoFocus={(e: Event) => e.preventDefault()}
                              >
                                <Popover.Arrow className="tooltip-arrow" width={11} height={5} />
                                <span>{acc.has_electricity ? 'Has Electricity' : 'No Electricity'}</span>
                              </Popover.Content>
                            </Popover.Portal>
                          </Popover.Root>
                        )}
                        
                        {/* Wifi Popover */}
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button
                              className="flex items-center gap-1 cursor-help bg-transparent border-none p-0.5"
                              title={acc.has_wifi ? 'Has WiFi' : 'No WiFi'}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {acc.has_wifi ? <Wifi size={12} /> : <WifiOff size={12} className="opacity-50"/>}
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              sideOffset={5}
                              className="tooltip-content !font-mono z-50"
                              onOpenAutoFocus={(e: Event) => e.preventDefault()}
                            >
                              <Popover.Arrow className="tooltip-arrow" width={11} height={5} />
                              <span>{acc.has_wifi ? 'Has WiFi' : 'No WiFi'}</span>
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                        
                        {/* Bed Size Popover */}
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button
                              className="flex items-center gap-1 cursor-help bg-transparent border-none p-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Bed size={12} />
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              sideOffset={5}
                              className="tooltip-content !font-mono z-50"
                              onOpenAutoFocus={(e: Event) => e.preventDefault()}
                            >
                              <Popover.Arrow className="tooltip-arrow" width={11} height={5} />
                              <h4 className="font-medium font-mono mb-1">Bed Size</h4>
                              <p className="text-sm color-shade-2 font-mono">
                                {acc.bed_size || 'N/A'}
                              </p>
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>

                        {/* NEW: Quiet Zone Popover for Microcabins */}
                        {acc.title.includes('Microcabin') && (
                          <Popover.Root>
                            <Popover.Trigger asChild>
                              <button className="flex items-center gap-1 cursor-help text-secondary"
                              onClick={(e) => e.stopPropagation()}
                              ><Ear size={12} /></button>
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content
                                sideOffset={5}
                                className="tooltip-content !font-mono z-50"
                                onOpenAutoFocus={(e: Event) => e.preventDefault()}
                              >
                                <Popover.Arrow className="tooltip-arrow" width={11} height={5} />
                                <span>We invite those who seek quiet to stay here.</span>
                              </Popover.Content>
                            </Popover.Portal>
                          </Popover.Root>
                        )}

                        {/* NEW: Power Hookup Popover for Van Parking */}
                        {acc.title === 'Van Parking' && (
                          <Popover.Root>
                            <Popover.Trigger asChild>
                              <button className="flex items-center gap-1 cursor-help text-secondary"
                              onClick={(e) => e.stopPropagation()}
                              ><Zap size={12} /></button>
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content
                                sideOffset={5}
                                className="tooltip-content !font-mono z-50"
                                onOpenAutoFocus={(e: Event) => e.preventDefault()}
                              >
                                <Popover.Arrow className="tooltip-arrow" width={11} height={5} />
                                <span>Power hook-ups available on request</span>
                              </Popover.Content>
                            </Popover.Portal>
                          </Popover.Root>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div className="text-primary font-medium font-mono">
                        {/* Check if weeklyPrice (from prop) is null or 0, handle 0.01 specifically */}
                        {weeklyPrice === null || weeklyPrice === 0 ? (
                          <span className="text-accent-primary text-xl font-lettra-bold font-mono">{formatPrice(weeklyPrice, isTestAccommodation)}</span>
                        ) : (
                          <span className="text-xl font-lettra-bold text-accent-primary">
                            €{formatPrice(weeklyPrice, isTestAccommodation)}
                            <span className="text-xl text-secondary font-lettra-bold"></span>
                          </span>
                        )}
                      </div>
                      
                      {/* Ensure weeklyPrice is not null for discount display, and check hasAnyDiscount flag */}
                      {weeklyPrice !== null && weeklyPrice > 0 && hasAnyDiscount && (
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button className="text-accent-primary flex items-center gap-0.5 cursor-help"
                            onClick={(e) => e.stopPropagation()}
                            >
                              <Percent size={14} />
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              sideOffset={5}
                              className="tooltip-content tooltip-content--accent !font-mono z-50"
                              onOpenAutoFocus={(e: Event) => e.preventDefault()}
                            >
                              <Popover.Arrow className="tooltip-arrow tooltip-arrow--accent" width={11} height={5} />
                              <h4 className="font-medium font-mono mb-2">Weekly Rate Breakdown</h4>
                              <div className="text-sm space-y-2">
                                 {/* Base Price */}
                                 <div className="flex justify-between items-center color-shade-2">
                                    <span>Base Rate:</span>
                                    <span>€{Math.round(acc.base_price)} / week</span>
                                 </div>
                                
                                {/* Seasonal Discount - Use avgSeasonalDiscount from prop, ensure not null */}
                                {hasSeasonalDiscount && avgSeasonalDiscountForTooltip !== null && ( // Added null check here
                                  <div className="flex justify-between items-center">
                                    <span className="color-shade-2">Seasonal Discount:</span>
                                    <span className="text-accent-primary font-medium">
                                      -{Math.round(avgSeasonalDiscountForTooltip * 100)}%
                                    </span>
                                  </div>
                                )}
                                
                                {/* Duration Discount - Use Math.round, check hasDurationDiscount */}
                                {hasDurationDiscount && ( // Check flag
                                  <div className="flex justify-between items-center">
                                    <span className="color-shade-2">Duration Discount ({completeWeeksForDiscount} wks):</span>
                                    <span className="text-accent-primary font-medium">
                                    -{Math.round(currentDurationDiscount * 100)}%
                                    </span>
                                  </div>
                                )}

                                {/* Separator */}
                                 <div className="border-t border-gray-600 my-1"></div>

                                 {/* Final Weekly Price - Use weeklyPrice from prop, ensure not null */}
                                 <div className="flex justify-between items-center font-medium text-base">
                                    <span>Final Weekly Rate:</span>
                                    {/* Ensure weeklyPrice is not null before rounding */}
                                    <span>€{formatPrice(weeklyPrice, isTestAccommodation)}</span>
                                 </div>
                              </div>
                               <p className="text-xs color-shade-3 mt-2 font-mono">Discounts applied multiplicatively.</p>
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      )}
                    </div>
                  </div>

                  {/* NEW: Dedicated Border Element for Selected State */}
                  {isSelected && (
                    <div className="absolute inset-0 z-10 rounded-sm border-2 border-accent-primary pointer-events-none"></div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}