import React from 'react';
import { format, parseISO, isAfter, isBefore, addMonths } from 'date-fns';
import { calculateTotalWeeksDecimal, formatDateForDisplay, normalizeToUTCDate, calculateTotalNights, calculateDurationDiscountWeeks, isWeekSelectable, calculateDisplayWeeks, formatWeeksForDisplay, calculateAndFormatDisplayWeeks, calculateTotalDays } from '../utils/dates';
import { getSeasonBreakdown, getDurationDiscount, calculateWeeklyAccommodationPrice } from '../utils/pricing';
import { bookingService } from '../services/BookingService';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, X, Info, Tag } from 'lucide-react';
import { useSession } from '../hooks/useSession';
import type { Booking, Accommodation } from '../types';
import type { AppliedDiscount } from './BookingSummary/BookingSummary.types';
import type { Week } from '../types/calendar';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { WeekSelector } from './WeekSelector';
import { useCalendar } from '../hooks/useCalendar';
import { createPortal } from 'react-dom';

import { StripeCheckoutForm } from './StripeCheckoutForm';
import { DiscountCodeSection } from './BookingSummary/components/DiscountCodeSection';
import { DiscountModal } from './DiscountModal';
import { supabase } from '../lib/supabase';
import * as Tooltip from '@radix-ui/react-tooltip';
import { calculateBaseFoodCost, calculateFoodContributionRange } from './BookingSummary/BookingSummary.utils';
import { useDiscountCode } from '../hooks/useDiscountCode';
import { OptimizedSlider } from './shared/OptimizedSlider';
import { useCredits } from '../hooks/useCredits';
import { CreditsSection } from './BookingSummary/components/CreditsSection';
import { formatPriceDisplay } from './BookingSummary/BookingSummary.utils';

export function MyBookings() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = React.useState<string | null>(null);
  const [extendingBooking, setExtendingBooking] = React.useState<Booking | null>(null);
  const [extensionWeeks, setExtensionWeeks] = React.useState<any[]>([]);
  const [originalCheckIn, setOriginalCheckIn] = React.useState<Date | null>(null);
  const [originalCheckOut, setOriginalCheckOut] = React.useState<Date | null>(null);

  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [showDiscountModal, setShowDiscountModal] = React.useState(false);
  const [authToken, setAuthToken] = React.useState('');
  const [foodContribution, setFoodContribution] = React.useState<number | null>(null);
  const [displayFoodContribution, setDisplayFoodContribution] = React.useState<number | null>(null);
  const isDraggingSliderRef = React.useRef(false);
  const [showCustomWeeks, setShowCustomWeeks] = React.useState(false);
  const [extensionError, setExtensionError] = React.useState<string | null>(null);
  const MAX_WEEKS_ALLOWED = 12;
  const session = useSession();
  useWeeklyAccommodations();

  // Credits functionality for extensions
  const { credits: availableCredits, loading: creditsLoading, refresh: refreshCredits } = useCredits();
  const [creditsEnabled, setCreditsEnabled] = React.useState(false);
  const [creditsToUse, setCreditsToUse] = React.useState(0);

  // Discount code functionality for extensions
  const {
    discountCodeInput,
    setDiscountCodeInput,
    appliedDiscount,
    discountError,
    isApplyingDiscount,
    handleApplyDiscount,
    handleRemoveDiscount
  } = useDiscountCode();

  // Credits functionality for extensions - allows users to use their available credits
  // to reduce the amount they need to pay for their booking extension

  const checkIn = extendingBooking
    ? typeof extendingBooking.check_in === 'string'
      ? parseISO(extendingBooking.check_in)
      : extendingBooking.check_in
    : new Date();
  const checkOut = extendingBooking
    ? typeof extendingBooking.check_out === 'string'
      ? parseISO(extendingBooking.check_out)
      : extendingBooking.check_out
    : new Date();
  const calendar = useCalendar({
    startDate: checkIn,
    endDate: addMonths(checkOut, 6),
    isAdminMode: false
  });
  const extensionWeeksData = calendar.weeks;
  const extensionWeeksLoading = calendar.isLoading;

  React.useEffect(() => {
    loadBookings();
  }, []);

  // Get auth token for payment
  React.useEffect(() => {
    supabase.auth.getSession().then(res => {
      const token = res?.data?.session?.access_token;
      if (token) {
        setAuthToken(token);
      }
    });
  }, []);



  React.useEffect(() => {
    if (extendingBooking) {
      const checkIn = typeof extendingBooking.check_in === 'string' ? parseISO(extendingBooking.check_in) : extendingBooking.check_in;
      const checkOut = typeof extendingBooking.check_out === 'string' ? parseISO(extendingBooking.check_out) : extendingBooking.check_out;
      setOriginalCheckIn(checkIn);
      setOriginalCheckOut(checkOut);
      setExtensionWeeks([{ startDate: checkIn, endDate: checkOut }]);
    }
  }, [extendingBooking]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await bookingService.getUserBookings();
      console.log('[DEBUG] Raw booking data:', data);
      setBookings(data || []);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleExtensionWeekSelect = (week: any) => {
    if (!originalCheckOut) return;
    if (isAfter(week.startDate, originalCheckOut)) {
      setExtensionWeeks(prev => {
        if (!prev.some(w => w.startDate.getTime() === week.startDate.getTime())) {
          return [...prev, week].sort((a, b) => a.startDate - b.startDate);
        }
        return prev;
      });
    }
  };

  const handleExtensionWeeksDeselect = (weeksToDeselect: any[]) => {
    if (!originalCheckOut) return;
    setExtensionWeeks(prev => prev.filter(w => isBefore(w.startDate, originalCheckOut) || !weeksToDeselect.some(d => d.startDate.getTime() === w.startDate.getTime())));
  };

  const extensionOnlyWeeks = React.useMemo(() => {
    if (!originalCheckOut) return [];
    return extensionWeeks.filter(w => isAfter(w.startDate, originalCheckOut));
  }, [extensionWeeks, originalCheckOut]);





  // Helper to get the original booking's weeks - reconstruct directly from booking dates
  const getOriginalWeeks = () => {
    console.log('[DEBUG] getOriginalWeeks called - extendingBooking:', extendingBooking);
    if (!extendingBooking) {
      console.log('[DEBUG] getOriginalWeeks - no extendingBooking, returning empty array');
      return [];
    }
    
    const checkIn = typeof extendingBooking.check_in === 'string' ? normalizeToUTCDate(extendingBooking.check_in) : extendingBooking.check_in;
    const checkOut = typeof extendingBooking.check_out === 'string' ? normalizeToUTCDate(extendingBooking.check_out) : extendingBooking.check_out;
    
    console.log('[DEBUG] getOriginalWeeks - checkIn:', checkIn, 'checkOut:', checkOut);
    
    // Calculate original weeks directly from booking dates instead of relying on calendar data
    // This ensures we get the correct count even if the original booking is in the past
    const tempWeek = { startDate: checkIn, endDate: checkOut, status: 'default' as const };
    const totalNights = calculateTotalNights([tempWeek]);
    const originalWeeksDecimal = totalNights / 7;
    const originalWeeksCount = Math.ceil(originalWeeksDecimal); // Use ceil for pricing calculations to ensure we don't undercharge
    
    // Create mock week objects for duration discount calculation
    // We only need the count and date range for pricing calculations
    const originalWeeks: Week[] = [];
    for (let i = 0; i < originalWeeksCount; i++) {
      const weekStart = new Date(checkIn.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));
      originalWeeks.push({
        id: `original-week-${i}`,
        startDate: weekStart,
        endDate: weekEnd > checkOut ? checkOut : weekEnd,
        status: 'default' as const
      });
    }
    
    console.log('[DEBUG] getOriginalWeeks - calculation details:', {
      checkIn: formatDateForDisplay(checkIn),
      checkOut: formatDateForDisplay(checkOut),
      totalNights,
      originalWeeksDecimal: originalWeeksDecimal.toFixed(2),
      originalWeeksCount: originalWeeksCount,
      calculationMethod: 'Math.ceil(totalNights / 7) for pricing, but display shows decimal'
    });
    console.log('[DEBUG] getOriginalWeeks - reconstructed weeks:', {
      weekCount: originalWeeks.length,
      weeks: originalWeeks.map(w => ({
        id: w.id,
        startDate: formatDateForDisplay(w.startDate),
        endDate: formatDateForDisplay(w.endDate)
      }))
    });
    
    return originalWeeks;
  };
  const originalWeeks = getOriginalWeeks();

  // Helper function to calculate actual decimal weeks for display
  const getActualWeeks = (startDate: Date, endDate: Date) => {
    console.log('[getActualWeeks] === DEBUGGING WEEK CALCULATION ===');
    console.log('[getActualWeeks] Input dates:', {
      startDate: startDate.toISOString(),
      startDateLocal: startDate.toString(),
      endDate: endDate.toISOString(), 
      endDateLocal: endDate.toString()
    });
    
    // OLD METHOD: Manual calculation using days
    const tempWeek = { startDate, endDate, status: 'default' as const };
    const totalDays = calculateTotalDays([tempWeek]);
    const weeksDecimal = totalDays / 7;
    
    console.log('[getActualWeeks] OLD METHOD - Calculation breakdown:', {
      totalDays,
      weeksDecimal,
      weeksDecimalRounded: Math.round(weeksDecimal * 10) / 10,
      manualDaysCheck: Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      timeDiffMs: endDate.getTime() - startDate.getTime(),
      msPerDay: 1000 * 60 * 60 * 24
    });
    
    // NEW METHOD: Using helper function with business logic
    const displayWeeks = calculateDisplayWeeks(startDate, endDate);
    
    console.log('[getActualWeeks] NEW METHOD - Using calculateDisplayWeeks:', {
      displayWeeks,
      oldMethod: weeksDecimal,
      difference: displayWeeks - weeksDecimal,
      usingNewMethod: true
    });
    
    // Let's also manually verify the date range
    console.log('[getActualWeeks] Manual date verification:', {
      startDateFormatted: formatDateForDisplay(startDate),
      endDateFormatted: formatDateForDisplay(endDate),
      startDateUTCComponents: {
        year: startDate.getUTCFullYear(),
        month: startDate.getUTCMonth() + 1, // +1 for human readable
        day: startDate.getUTCDate()
      },
      endDateUTCComponents: {
        year: endDate.getUTCFullYear(), 
        month: endDate.getUTCMonth() + 1, // +1 for human readable
        day: endDate.getUTCDate()
      }
    });
    
    return displayWeeks; // Use the new method with business logic
  };

  // Calculate actual decimal weeks for display
  const originalWeeksDecimal = extendingBooking 
    ? (() => {
        console.log('[originalWeeksDecimal] === BOOKING DATE PARSING DEBUG ===');
        console.log('[originalWeeksDecimal] Raw booking data:', {
          check_in_raw: extendingBooking.check_in,
          check_in_type: typeof extendingBooking.check_in,
          check_out_raw: extendingBooking.check_out,
          check_out_type: typeof extendingBooking.check_out
        });
        
        const checkInDate = typeof extendingBooking.check_in === 'string' 
          ? normalizeToUTCDate(extendingBooking.check_in) 
          : extendingBooking.check_in;
        const checkOutDate = typeof extendingBooking.check_out === 'string' 
          ? normalizeToUTCDate(extendingBooking.check_out) 
          : extendingBooking.check_out;
          
        console.log('[originalWeeksDecimal] Parsed dates:', {
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          checkInFormatted: formatDateForDisplay(checkInDate),
          checkOutFormatted: formatDateForDisplay(checkOutDate)
        });
        
        return getActualWeeks(checkInDate, checkOutDate);
      })()
    : 0;

  const totalWeeksDecimal = originalWeeksDecimal + extensionOnlyWeeks.length;

  console.log('[DEBUG] originalWeeks length:', originalWeeks.length);
  console.log('[DEBUG] originalWeeks IDs:', originalWeeks.map(w => w.id));
  console.log('[DEBUG] Display weeks - original:', originalWeeksDecimal.toFixed(2), 'total:', totalWeeksDecimal.toFixed(2));

  // Calculate food contribution range with duration discount for slider
  const foodContributionRange = React.useMemo(() => {
    if (extensionOnlyWeeks.length === 0) return null;
    
    const extensionNights = calculateTotalNights(extensionOnlyWeeks);
    const totalStayWeeks = [...originalWeeks, ...extensionOnlyWeeks];
    const completeWeeksForDiscount = calculateDurationDiscountWeeks(totalStayWeeks);
    const durationDiscountPercent = getDurationDiscount(completeWeeksForDiscount);
    
    return calculateFoodContributionRange(extensionNights, durationDiscountPercent);
  }, [extensionOnlyWeeks, originalWeeks]);
  
  // Handle display value changes during drag
  const handleDisplayValueChange = React.useCallback((value: number) => {
    isDraggingSliderRef.current = true;
    // Ensure value is within bounds
    if (foodContributionRange) {
      const clampedValue = Math.max(foodContributionRange.min, Math.min(foodContributionRange.max, value));
      setDisplayFoodContribution(clampedValue);
    } else {
      setDisplayFoodContribution(value);
    }
    
    // Reset dragging flag shortly after (but don't reset display value)
    setTimeout(() => {
      isDraggingSliderRef.current = false;
    }, 200);
  }, [foodContributionRange]);

  // Initialize food contribution for extension using duration discount from TOTAL stay
  React.useEffect(() => {
    if (foodContributionRange) {
      // Only set to default if not already set or if current value is outside the valid range
      setFoodContribution(current => {
        const newValue = current === null || current < foodContributionRange.min || current > foodContributionRange.max
          ? foodContributionRange.defaultValue
          : current;
          
        if (newValue !== current) {
          console.log('[EXTENSION_PRICING] Food contribution reset to default:', {
            previousValue: current,
            newValue,
            reason: current === null ? 'not set' : 'outside range',
            validRange: `${foodContributionRange.min}-${foodContributionRange.max}`
          });
          // Also update display value (only if not dragging)
          if (!isDraggingSliderRef.current) {
            setDisplayFoodContribution(newValue);
        }
        } else {
        console.log('[EXTENSION_PRICING] Keeping existing food contribution:', current);
          // Sync display value (only if not dragging)
          if (!isDraggingSliderRef.current) {
            setDisplayFoodContribution(current);
          }
        }
        
        return newValue;
      });
    } else {
      setFoodContribution(null);
      setDisplayFoodContribution(null);
    }
  }, [foodContributionRange]);



  // Calculate extension pricing
  const extensionPricing = React.useMemo(() => {
    if (!extendingBooking || extensionOnlyWeeks.length === 0) {
      return {
        totalWeeks: 0,
        extensionWeeks: 0,
        totalNights: 0,
        extensionNights: 0,
        weeklyAccommodationRate: 0,
        totalPrice: 0,
        extensionPrice: 0,
        accommodationBasePrice: 0,
        extensionAccommodationPrice: 0,
        extensionFoodCost: 0,
        discountAmount: 0,
        finalExtensionPrice: 0,
        finalAmountAfterCredits: 0
      };
    }

    const totalWeeks = originalWeeks.length + extensionOnlyWeeks.length;
    const extensionWeeks = extensionOnlyWeeks.length;
    const totalNights = calculateTotalNights([...originalWeeks, ...extensionOnlyWeeks]);
    const extensionNights = calculateTotalNights(extensionOnlyWeeks);
    
    // Get the accommodation's base price from database
    const accommodationBasePrice = extendingBooking.accommodation?.base_price || 0;
    const accommodationTitle = extendingBooking.accommodation?.title || '';
    
    // Calculate proper accommodation pricing using the same logic as CabinSelector
    const extensionStartDate = extensionOnlyWeeks[0]?.startDate;
    const extensionEndDate = extensionOnlyWeeks[extensionOnlyWeeks.length - 1]?.endDate;
    
    if (!extensionStartDate || !extensionEndDate) {
      return {
        totalWeeks: 0,
        extensionWeeks: 0,
        totalNights: 0,
        extensionNights: 0,
        weeklyAccommodationRate: 0,
        totalPrice: 0,
        extensionPrice: 0,
        accommodationBasePrice: 0,
        extensionAccommodationPrice: 0,
        extensionFoodCost: 0,
        discountAmount: 0,
        finalExtensionPrice: 0
      };
    }
    
    // Calculate seasonal discount based on TOTAL stay (original + extension)
    // This ensures someone extending pays the same rate as someone booking the full period upfront
    // NOTE: The DiscountModal will separately calculate and show the breakdown for just the extension period
    // NOTE: For payment breakdown, we'll calculate seasonal discount for extension period only
    const totalStayStartDate = originalWeeks[0]?.startDate || extensionStartDate;
    const totalStayEndDate = extensionEndDate;
    
    const seasonBreakdown = getSeasonBreakdown(totalStayStartDate, totalStayEndDate);
    const averageSeasonalDiscount = seasonBreakdown.seasons.reduce((sum, season) => 
      sum + (season.discount * season.nights), 0) / 
      seasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
    
    // Round seasonal discount for consistency with BookingSummary
    const roundedAverageSeasonalDiscount = Math.round(averageSeasonalDiscount * 100) / 100;
    
    // CRITICAL FIX: Dorms don't get seasonal discounts
    const effectiveSeasonalDiscount = accommodationTitle.toLowerCase().includes('dorm') 
      ? 0 
      : roundedAverageSeasonalDiscount;
    
    // Calculate duration discount based on TOTAL stay (original + extension)
    const combinedWeeksForDiscount = [...originalWeeks, ...extensionOnlyWeeks];
    console.log('[EXTENSION_PRICING] Combined weeks array for discount calculation:', {
      originalCount: originalWeeks.length,
      extensionCount: extensionOnlyWeeks.length,
      combinedCount: combinedWeeksForDiscount.length,
      combinedWeeks: combinedWeeksForDiscount.map(w => ({
        id: w.id,
        start: formatDateForDisplay(w.startDate),
        end: formatDateForDisplay(w.endDate)
      }))
    });
    
    const totalNightsForDiscount = calculateTotalNights(combinedWeeksForDiscount);
    const completeWeeksForDiscount = calculateDurationDiscountWeeks(combinedWeeksForDiscount);
    
    console.log('[EXTENSION_PRICING] Duration discount calculation inputs:', {
      totalNightsForDiscount,
      completeWeeksForDiscount,
      calculationNote: 'completeWeeksForDiscount = calculateDurationDiscountWeeks(combinedWeeks)'
    });
    
    const durationDiscountPercent = getDurationDiscount(completeWeeksForDiscount);
    
    console.log('[EXTENSION_PRICING] Duration discount calculation result:', {
      inputWeeks: completeWeeksForDiscount,
      outputPercent: durationDiscountPercent,
      outputPercentFormatted: (durationDiscountPercent * 100).toFixed(1) + '%'
    });
    
    // Calculate weekly accommodation rate using same logic as CabinSelector
    const mockAccommodation = {
      base_price: accommodationBasePrice,
      title: accommodationTitle
    } as Accommodation;
    
    const weeklyAccommodationRate = calculateWeeklyAccommodationPrice(
      mockAccommodation,
      [...originalWeeks, ...extensionOnlyWeeks],
      effectiveSeasonalDiscount
    );
    
    // Calculate extension accommodation cost
    const extensionAccommodationPrice = weeklyAccommodationRate * extensionWeeks;
    
    // Calculate food and facilities cost for extension
    const { totalBaseFoodCost: extensionFoodCost } = calculateBaseFoodCost(
      extensionNights,
      extensionWeeks,
      foodContribution
    );
    
    // Calculate subtotal before discount codes
    const subtotalBeforeDiscount = extensionAccommodationPrice + extensionFoodCost;
    
            // Apply discount code if present
        let discountAmount = 0;
        if (appliedDiscount && subtotalBeforeDiscount > 0) {
          const discountPercentage = appliedDiscount.percentage_discount / 100; // Convert to decimal (0.5 for 50%)
          const appliesTo = appliedDiscount.applies_to || 'total';

          let amountToDiscountFrom = 0;
          
          if (appliesTo === 'accommodation') {
            amountToDiscountFrom = extensionAccommodationPrice;
          } else if (appliesTo === 'food_facilities') {
            amountToDiscountFrom = extensionFoodCost;
          } else { // 'total' or fallback
            amountToDiscountFrom = subtotalBeforeDiscount;
          }

          if (amountToDiscountFrom > 0) {
            discountAmount = parseFloat((amountToDiscountFrom * discountPercentage).toFixed(2));
          }

          console.log('[EXTENSION_PRICING] Discount code applied:', {
            code: appliedDiscount.code,
            percentage: appliedDiscount.percentage_discount,
            appliesTo,
            amountDiscountedFrom: amountToDiscountFrom,
            discountAmount
          });
        }
    
    // Calculate final extension price after discount (use precise discount amount)
    const finalExtensionPrice = Math.max(0, subtotalBeforeDiscount - discountAmount);
    
    // Calculate final amount after credits
    const finalAmountAfterCredits = Math.max(0, finalExtensionPrice - creditsToUse);

    console.log('[EXTENSION_PRICING] ===== DETAILED PRICING CALCULATION =====');
    console.log('[EXTENSION_PRICING] Original booking weeks:', {
      count: originalWeeks.length,
      weeks: originalWeeks.map(w => ({
        id: w.id,
        start: formatDateForDisplay(w.startDate),
        end: formatDateForDisplay(w.endDate)
      }))
    });
    console.log('[EXTENSION_PRICING] Extension weeks:', {
      count: extensionOnlyWeeks.length,
      weeks: extensionOnlyWeeks.map(w => ({
        id: w.id,
        start: formatDateForDisplay(w.startDate),
        end: formatDateForDisplay(w.endDate)
      }))
    });
    console.log('[EXTENSION_PRICING] Combined weeks for discount calculation:', {
      totalWeeksCount: originalWeeks.length + extensionOnlyWeeks.length,
      totalNightsForDiscount,
      completeWeeksForDiscount,
      durationDiscountPercent: (durationDiscountPercent * 100).toFixed(1) + '%',
      note: 'Both seasonal and duration discounts are calculated based on TOTAL stay (original + extension)'
    });
    console.log('[EXTENSION_PRICING] Accommodation pricing breakdown:', {
      accommodationBasePrice,
      accommodationTitle,
      totalStayPeriod: `${formatDateForDisplay(totalStayStartDate)} to ${formatDateForDisplay(totalStayEndDate)}`,
      calculatedSeasonalDiscount: (averageSeasonalDiscount * 100).toFixed(1) + '%',
      effectiveSeasonalDiscount: (effectiveSeasonalDiscount * 100).toFixed(1) + '%',
      isDorm: accommodationTitle.toLowerCase().includes('dorm'),
      weeklyAccommodationRate: `€${weeklyAccommodationRate} (base: €${accommodationBasePrice} * (1 - ${(effectiveSeasonalDiscount * 100).toFixed(1)}%) * (1 - ${(durationDiscountPercent * 100).toFixed(1)}%))`,
      extensionWeeks,
      extensionAccommodationPrice: `€${extensionAccommodationPrice} (€${weeklyAccommodationRate} * ${extensionWeeks})`
    });
    console.log('[EXTENSION_PRICING] Final pricing summary:', {
      extensionAccommodationPrice,
      extensionFoodCost,
      subtotalBeforeDiscount,
      discountAmount,
      finalExtensionPrice,
      creditsToUse,
      finalAmountAfterCredits
    });
    console.log('[EXTENSION_PRICING] ===== END CALCULATION =====');

    return {
      totalWeeks,
      extensionWeeks,
      totalNights,
      extensionNights,
      weeklyAccommodationRate,
      totalPrice: 0, // Not needed for extensions
      extensionPrice: subtotalBeforeDiscount, // Keep original for display
      accommodationBasePrice,
      extensionAccommodationPrice,
      extensionAccommodationOriginalPrice: accommodationBasePrice * extensionWeeks, // Original price before discounts - passed directly to avoid reverse calculations
      extensionFoodCost,
      discountAmount,
      finalExtensionPrice,
      finalAmountAfterCredits,
      averageSeasonalDiscount: effectiveSeasonalDiscount
    };
  }, [extendingBooking, originalWeeks, extensionOnlyWeeks, foodContribution, appliedDiscount, creditsToUse]);

  // Initialize credits to max available when extension pricing is calculated
  React.useEffect(() => {
    if (extendingBooking && extensionOnlyWeeks.length > 0 && !creditsLoading && availableCredits > 0) {
      const maxCreditsToUse = Math.min(availableCredits, extensionPricing.finalExtensionPrice);
      
      if (maxCreditsToUse > 0) {
        console.log('[EXTENSION_PRICING] Setting credits to max by default:', {
          availableCredits,
          finalExtensionPrice: extensionPricing.finalExtensionPrice,
          maxCreditsToUse
        });
        setCreditsEnabled(true);
        setCreditsToUse(maxCreditsToUse);
      }
    }
  }, [extendingBooking, extensionOnlyWeeks.length, availableCredits, creditsLoading, extensionPricing.finalExtensionPrice]);



  const handleExtensionPaymentSuccess = React.useCallback(async (paymentIntentId?: string) => {
    console.log('[EXTENSION_FLOW] === STEP 3: Extension payment success handler called ===');
    console.log('[EXTENSION_FLOW] Payment Intent ID:', paymentIntentId || 'N/A');
    console.log('[EXTENSION_FLOW] Extension payment details:', {
      paymentIntentId,
      creditsToUse,
      finalAmountAfterCredits: extensionPricing.finalAmountAfterCredits,
      originalExtensionPrice: extensionPricing.finalExtensionPrice,
      creditsEnabled,
      availableCredits,
      extendingBookingId: extendingBooking?.id,
      extensionWeeksCount: extensionOnlyWeeks.length
    });

    setIsProcessingPayment(true);
    
    try {
      if (!extendingBooking || extensionOnlyWeeks.length === 0) {
        throw new Error('Missing extension data');
      }

      // Calculate new check-out date
      const newCheckOut = extensionOnlyWeeks[extensionOnlyWeeks.length - 1].endDate;
      const formattedCheckOut = format(newCheckOut, 'yyyy-MM-dd');

      const extensionPayload = {
        bookingId: extendingBooking.id,
        newCheckOut: formattedCheckOut,
        extensionWeeks: extensionOnlyWeeks.length,
        extensionPrice: extensionPricing.finalExtensionPrice, // Full value for booking total
        paymentAmount: extensionPricing.finalAmountAfterCredits, // Amount paid after credits
        paymentIntentId: paymentIntentId || '',
        appliedDiscountCode: appliedDiscount?.code,
        discountCodePercent: appliedDiscount?.percentage_discount ? appliedDiscount.percentage_discount / 100 : undefined, // Store as decimal (0.5 for 50%)
        discountCodeAppliesTo: appliedDiscount?.applies_to,
        discountAmount: extensionPricing.discountAmount,
        discountCodeAmount: extensionPricing.discountAmount, // FIXED: Pass exact discount code amount
        accommodationPrice: extensionPricing.extensionAccommodationPrice,
        accommodationOriginalPrice: extensionPricing.extensionAccommodationOriginalPrice, // Original price before discounts - no more reverse calculations!
        foodContribution: extensionPricing.extensionFoodCost,
        creditsUsed: creditsToUse || 0, // NEW: Pass credits used
        seasonalDiscountPercent: (() => {
          // Calculate seasonal discount for EXTENSION PERIOD ONLY (for payment breakdown)
          if (extensionOnlyWeeks.length === 0) return 0;
          const extensionStartDate = extensionOnlyWeeks[0]?.startDate;
          const extensionEndDate = extensionOnlyWeeks[extensionOnlyWeeks.length - 1]?.endDate;
          if (!extensionStartDate || !extensionEndDate) return 0;
          
          // CRITICAL FIX: Dorms don't get seasonal discounts
          if (extendingBooking.accommodation?.title?.toLowerCase().includes('dorm')) {
            return 0;
          }
          
          const extensionSeasonBreakdown = getSeasonBreakdown(extensionStartDate, extensionEndDate);
          if (extensionSeasonBreakdown.seasons.length === 0) return 0;
          
          const extensionAvgDiscount = extensionSeasonBreakdown.seasons.reduce((sum, season) => 
            sum + (season.discount * season.nights), 0) / 
            extensionSeasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
          
          return extensionAvgDiscount; // Return as decimal (0.16 for 16%)
        })(),
        durationDiscountPercent: (() => {
          // Calculate duration discount for TOTAL STAY (original + extension) for payment breakdown
          const totalWeeksAfterExtension = originalWeeksDecimal + extensionOnlyWeeks.length;
          const durationDiscount = getDurationDiscount(totalWeeksAfterExtension);
          return durationDiscount; // Return as decimal (0.16 for 16%)
        })()
      };

      console.log('[EXTENSION_FLOW] === STEP 4: Calling BookingService.extendBooking ===');
      console.log('[EXTENSION_FLOW] EXTENSION PAYLOAD:', JSON.stringify(extensionPayload, null, 2));
      
      // Call the extension booking service
      const result = await bookingService.extendBooking(extensionPayload);
      
      console.log('[EXTENSION_FLOW] STEP 4 SUCCESS: BookingService.extendBooking completed');
      console.log('[EXTENSION_FLOW] Extension result:', result);

      console.log('[EXTENSION_FLOW] === STEP 5: Cleaning up extension UI state ===');
      setShowPaymentModal(false);
      setExtendingBooking(null);
      setExtensionWeeks([]);
      setShowCustomWeeks(false);
      setExtensionError(null);
      setCreditsEnabled(false);
      setCreditsToUse(0);
      handleRemoveDiscount();
      
      console.log('[EXTENSION_FLOW] === STEP 6: Refreshing bookings and credits data ===');
      await Promise.all([
        loadBookings(),
        refreshCredits()
      ]);
      
      console.log('[EXTENSION_FLOW] STEP 6 SUCCESS: Extension process completed successfully');
    } catch (err) {
      console.error('[EXTENSION_FLOW] === STEP 4 FAILED: Extension process failed ===');
      console.error('[EXTENSION_FLOW] Error details:', {
        error: err,
        creditsToUse,
        creditsEnabled,
        extensionPrice: extensionPricing.finalExtensionPrice,
        paymentAmount: extensionPricing.finalAmountAfterCredits
      });
      setExtensionError(err instanceof Error ? err.message : 'Extension failed');
      setShowPaymentModal(false);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [extendingBooking, originalWeeksDecimal, extensionOnlyWeeks, foodContribution, appliedDiscount, creditsToUse, extensionPricing, creditsEnabled, availableCredits, refreshCredits]);

  const handleConfirmExtension = () => {
    console.log('[EXTENSION_FLOW] === STEP 1: Extension confirm button clicked ===');
    if (extensionOnlyWeeks.length === 0) {
      console.warn('[EXTENSION_FLOW] STEP 1 FAILED: No weeks selected for extension');
      setExtensionError('Please select weeks to extend');
      return;
    }

    const finalAmountAfterCredits = extensionPricing.finalAmountAfterCredits || 0;
    
    console.log('[EXTENSION_FLOW] STEP 1 SUCCESS: Extension details validated');
    console.log('[EXTENSION_FLOW] Extension pricing breakdown:', {
      finalAmountAfterCredits,
      originalPrice: extensionPricing.finalExtensionPrice,
      creditsUsed: creditsToUse,
      creditsEnabled,
      availableCredits,
      isCreditsOnlyTransaction: finalAmountAfterCredits < 0.5,
      extensionWeeks: extensionOnlyWeeks.length,
      bookingId: extendingBooking?.id
    });

    // If the amount after credits is very small (less than $0.50), treat as credits-only transaction
    if (finalAmountAfterCredits < 0.5) {
      console.log('[EXTENSION_FLOW] === STEP 2A: Credits-only extension, skipping Stripe ===');
      // Generate a fake payment intent ID for credits-only transactions
      const creditsOnlyPaymentId = `credits_only_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      handleExtensionPaymentSuccess(creditsOnlyPaymentId);
      return;
    }

    // Otherwise, proceed with Stripe payment
    console.log('[EXTENSION_FLOW] === STEP 2B: Opening Stripe modal for extension ===');
    console.log('[EXTENSION_FLOW] Stripe payment details:', {
      creditsToUse,
      creditsEnabled,
      finalAmountAfterCredits,
      willPassCreditsToStripe: creditsEnabled && creditsToUse > 0
    });
    setShowPaymentModal(true);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-error-muted text-error p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8">
      <div className="grid grid-cols-1">
        <div className="px-3 xs:px-4 sm:px-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-display font-light text-primary mb-2">My Account</h1>
              <div className="text-primary">
                <p className="font-mono">{session?.session?.user?.email}</p>
              </div>
            </div>
          </div>
          
          {bookings.length === 0 ? (
            <div className="text-center font-mono text-primary">
              No bookings found. Book your stay first!
            </div>
          ) : (
            <div className="space-y-6">
              {bookings.map((booking) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface p-6 rounded-sm shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-display font-light mb-2 text-primary">
                        {booking.accommodation?.title || 'Accommodation'}
                      </h3>
                      <div className="space-y-1 text-sm font-mono">
                        <p>
                          <span className="text-primary">Check-in:</span>{' '}
                          <span className="text-primary">{format(parseISO(booking.check_in), 'PPP')}</span>
                        </p>
                        <p>
                          <span className="text-primary">Check-out:</span>{' '}
                          <span className="text-primary">
                            {(() => {
                              const parsedDate = parseISO(booking.check_out);
                              console.log('[DEBUG] Check-out display - raw:', booking.check_out, 'parsed:', parsedDate);
                              return format(parsedDate, 'PPP');
                            })()}
                          </span>
                          {isEligibleForExtension(booking) && (
                            <button
                              className="ml-2 px-2 py-0.5 text-xs font-mono border border-green-600/30 text-accent-primary bg-transparent rounded-sm transition-colors hover:bg-green-900/20 hover:text-green-300 hover:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-600 shadow-sm"
                              onClick={() => {
                                console.log('[EXTENSION_FLOW] === STEP 0: Extend button clicked ===');
                                console.log('[EXTENSION_FLOW] Opening extension modal for booking:', {
                                  bookingId: booking.id,
                                  accommodationTitle: booking.accommodation?.title,
                                  checkIn: booking.check_in,
                                  checkOut: booking.check_out
                                });
                                setExtendingBooking(booking);
                              }}
                            >
                              Extend
                            </button>
                          )}
                        </p>
                        <p>
                          <span className="text-primary">Total Donated:</span>{' '}
                          <span className="text-primary">
                            €{(() => {
                              const totalPaid = (booking as any).total_amount_paid || 0;
                              return totalPaid % 1 === 0 ? totalPaid.toFixed(0) : totalPaid.toFixed(2);
                            })()}
                          </span>
                        </p>
                        <a 
                          href="https://gardening.notion.site/Welcome-to-The-Garden-2684f446b48e4b43b3f003d7fca33664?pvs=4"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent-primary hover:text-accent-secondary hover:underline font-mono transition-colors mt-2"
                        >
                          Welcome Guide
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    {booking.accommodation?.image_url && (
                      <button
                        onClick={() => setEnlargedImageUrl(booking.accommodation?.image_url || null)}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 rounded-lg transition-opacity hover:opacity-80"
                      >
                        <img
                          src={booking.accommodation.image_url}
                          alt={booking.accommodation.title}
                          className="w-32 h-32 object-cover rounded-lg cursor-pointer"
                        />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {enlargedImageUrl && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setEnlargedImageUrl(null)}
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={enlargedImageUrl}
              alt="Enlarged booking accommodation"
              className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setEnlargedImageUrl(null)}
              className="absolute -top-2 -right-2 bg-surface rounded-full p-1 text-secondary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
              aria-label="Close enlarged image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {extendingBooking && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => {
              setExtendingBooking(null);
              setExtensionWeeks([]);
              setShowCustomWeeks(false);
              setExtensionError(null);
              setCreditsEnabled(false);
              setCreditsToUse(0);
              handleRemoveDiscount();
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-bg-surface)] rounded-sm max-w-md w-full p-4 sm:p-6 border border-gray-500/30 text-text-primary shadow-xl relative max-h-[85vh] overflow-y-auto backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setExtendingBooking(null);
                  setExtensionWeeks([]);
                  setShowCustomWeeks(false);
                  setExtensionError(null);
                  setCreditsEnabled(false);
                  setCreditsToUse(0);
                  handleRemoveDiscount();
                }}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 text-text-secondary hover:text-text-primary transition-colors z-[1]"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Header */}
              <div className="mb-4">
                <h3 className="text-lg sm:text-xl font-display">Extend Your Stay</h3>
                <p className="text-sm text-text-secondary mt-1">
                  at {extendingBooking.accommodation?.title || 'your accommodation'}
                </p>
              </div>
              
              {/* Current Booking Summary - Simplified */}
              <div className="bg-surface-dark/30 rounded-sm p-3 mb-4 border border-border/30">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-secondary font-mono">Current stay</span>
                  <span className="text-primary font-mono">
                    {format(checkIn, 'MMM d')} → {format(checkOut, 'MMM d')} ({formatWeeksForDisplay(originalWeeksDecimal)}w)
                  </span>
                </div>
              </div>
              
              {/* Show loading state */}
              {extensionWeeksLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
                </div>
              ) : (
                <>
                  {/* Quick Extension Options */}
                  <div className="mb-4">
                    <p className="text-xs text-secondary font-mono mb-2 uppercase">Quick extend by:</p>
                    {(() => {
                      // Calculate which options are actually available
                      const availableOptions = [1, 2, 4].filter(weeks => {
                        // Check if within max weeks limit
                        if ((originalWeeksDecimal + weeks) > MAX_WEEKS_ALLOWED) return false;
                        
                        // Check if enough weeks are available
                        const selectableWeeks = extensionWeeksData
                          .filter(w => isAfter(w.startDate, checkOut) && isWeekSelectable(w, false, originalWeeks, undefined, false))
                          .slice(0, weeks);
                        
                        return selectableWeeks.length >= weeks;
                      });
                      
                      if (availableOptions.length === 0) {
                        return (
                          <div className="p-3 border border-border/30 rounded-sm text-center">
                            <p className="text-xs text-secondary font-mono">No quick extensions available</p>
                            <p className="text-xs text-secondary/70 font-mono mt-1">
                              {(originalWeeksDecimal >= MAX_WEEKS_ALLOWED) 
                                ? `Maximum stay of ${MAX_WEEKS_ALLOWED} weeks reached`
                                : 'Try using the calendar below'
                              }
                            </p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className={`grid gap-2 ${availableOptions.length === 1 ? 'grid-cols-1' : availableOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {availableOptions.map(weeks => (
                            <button
                              key={weeks}
                              onClick={() => {
                                setExtensionError(null);
                                const selectableWeeks = extensionWeeksData
                                  .filter(w => isAfter(w.startDate, checkOut) && isWeekSelectable(w, false, originalWeeks, undefined, false))
                                  .slice(0, weeks);
                                setExtensionWeeks(selectableWeeks);
                              }}
                              className={`
                                p-3 rounded-sm border font-mono text-sm transition-all
                                ${extensionOnlyWeeks.length === weeks
                                  ? 'border-accent-primary bg-accent-primary/20 text-accent-primary'
                                  : 'border-border hover:border-accent-primary/50 text-primary hover:bg-surface-dark/50'
                                }
                              `}
                            >
                              +{weeks} week{weeks > 1 ? 's' : ''}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    
                    {/* Error message */}
                    {extensionError && (
                                              <div className="mt-2 p-2 bg-red-900/20 border border-red-600/30 rounded-sm">
                        <p className="text-xs text-red-400 font-mono">{extensionError}</p>
                      </div>
                    )}
                    
                    {/* Custom selection toggle - only show if user hasn't reached maximum weeks */}
                    {originalWeeksDecimal < MAX_WEEKS_ALLOWED && (
                      <button
                        onClick={() => {
                          setShowCustomWeeks(!showCustomWeeks);
                          setExtensionError(null); // Clear error when toggling
                        }}
                        className="w-full mt-2 text-xs text-accent-primary hover:underline font-mono"
                      >
                        {showCustomWeeks ? 'Hide calendar' : 'Choose specific dates →'}
                      </button>
                    )}
                  </div>
                  
                  {/* Custom Week Selection (collapsible) */}
                  <AnimatePresence>
                    {showCustomWeeks && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mb-4 pt-2">
                          <WeekSelector
                            weeks={extensionWeeksData
                              .filter(w => isAfter(w.startDate, checkOut) && isWeekSelectable(w, false, originalWeeks, undefined, false))
                              .slice(0, MAX_WEEKS_ALLOWED - Math.ceil(originalWeeksDecimal))}
                  selectedWeeks={[...originalWeeks, ...extensionWeeks]}
                  extensionWeeks={extensionOnlyWeeks}
                                    onWeekSelect={(week) => {
                    const isCurrentCheckoutWeek = extensionOnlyWeeks.length > 0 && 
                      extensionOnlyWeeks[extensionOnlyWeeks.length - 1].id === week.id;
                    
                    if (isCurrentCheckoutWeek) {
                      setExtensionWeeks([]);
                      return;
                    }
                    
                              const selectableWeeks = extensionWeeksData
                                .filter(w => isAfter(w.startDate, checkOut) && isWeekSelectable(w, false, originalWeeks, undefined, false))
                      .slice(0, MAX_WEEKS_ALLOWED - Math.ceil(originalWeeksDecimal));
                    
                              const clickedWeekIndex = selectableWeeks.findIndex(w => w.id === week.id);
                              if (clickedWeekIndex !== -1) {
                                                              const newSelection = selectableWeeks.slice(0, clickedWeekIndex + 1);
                    setExtensionWeeks(newSelection);
                              setExtensionError(null); // Clear error on success
                            }
                  }}
                  onWeeksDeselect={() => {
                    setExtensionWeeks([]);
                            setExtensionError(null);
                  }}
                  onClearSelection={undefined}
                  currentMonth={undefined}
                  isMobile={false}
                  isAdmin={false}
                            isLoading={false}
                  onMonthChange={undefined}
                  onDateSelect={() => {}}
                  accommodationTitle={extendingBooking.accommodation?.title || ''}
                  columns={2}
                  disableFireflies={true}
                />
                  </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Selected Extension Summary */}
                  {extensionOnlyWeeks.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 bg-accent-primary/10 rounded-sm border border-accent-primary/30"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-accent-primary font-mono uppercase">New checkout</p>
                          <p className="text-lg text-primary font-mono">
                            {format(extensionOnlyWeeks[extensionOnlyWeeks.length - 1].endDate, 'MMM d, yyyy')}
                          </p>
              </div>
                        <div className="text-right">
                          <p className="text-xs text-secondary font-mono">Total stay</p>
                          <p className="text-lg text-primary font-mono">
                            {formatWeeksForDisplay(totalWeeksDecimal)} weeks
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                                        {/* Price Breakdown - Always visible when extension selected */}
              {extensionOnlyWeeks.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      {/* Pricing Details */}
                                              <div className="p-4 bg-surface-dark rounded-sm border border-border">
                  <div className="flex items-center justify-between mb-3">
                          <h4 className="text-base font-mono text-primary">Extension Cost</h4>
                    <Tooltip.Provider>
                      <Tooltip.Root delayDuration={50}>
                        <Tooltip.Trigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDiscountModal(true);
                            }}
                                  className="p-1 text-[var(--color-accent-primary)] hover:text-[var(--color-accent-secondary)] rounded transition-colors"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content !font-mono z-[110]" sideOffset={5}>
                                  View discount details
                            <Tooltip.Arrow className="tooltip-arrow" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </div>
                  
                        <div className="space-y-2 text-sm font-mono">
                      <div className="flex justify-between">
                            <span className="text-secondary">Accommodation ({extensionOnlyWeeks.length}w)</span>
                        <span className="text-primary">€{Math.round(extensionPricing.extensionAccommodationPrice)}</span>
                    </div>

                          <div className="flex justify-between">
                            <span className="text-secondary">Food & Facilities</span>
                            <span className="text-primary">€{Math.round(extensionPricing.extensionFoodCost)}</span>
                      </div>
                      
                                                    {/* Food Contribution Slider - Inline */}
                          {foodContribution !== null && foodContributionRange && (
                            <div className="pt-2 pb-1">
                          <OptimizedSlider
                            id="extension-food-contribution"
                                min={foodContributionRange.min}
                                max={foodContributionRange.max}
                                value={foodContribution}
                            onChange={setFoodContribution}
                                onDisplayValueChange={handleDisplayValueChange}
                              />
                              <div className="flex justify-between text-[10px] text-secondary mt-1">
                                <span>€{foodContributionRange.min}/w</span>
                                <span className="text-accent-primary">€{displayFoodContribution || foodContribution}/week</span>
                                <span>€{foodContributionRange.max}/w</span>
                          </div>
                        </div>
                      )}

                          {/* Discount if applied */}
                    {appliedDiscount && extensionPricing.discountAmount > 0 && (
                            <>
                              <div className="border-t border-border/50 my-2" />
                      <div className="flex justify-between">
                                <span className="text-secondary">Subtotal</span>
                        <span className="text-primary">€{Math.round(extensionPricing.extensionPrice)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                                <span>{appliedDiscount.code} (-{appliedDiscount.percentage_discount}%)</span>
                                <span>-€{extensionPricing.discountAmount.toFixed(2)}</span>
                      </div>
                            </>
                          )}
                          
                          <div className="border-t border-border pt-2 mt-2">
                            <div className="flex justify-between text-base">
                              <span className="text-primary font-medium">Total</span>
                              <span className="text-primary font-medium">€{extensionPricing.finalExtensionPrice.toFixed(2)}</span>
                            </div>
                          </div>
                    </div>
                  </div>

                      {/* Credits Section */}
                      <CreditsSection
                        availableCredits={availableCredits}
                        creditsLoading={creditsLoading}
                        creditsEnabled={creditsEnabled}
                        setCreditsEnabled={setCreditsEnabled}
                        creditsToUse={creditsToUse}
                        setCreditsToUse={setCreditsToUse}
                        pricing={{
                          totalNights: extensionPricing.extensionNights || 0,
                          nightlyAccommodationRate: (extensionPricing.weeklyAccommodationRate || 0) / 7,
                          baseAccommodationRate: extensionPricing.accommodationBasePrice || 0,
                          effectiveBaseRate: extensionPricing.weeklyAccommodationRate || 0,
                          totalAccommodationCost: extensionPricing.extensionAccommodationPrice || 0,
                          totalFoodAndFacilitiesCost: extensionPricing.extensionFoodCost || 0,
                          subtotal: extensionPricing.extensionPrice || 0,
                          durationDiscountAmount: (extensionPricing.extensionPrice || 0) - (extensionPricing.extensionAccommodationPrice || 0) - (extensionPricing.extensionFoodCost || 0),
                          durationDiscountPercent: extensionPricing.averageSeasonalDiscount || 0,
                          weeksStaying: extensionPricing.extensionWeeks || 0,
                          totalAmount: extensionPricing.finalExtensionPrice || 0,
                          appliedCodeDiscountValue: extensionPricing.discountAmount || 0,
                          seasonalDiscount: extensionPricing.averageSeasonalDiscount || 0,
                          vatAmount: 0,
                          totalWithVat: extensionPricing.finalExtensionPrice || 0
                        }}
                        finalAmountAfterCredits={extensionPricing.finalAmountAfterCredits || 0}
                      />

                      {/* Discount Code Section - Simplified */}
                      <div className="space-y-2">
                        {!appliedDiscount ? (
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={discountCodeInput}
                              onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-2 bg-surface-dark border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-primary text-primary placeholder:text-secondary text-sm font-mono"
                              placeholder="Discount code"
                              disabled={isApplyingDiscount}
                            />
                            <button
                              onClick={handleApplyDiscount}
                              disabled={isApplyingDiscount || !discountCodeInput.trim()}
                              className="px-3 py-2 bg-surface-dark border border-border rounded-sm text-primary text-sm font-mono hover:border-accent-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isApplyingDiscount ? '...' : 'Apply'}
                            </button>
                          </div>
                        ) : (
                                                      <div className="flex items-center justify-between p-2.5 bg-emerald-900/20 rounded-sm border border-emerald-600/30">
                            <div className="flex items-center gap-2 text-sm">
                              <Tag className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-400 font-mono">{appliedDiscount.code} (-{appliedDiscount.percentage_discount}%)</span>
                            </div>
                            <button 
                              onClick={handleRemoveDiscount}
                              className="p-1 text-emerald-500 hover:text-red-400 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {discountError && (
                          <p className="text-xs text-red-400 font-mono">{discountError}</p>
                        )}
                  </div>
                  
                      {/* Action Button */}
                  <button
                    onClick={handleConfirmExtension}
                    disabled={isProcessingPayment}
                        className="w-full px-4 py-2.5 bg-accent-primary text-stone-800 font-mono text-sm rounded-sm transition-all hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                      >
                        {isProcessingPayment ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-800"></div>
                            Processing...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            Continue to Payment
                            <span className="opacity-90">€{(extensionPricing.finalAmountAfterCredits || 0).toFixed(2)}</span>
                          </span>
                        )}
                  </button>
                    </motion.div>
                  )}
                  
                  {/* No extension selected prompt - only show if user can still extend */}
                  {extensionOnlyWeeks.length === 0 && originalWeeksDecimal < MAX_WEEKS_ALLOWED && (
                    <div className="text-center py-6 text-secondary text-sm font-mono">
                      Select how many weeks you'd like to extend
                </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Payment Modal */}
      {showPaymentModal && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4"
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-bg-surface)] rounded-sm max-w-md w-full p-4 sm:p-6 border border-gray-500/30 text-text-primary shadow-xl relative backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 text-text-secondary hover:text-text-primary transition-colors z-[1]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-display">Complete Extension Donation</h3>
                <p className="text-sm text-text-secondary mt-2">
                  Extend your stay by {extensionOnlyWeeks.length} week{extensionOnlyWeeks.length > 1 ? 's' : ''}${appliedDiscount ? ` (${appliedDiscount.code} applied)` : ''}${creditsToUse > 0 ? ` (${creditsToUse} credits used)` : ''}
                </p>
              </div>

              <StripeCheckoutForm
                authToken={authToken}
                userEmail={session?.session?.user?.email || ''}
                total={(() => {
                  const paymentAmount = extensionPricing.finalAmountAfterCredits || 0;
                  console.log('[EXTENSION_FLOW] StripeCheckoutForm payment amount:', {
                    paymentAmount,
                    originalPrice: extensionPricing.finalExtensionPrice,
                    creditsToUse,
                    creditsEnabled,
                    calculation: `${extensionPricing.finalExtensionPrice} - ${creditsToUse} = ${paymentAmount}`
                  });
                  return paymentAmount;
                })()}
                description={`Booking extension for ${extendingBooking?.accommodation?.title || 'Accommodation'} - ${extensionOnlyWeeks.length} week${extensionOnlyWeeks.length > 1 ? 's' : ''}${appliedDiscount ? ` (${appliedDiscount.code} applied)` : ''}${creditsToUse > 0 ? ` (${creditsToUse} credits used)` : ''}`}
                bookingMetadata={{
                  accommodationId: extendingBooking?.accommodation_id,
                  originalTotal: extensionPricing.finalAmountAfterCredits,
                  discountCode: appliedDiscount?.code,
                  creditsUsed: creditsToUse || 0
                }}
                onSuccess={handleExtensionPaymentSuccess}
                onClose={() => setShowPaymentModal(false)}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Discount Modal for Extension */}
      {extendingBooking && extensionOnlyWeeks.length > 0 && (
        <DiscountModal
          isOpen={showDiscountModal}
          onClose={() => setShowDiscountModal(false)}
          checkInDate={extensionOnlyWeeks[0]?.startDate || new Date()}
          checkOutDate={extensionOnlyWeeks[extensionOnlyWeeks.length - 1]?.endDate || new Date()}
          durationCheckInDate={originalWeeks[0]?.startDate || new Date()}
          durationCheckOutDate={extensionOnlyWeeks[extensionOnlyWeeks.length - 1]?.endDate || new Date()}
          accommodationName={extendingBooking.accommodation?.title || ''}
          basePrice={extendingBooking.accommodation?.base_price || 0}
          calculatedWeeklyPrice={extensionPricing.weeklyAccommodationRate} // Price AFTER discounts (seasonal + duration) - this is what the user actually pays per week
          averageSeasonalDiscount={(() => {
            // Calculate seasonal discount for EXTENSION PERIOD ONLY (for display in modal)
            // This shows what seasons the extension covers, not what was used for pricing calculation
            if (extensionOnlyWeeks.length === 0) return null;
            const extensionStartDate = extensionOnlyWeeks[0]?.startDate;
            const extensionEndDate = extensionOnlyWeeks[extensionOnlyWeeks.length - 1]?.endDate;
            if (!extensionStartDate || !extensionEndDate) return null;
            
            // CRITICAL FIX: Dorms don't get seasonal discounts
            if (extendingBooking.accommodation?.title?.toLowerCase().includes('dorm')) {
              return 0;
            }
            
            const extensionSeasonBreakdown = getSeasonBreakdown(extensionStartDate, extensionEndDate);
            if (extensionSeasonBreakdown.seasons.length === 0) return null;
            
            const extensionAvgDiscount = extensionSeasonBreakdown.seasons.reduce((sum, season) => 
              sum + (season.discount * season.nights), 0) / 
              extensionSeasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
            
            return Math.round(extensionAvgDiscount * 100) / 100;
          })()}
        />
      )}
    </div>
  );
}

function isEligibleForExtension(booking: Booking): boolean {
  const now = new Date();
  const checkOut = typeof booking.check_out === 'string' ? parseISO(booking.check_out) : booking.check_out;
  if (checkOut <= now) return false;
  return true;
}
