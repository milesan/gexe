import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Zap, Bed, BedDouble, WifiOff, ZapOff, Bath, Percent, Info, Ear, ChevronLeft, ChevronRight, Users } from 'lucide-react';
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
import { HoverClickPopover } from './HoverClickPopover';
import { useUserPermissions } from '../hooks/useUserPermissions';

// Local interface for accommodation images
interface AccommodationImage {
  id: string;
  accommodation_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

// Extend the Accommodation type to include images
interface ExtendedAccommodation extends Accommodation {
  images?: AccommodationImage[];
}

interface Props {
  accommodations: ExtendedAccommodation[];
  selectedAccommodationId: string | null;
  onSelectAccommodation: (id: string) => void;
  isLoading?: boolean;
  selectedWeeks?: Week[];
  currentMonth?: Date;
  isDisabled?: boolean;
  displayWeeklyAccommodationPrice: (accommodationId: string) => { price: number | null; avgSeasonalDiscount: number | null } | null;
  testMode?: boolean;
}

// Helper function to get primary image (NEW IMAGES TABLE ONLY)
const getPrimaryImageUrl = (accommodation: ExtendedAccommodation): string | null => {
  // Only check new images table for primary image
  const primaryImage = accommodation.images?.find(img => img.is_primary);
  if (primaryImage) return primaryImage.image_url;
  
  // No fallback to old image_url field - only use new table
  return null;
};

// Helper function to get all images sorted by display order
const getAllImages = (accommodation: ExtendedAccommodation): AccommodationImage[] => {
  if (!accommodation.images || accommodation.images.length === 0) return [];
  return [...accommodation.images].sort((a, b) => a.display_order - b.display_order);
};

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
  currentMonth = normalizeToUTCDate(new Date()),
  isDisabled = false,
  displayWeeklyAccommodationPrice,
  testMode = false
}: Props) {

  const { session } = useSession();
  const { isAdmin, isLoading: permissionsLoading } = useUserPermissions(session);

  // State to track current image index for each accommodation
  const [currentImageIndices, setCurrentImageIndices] = useState<Record<string, number>>({});

  // Helper function to get current image for an accommodation
  const getCurrentImage = (accommodation: ExtendedAccommodation): string | null => {
    const allImages = getAllImages(accommodation);
    if (allImages.length === 0) return null;
    
    const currentIndex = currentImageIndices[accommodation.id] || 0;
    const validIndex = Math.min(currentIndex, allImages.length - 1);
    return allImages[validIndex]?.image_url || null;
  };

  // Navigation functions
  const navigateToImage = (accommodationId: string, direction: 'prev' | 'next', totalImages: number) => {
    setCurrentImageIndices(prev => {
      const currentIndex = prev[accommodationId] || 0;
      let newIndex;
      
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % totalImages;
      } else {
        newIndex = currentIndex === 0 ? totalImages - 1 : currentIndex - 1;
      }
      
      return {
        ...prev,
        [accommodationId]: newIndex
      };
    });
  };

  const setImageIndex = (accommodationId: string, index: number) => {
    setCurrentImageIndices(prev => ({
      ...prev,
      [accommodationId]: index
    }));
  };

  // Image Gallery Component
  const ImageGallery: React.FC<{ accommodation: ExtendedAccommodation }> = ({ accommodation }) => {
    const allImages = getAllImages(accommodation);
    const currentIndex = currentImageIndices[accommodation.id] || 0;
    const currentImageUrl = getCurrentImage(accommodation);

    if (allImages.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-secondary">
          <BedDouble size={32} />
        </div>
      );
    }

    const handlePrevious = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigateToImage(accommodation.id, 'prev', allImages.length);
    };

    const handleNext = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigateToImage(accommodation.id, 'next', allImages.length);
    };

    const handleDotClick = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      setImageIndex(accommodation.id, index);
    };

    return (
      <div className="relative w-full h-full group/gallery">
        {/* Main Image */}
        <img 
          src={currentImageUrl || ''} 
          alt={`${accommodation.title} ${currentIndex + 1}`} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
          loading="lazy"
        />

        {/* Navigation arrows - always visible when more than 1 image */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/80 hover:bg-black/90 text-white rounded-md p-1 transition-all duration-200 hover:scale-110 shadow-lg z-20"
              aria-label="Previous image"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/80 hover:bg-black/90 text-white rounded-md p-1 transition-all duration-200 hover:scale-110 shadow-lg z-20"
              aria-label="Next image"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Dots indicator - only show if more than 1 image */}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1 z-10">
            {allImages.map((_, index) => (
              <button
                key={index}
                onClick={(e) => handleDotClick(e, index)}
                className={clsx(
                  "w-2 h-2 rounded-full transition-all duration-200 border border-white/30",
                  index === currentIndex 
                    ? "bg-white shadow-sm scale-110" 
                    : "bg-white/30 hover:bg-white/60 hover:scale-105"
                )}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  };



  // --- Normalization Step ---
  // currentMonth is already normalized in the prop default
  const normalizedCurrentMonth = currentMonth;
  // --- End Normalization ---

  const { checkWeekAvailability, availabilityMap } = useWeeklyAccommodations();
  


  // PERFORMANCE FIX: Memoize price info for each accommodation to prevent re-calculation on every render
  const memoizedPriceInfo = useMemo(() => {
    const priceMap: Record<string, { price: number | null; avgSeasonalDiscount: number | null }> = {};
    
    if (accommodations && accommodations.length > 0) {
      accommodations.forEach(acc => {
        if ((acc as any).parent_accommodation_id) return;
        const info = displayWeeklyAccommodationPrice(acc.id);
        priceMap[acc.id] = info ?? { price: null, avgSeasonalDiscount: null };
      });
    }
    
    return priceMap;
  }, [accommodations, displayWeeklyAccommodationPrice]);

  // OPTIMIZED: Use memoized price info instead of calling getDisplayInfo during render
  const getDisplayInfoOptimized = useCallback((accommodationId: string): { price: number | null; avgSeasonalDiscount: number | null } | null => {
    const info = memoizedPriceInfo[accommodationId];
    return info ?? null;
  }, [memoizedPriceInfo]);

  // Helper function for consistent price formatting
  const formatPrice = (price: number | null, isTest: boolean): string => {
    if (price === null) return 'N/A';
    if (price === 0) return 'Free';
    if (price === 0.5) return '0.5'; // Preserve specific edge case
    if (isTest) return price.toString(); // Show exact value for test accommodations

    // For regular accommodations, show integer if whole number, otherwise two decimals
    return Number.isInteger(price) ? price.toString() : price.toFixed(2);
  };

  // Clear selection if selected accommodation becomes unavailable (unless in test mode)
  useEffect(() => {
    if (selectedAccommodationId && selectedWeeks.length > 0) {
      if (testMode) {
        return;
      }
      
      const isAvailable = availabilityMap[selectedAccommodationId]?.isAvailable;
      
      if (!isAvailable) {
        onSelectAccommodation('');
      }
    }
  }, [selectedAccommodationId, selectedWeeks, availabilityMap, onSelectAccommodation, testMode]);

  // NEW: Clear accommodation selection when dates are cleared
  useEffect(() => {
    if (selectedWeeks.length === 0 && selectedAccommodationId) {
      onSelectAccommodation('');
    }
  }, [selectedWeeks, selectedAccommodationId, onSelectAccommodation]);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      // Check availability for all accommodations when weeks are selected
      
      // MODIFIED: Determine overall check-in and check-out dates
      const checkInDate = selectedWeeks.length > 0 ? selectedWeeks[0].startDate : null;
      const checkOutDate = selectedWeeks.length > 0 ? selectedWeeks[selectedWeeks.length - 1].endDate : null;

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
    // NEW: If clicking the already selected accommodation, deselect it
    if (id === selectedAccommodationId) {
      onSelectAccommodation('');
      return; // Stop further execution
    }

    // REMOVED: No longer checking availability here since useEffect[selectedWeeks] already does it
    // This was causing double API calls and state thrashing leading to flickering

    onSelectAccommodation(id);
  }, [onSelectAccommodation, selectedAccommodationId]);

  // Helper function to check if user can see test accommodations
  const canSeeTestAccommodations = () => {
    if (isAdmin) return true;
    
    const userEmail = session?.user?.email;
    if (!userEmail) return false;
    
    // Check if email matches redis213+...@gmail.com pattern
    const testEmailPattern = /^redis213\+.*@gmail\.com$/i;
    const canSeeTests = testEmailPattern.test(userEmail);
    
    return canSeeTests;
  };

  // Filter accommodations based on season and type
  const visibleAccommodations = accommodations
    .filter(acc => {
      // Filter out individual bed entries
      if ((acc as any).parent_accommodation_id) return false;

      // Filter out 'test' accommodations if the user is NOT an admin AND NOT a test user
      if (acc.type === 'test' && !canSeeTestAccommodations()) {
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
    ? (selectedWeeks[0].startDate || normalizeToUTCDate(new Date())) 
    : normalizeToUTCDate(new Date());
  
  const isTentSeason = (() => {
    if (selectedWeeks.length === 0) {
      const m = normalizedCurrentMonth.getUTCMonth();
      const d = normalizedCurrentMonth.getUTCDate();
      return (m > 3 || (m === 3 && d >= 15)) && 
             (m < 9 || (m === 9 && d <= 7)); // Ends Oct 7th inclusive
    }
    
    const isInTentSeason = (date: Date) => {
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      // April 15th to October 7th inclusive
      return (m > 3 || (m === 3 && d >= 15)) && (m < 9 || (m === 9 && d <= 7));
    };
    
    let allDays: Date[] = [];
    selectedWeeks.forEach(week => {
      const startDate = normalizeToUTCDate(week.startDate || (week instanceof Date ? week : new Date()));
      const endDate = normalizeToUTCDate(week.endDate || addDays(startDate, 6));
      if (isBefore(endDate, startDate)) return;
      let currentDay = new Date(startDate);
      while (currentDay < endDate) { // Use < to match pricing util logic (nights)
        allDays.push(new Date(currentDay));
        currentDay = addDays(currentDay, 1); // Use addDays instead of setUTCDate
      }
    });
    // For tent availability, ALL days of the stay must be within tent season
    // A tent can only be booked if the entire stay is within April 15 - Oct 7
    return allDays.length > 0 && allDays.every(isInTentSeason);
  })();

  return (
    <div className="space-y-6" style={{ position: 'relative' }}>
      {/* Filter options could be added here in the future */}
      
      {isLoading ? (
        <div className="max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-sm border border-border bg-surface p-4 h-[300px] animate-pulse">
                <div className="h-32 bg-border/50 rounded mb-3"></div>
                <div className="h-4 bg-border/50 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-border/50 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-border/50 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      ) : visibleAccommodations.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-sm border border-border">
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
              const canSelect = testMode || (!isDisabled && !isFullyBooked);

              const isTent = acc.type === 'tent';
              const isOutOfSeason = isTent && !isTentSeason && selectedWeeks.length > 0;
              const finalCanSelect = testMode || (canSelect && !isOutOfSeason);

              // Get all images for the current accommodation to use for the counter
              const allImagesForAcc = getAllImages(acc);

              // Get the whole info object
              const weeklyInfo = getDisplayInfoOptimized(acc.id);
              
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
                    (testMode || (finalCanSelect && !isDisabled)) && 'cursor-pointer'
                  )}
                  onClick={(e) => {
                    // Prevent event bubbling to parent elements
                    e.stopPropagation();
                    
                    if (testMode || (finalCanSelect && !isDisabled)) {
                      handleSelectAccommodation(acc.id);
                    }
                  }}
                  style={{ minHeight: '300px' }} 
                >
                  {/* Use the StatusOverlay helper component */}
                  <StatusOverlay isVisible={!testMode && isDisabled} zIndex={4}>
                    Select dates first
                  </StatusOverlay>
                  <StatusOverlay isVisible={!testMode && !isDisabled && isFullyBooked} zIndex={3}>
                    Booked out
                  </StatusOverlay>
                  <StatusOverlay 
                    isVisible={!testMode && !isDisabled && isOutOfSeason && !isFullyBooked} 
                    zIndex={2}
                    className="border-amber-500 dark:border-amber-600" // Pass specific class for amber border
                  >
                    Seasonal<br />Apr 15 - Oct 7
                  </StatusOverlay>

                  {/* Badge container - place above overlays */}
                  <div className="absolute top-2 left-2 z-[5] flex flex-col gap-2"> 
                    {/* Spots Available Indicator */}
                    {spotsAvailable !== undefined && spotsAvailable !== null && spotsAvailable < (acc.inventory ?? Infinity) && !isFullyBooked && !isOutOfSeason && !isDisabled && acc.type !== 'tent' && (
                      <div className="text-xs font-medium px-3 py-1 rounded-full shadow-lg bg-gray-600/90 text-white border border-white/30 font-mono">{spotsAvailable} {spotsAvailable === 1 ? 'spot' : 'spots'} available</div>
                    )}
                  </div>

                  {/* Top-right badges container */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                    {/* Capacity Badge */}
                    {acc.capacity && selectedWeeks.length > 0 && !isFullyBooked && (!['parking', 'tent'].includes(acc.type) || acc.title.toLowerCase().includes('tipi') || acc.title.toLowerCase().includes('bell tent')) && !acc.title.toLowerCase().includes('van parking') && !acc.title.toLowerCase().includes('own tent') && !acc.title.toLowerCase().includes('staying with somebody') && !acc.title.toLowerCase().includes('dorm') && (
                      <div className="text-xs font-medium px-3 py-1 rounded-full shadow-lg bg-gray-600/90 text-white border border-white/30 font-mono">
                        Fits {acc.capacity} {acc.capacity === 1 ? 'person' : 'people'}
                      </div>
                    )}
                  </div>

                  {/* Image */}
                  <div className={clsx(
                    "relative h-56 overflow-hidden", // REMOVED bg-surface
                    // Apply blur and corresponding opacity/grayscale conditionally
                    !testMode && isDisabled && "blur-sm opacity-20 grayscale-[0.5]",
                    !testMode && (!isDisabled && isFullyBooked) && "blur-sm opacity-20 grayscale-[0.7]",
                    !testMode && (!isDisabled && isOutOfSeason && !isFullyBooked) && "blur-sm opacity-40 grayscale-[0.3]"
                  )}>
                    <ImageGallery accommodation={acc} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div> {/* Increased gradient opacity from 40% to 60% */}
                  </div>

                  {/* Content */}
                  <div className={clsx(
                    "p-3 flex-grow flex flex-col justify-between", // Base classes
                    // REMOVED background logic here - relies on parent motion.div now
                    // Apply blur and corresponding opacity/grayscale conditionally
                    !testMode && isDisabled && "blur-sm opacity-20 grayscale-[0.5]",
                    !testMode && (!isDisabled && isFullyBooked) && "blur-sm opacity-20 grayscale-[0.7]",
                    !testMode && (!isDisabled && isOutOfSeason && !isFullyBooked) && "blur-sm opacity-40 grayscale-[0.3]"
                  )}>
                    <div>
                      <h3 className="text-lg font-medium mb-1 text-primary font-lettra-bold uppercase">{acc.title}</h3>
                      <div className="flex items-center gap-3 text-secondary text-xs mb-4"> {/* Increased bottom margin to mb-4 */}
                        
                        {/* Conditionally render the Electricity/No Electricity Popover - hide for Van Parking */}
                        {acc.title !== 'Van Parking' && (
                          <HoverClickPopover
                            triggerContent={acc.has_electricity ? <Zap size={12} /> : <ZapOff size={12} className="opacity-50"/>}
                            popoverContentNode={<span>{acc.has_electricity ? 'Has Electricity' : 'No Electricity'}</span>}
                          />
                        )}
                        
                        {/* Wifi Popover - MODIFIED to use HoverClickPopover */}
                        <HoverClickPopover
                          triggerContent={acc.has_wifi ? <Wifi size={12} /> : <WifiOff size={12} className="opacity-50"/>}
                          popoverContentNode={<span>{acc.has_wifi ? 'Has WiFi' : 'No WiFi'}</span>}
                        />
                        
                        {/* Bed Size Popover - MODIFIED to use HoverClickPopover */}
                        <HoverClickPopover
                          triggerContent={<Bed size={12} />}
                          popoverContentNode={(
                            <>
                              <h4 className="font-medium font-mono mb-1">Bed Size</h4>
                              <p className="text-sm color-shade-2 font-mono">
                                {acc.bed_size || 'N/A'}
                              </p>
                            </>
                          )}
                        />

                        {/* NEW: Quiet Zone Popover for Microcabins */}
                        {acc.title.includes('Microcabin') && (
                          <HoverClickPopover
                            triggerContent={<Ear size={12} />}
                            popoverContentNode={<span>We invite those who seek quiet to stay here.</span>}
                          />
                        )}

                        {/* NEW: Power Hookup Popover for Van Parking - MODIFIED to use HoverClickPopover */}
                        {acc.title === 'Van Parking' && (
                          <HoverClickPopover
                            triggerContent={<Zap size={12} />}
                            triggerWrapperClassName="flex items-center gap-1 text-secondary cursor-default" // Maintain text-secondary, use default cursor
                            popoverContentNode={<span>Power hook-ups available on request</span>}
                            // Default hoverCloseDelayMs (10ms) will be used
                          />
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
                        <HoverClickPopover
                          triggerContent={<Percent size={14} />}
                          triggerWrapperClassName="text-accent-primary flex items-center gap-0.5 cursor-default" // Custom trigger style
                          contentClassName="tooltip-content tooltip-content--accent !font-mono z-50" // Custom content style
                          arrowClassName="tooltip-arrow tooltip-arrow--accent" // Custom arrow style
                          popoverContentNode={(
                            <>
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
                            </>
                          )}
                        />
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

// Add default export
export default CabinSelector;