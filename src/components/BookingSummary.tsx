import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar } from 'lucide-react';
import { useSchedulingRules } from '../hooks/useSchedulingRules';
import { getSeasonBreakdown } from '../utils/pricing';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/BookingService';
import { supabase } from '../lib/supabase';
import { StripeCheckoutForm } from './StripeCheckoutForm';
import { useSession } from '../hooks/useSession';
import { formatInTimeZone } from 'date-fns-tz';
import { DiscountModal } from './DiscountModal';
import { CancellationPolicyModal } from './CancellationPolicyModal';
import { useUserPermissions } from '../hooks/useUserPermissions';
import { useCredits } from '../hooks/useCredits';
import { calculateTotalNights, calculateTotalDays } from '../utils/dates';
import { Fireflies } from './Fireflies';

// Import types
import type { BookingSummaryProps, SeasonBreakdown, AppliedDiscount } from './BookingSummary/BookingSummary.types';

// Import hooks
import { usePricing } from './BookingSummary/BookingSummary.hooks';

// Import components
import { StayDetails } from './BookingSummary/components/StayDetails';
import { AccommodationSection } from './BookingSummary/components/AccommodationSection';
import { PriceBreakdown } from './BookingSummary/components/PriceBreakdown';
import { DiscountCodeSection } from './BookingSummary/components/DiscountCodeSection';
import { CreditsSection } from './BookingSummary/components/CreditsSection';
import { ConfirmButtons } from './BookingSummary/components/ConfirmButtons';

// Import utils
import { formatPriceDisplay } from './BookingSummary/BookingSummary.utils';

export function BookingSummary({
  selectedWeeks,
  selectedAccommodation,
  onClearWeeks,
  onClearAccommodation,
  seasonBreakdown: initialSeasonBreakdown,
  calculatedWeeklyAccommodationPrice
}: BookingSummaryProps) {
  // --- ADDED LOGGING: Check received prop value ---
  console.log('[BookingSummary] --- PROPS CHECK ---');
  console.log('[BookingSummary] Received calculatedWeeklyAccommodationPrice PROP:', calculatedWeeklyAccommodationPrice);
  // --- END ADDED LOGGING ---

  // --- LOGGING: Initial props and state ---
  console.log('[BookingSummary] --- Component Render Start ---');
  console.log('[BookingSummary] Initial Props Received:', {
    selectedWeeksCount: selectedWeeks?.length,
    selectedAccommodationId: selectedAccommodation?.id,
    selectedAccommodationTitle: selectedAccommodation?.title,
    initialSeasonBreakdownProvided: !!initialSeasonBreakdown,
    calculatedWeeklyAccommodationPrice, // Log the prop value
  });
  // Log specifically if it's the test accommodation
  if (selectedAccommodation?.type === 'test') {
    console.log('[BookingSummary] TEST ACCOMMODATION SELECTED - calculatedWeeklyAccommodationPrice:', calculatedWeeklyAccommodationPrice);
  }
  console.log('[BookingSummary] Raw selectedWeeks:', selectedWeeks.map(w => ({ start: w.startDate?.toISOString(), end: w.endDate?.toISOString(), flex: w.selectedFlexDate?.toISOString() })));

  const [isBooking, setIsBooking] = useState(false);
  console.log('[BookingSummary] useState(isBooking) called');
  
  const [error, setError] = useState<string | null>(null);
  console.log('[BookingSummary] useState(error) called');
  
  const [showStripeModal, setShowStripeModal] = useState(false);
  console.log('[BookingSummary] useState(showStripeModal) called');
  
  const [authToken, setAuthToken] = useState('');
  console.log('[BookingSummary] useState(authToken) called');
  
  const [selectedCheckInDate, setSelectedCheckInDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // New state for food and facilities contribution
  const [foodContribution, setFoodContribution] = useState<number | null>(null);
  const [showDiscountDetails, setShowDiscountDetails] = useState(false);
  const [testPaymentAmount, setTestPaymentAmount] = useState<number | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  
  // State for celebration fireflies
  const [showCelebrationFireflies, setShowCelebrationFireflies] = useState(false);

  // --- State for Discount Code ---
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  // --- End Discount Code State ---

  // --- State for Credits ---
  const [creditsToUse, setCreditsToUse] = useState<number>(0);
  const [creditsEnabled, setCreditsEnabled] = useState<boolean>(true); // Default to using credits
  const { credits: availableCredits, loading: creditsLoading, refresh: refreshCredits } = useCredits();
  // --- End Credits State ---

  // State for internally calculated season breakdown
  const [seasonBreakdownState, setSeasonBreakdownState] = useState<SeasonBreakdown | undefined>(initialSeasonBreakdown);
  const [accommodations, setAccommodations] = useState<any[]>([]);
  console.log('[BookingSummary] Initial State Values:', {
      isBooking, error, showStripeModal, authToken: !!authToken, selectedCheckInDate, showDatePicker, foodContribution, showDiscountDetails, testPaymentAmount, showDiscountModal,
      seasonBreakdownStateExists: !!seasonBreakdownState,
      accommodationsCount: accommodations.length, // Log initial count
  });

  // --- LOGGING: Track selectedAccommodation prop changes ---
  useEffect(() => {
    console.log('[BookingSummary] PROP CHANGE: selectedAccommodation updated:', {
        id: selectedAccommodation?.id,
        title: selectedAccommodation?.title,
        base_price: selectedAccommodation?.base_price,
        is_unlimited: selectedAccommodation?.is_unlimited,
    });
  }, [selectedAccommodation]);
  // --- END LOGGING ---

  // Hooks
  const { getArrivalDepartureForDate } = useSchedulingRules();
  const navigate = useNavigate();
  const session = useSession();
  const { isAdmin, isLoading: permissionsLoading } = useUserPermissions(session?.session);
  const userEmail = session?.session?.user?.email; // Also update this to use session.session

  // Get flexible dates from the first week if available
  const flexibleDates = selectedWeeks[0]?.flexibleDates;
  const hasFlexibleDates = flexibleDates && flexibleDates.length > 0;

  // --- LOGGING: Season Breakdown Calculation Effect ---
  // Log state *before* the effect runs
  console.log('[BookingSummary] State BEFORE season breakdown effect:', {
    accommodationsCount: accommodations.length,
    seasonBreakdownStateExists: !!seasonBreakdownState,
  });

  // Update season breakdown when selected weeks or accommodation change
  useEffect(() => {
    console.log('[BookingSummary] --- Running Season Breakdown Effect ---');
    console.log('[BookingSummary] Effect Dependencies:', {
      selectedWeeksLength: selectedWeeks.length,
      selectedAccommodationId_Prop: selectedAccommodation?.id,
      // Note: Explicitly removing accommodations state from dependencies if not needed for lookup
    });

    // --- Get details directly from prop ---
    const accommodationPrice = selectedAccommodation?.base_price ?? 0;
    const accommodationTitle = selectedAccommodation?.title ?? '';
    console.log('[BookingSummary] Effect: Using selectedAccommodation PROP details:', {
      id: selectedAccommodation?.id,
      title: accommodationTitle,
      price: accommodationPrice,
    });

    // --- Where does the 'accommodations' state list come from? ---
    // If you still need to look up something in the `accommodations` list, log it here:
    // const foundAccommodationInState = accommodations.find(a => a.id === selectedAccommodation?.id);
    // console.log('[BookingSummary] Effect: Result of finding accommodation in STATE list:', {
    //   found: !!foundAccommodationInState,
    //   stateListCount: accommodations.length
    // });
    // If the lookup IS still needed, restore 'accommodations' to dependency array below.


    // --- Calculation Logic ---
    if (selectedWeeks.length > 0 && accommodationPrice > 0 && !accommodationTitle.toLowerCase().includes('dorm')) {
      console.log('[BookingSummary] Effect: Conditions met for calculation (Weeks > 0, Price > 0, Not Dorm).');
      if (selectedWeeks[0]?.startDate && selectedWeeks[selectedWeeks.length - 1]?.endDate) {
        const startDate = selectedWeeks[0].startDate;
        const endDate = selectedWeeks[selectedWeeks.length - 1].endDate;
         console.log('[BookingSummary] Effect: Calculating breakdown with dates:', { start: startDate.toISOString(), end: endDate.toISOString() });
        const breakdown = getSeasonBreakdown(startDate, endDate);
        console.log('[BookingSummary] Effect: Calculated breakdown:', JSON.stringify(breakdown, null, 2));

        // Avoid unnecessary state update
        if (JSON.stringify(breakdown) !== JSON.stringify(seasonBreakdownState)) {
            console.log('[BookingSummary] Effect: *** Setting NEW season breakdown state ***');
            setSeasonBreakdownState(breakdown);
        } else {
            console.log('[BookingSummary] Effect: Calculated breakdown matches current state. No update.');
        }
      } else {
        console.warn('[BookingSummary] Effect: Cannot calculate breakdown - missing start/end dates.');
        if (seasonBreakdownState !== undefined) {
           console.log('[BookingSummary] Effect: *** Clearing season breakdown state (missing dates) ***');
           setSeasonBreakdownState(undefined);
        }
      }
    } else {
      // Determine reason for not calculating/clearing
      let reason = 'Unknown';
      if (selectedWeeks.length === 0) reason = 'No weeks selected.';
      else if (!selectedAccommodation) reason = 'No accommodation selected (prop).';
      else if (accommodationPrice === 0) reason = 'Accommodation price is 0.';
      else if (accommodationTitle.toLowerCase().includes('dorm')) reason = 'Accommodation is Dorm.';

      if (seasonBreakdownState !== undefined) {
          console.log(`[BookingSummary] Effect: *** Clearing season breakdown state. Reason: ${reason} ***`);
          setSeasonBreakdownState(undefined);
      } else {
          console.log(`[BookingSummary] Effect: Season breakdown not applicable or already clear. Reason: ${reason}`);
      }
    }
    console.log('[BookingSummary] --- Finished Season Breakdown Effect ---');
    // Dependencies: Rely only on props/values directly used in the effect's logic
    // Removed 'accommodations' unless it's re-added for the lookup. Added seasonBreakdownState for comparison.
  }, [selectedWeeks, selectedAccommodation, getSeasonBreakdown, seasonBreakdownState]);
  // --- END LOGGING ---

  // Calculate pricing details - MEMOIZED using custom hook
  const pricing = usePricing({
    selectedWeeks,
    selectedAccommodation,
    calculatedWeeklyAccommodationPrice,
    foodContribution,
    appliedDiscount
  });

  const isStateOfTheArtist = useMemo(() => {
    if (selectedWeeks.length === 1) {
      const weekName = selectedWeeks[0]?.name?.toLowerCase() || '';
      const targetName = 'state of the art[ist]';
      const isMatch = weekName.includes(targetName);
      return isMatch;
    }
    return false;
  }, [selectedWeeks]);

  // Calculate final amount after credits
  const finalAmountAfterCredits = useMemo(() => {
    const afterCredits = Math.max(0, pricing.totalAmount - creditsToUse);
    console.log('[BookingSummary] Final amount after credits:', afterCredits, '(totalAmount:', pricing.totalAmount, ', credits:', creditsToUse, ')');
    return afterCredits;
  }, [pricing.totalAmount, creditsToUse]);

  // Always update the check-in date when selectedWeeks changes
  useEffect(() => {
    console.log('[BookingSummary] useEffect[selectedWeeks] - Updating check-in date...');
    if (selectedWeeks.length > 0) {
      // Check if the first week has a selectedFlexDate property (from flexible check-in)
      if (selectedWeeks[0].selectedFlexDate) {
        console.log('[BookingSummary] Using selectedFlexDate from first week:', formatDateForDisplay(selectedWeeks[0].selectedFlexDate));
        setSelectedCheckInDate(selectedWeeks[0].selectedFlexDate);
        console.log('[BookingSummary] Selected check-in date:', selectedWeeks[0]);
      } else {
        // Otherwise use the week's start date
        console.log('[BookingSummary] Using default start date from first week:', formatDateForDisplay(selectedWeeks[0].startDate));
        setSelectedCheckInDate(selectedWeeks[0].startDate);
      }
    } else {
      setSelectedCheckInDate(null);
    }
  }, [selectedWeeks]); // Only depend on selectedWeeks changing

  // Initialize food contribution based on number of nights/weeks (USE BASE RATES for slider)
  useEffect(() => {
    console.log('[BookingSummary] useEffect[selectedWeeks] - Initializing BASE food contribution range...');
    if (selectedWeeks.length > 0) {
      const totalNights = calculateTotalNights(selectedWeeks);
      // Set default contribution to the middle of the BASE range (undiscounted)
      if (totalNights <= 6) {
        // Base range for 1 week: €345-€390
        const min = 345;
        const max = 390;
        const defaultContribution = Math.round((min + max) / 2);
        setFoodContribution(defaultContribution);
        console.log('[BookingSummary] Setting default BASE food contribution for short stay:', defaultContribution, 'per week');
      } else {
        // Base range for 2+ weeks: €240-€390
        const min = 240;
        const max = 390;
        const defaultContribution = Math.round((min + max) / 2);
        setFoodContribution(defaultContribution);
        console.log('[BookingSummary] Setting default BASE food contribution for long stay:', defaultContribution, 'per week');
      }
    } else {
      setFoodContribution(null);
      console.log('[BookingSummary] Clearing food contribution');
    }
    // No longer depends on pricing.durationDiscountPercent
  }, [selectedWeeks]);

  // Log when food contribution changes (for debugging slider/pricing interaction)
  useEffect(() => {
    if (foodContribution !== null) {
      console.log('[BookingSummary] STATE CHANGE: foodContribution updated:', foodContribution);
    }
  }, [foodContribution]);

  // Monitor error state changes
  useEffect(() => {
    console.log('[BookingSummary] ERROR STATE CHANGED:', error);
  }, [error]);

  // Auto-set credits to use when pricing or available credits change
  useEffect(() => {
    if (creditsEnabled && !creditsLoading && pricing.totalAmount > 0) {
      // Automatically set credits to use (min of available credits or total amount)
      const maxCreditsToUse = Math.min(availableCredits, Math.floor(pricing.totalAmount));
      setCreditsToUse(maxCreditsToUse);
      console.log('[BookingSummary] Auto-setting credits to use:', maxCreditsToUse, 'from available:', availableCredits);
    } else if (!creditsEnabled) {
      setCreditsToUse(0);
      console.log('[BookingSummary] Credits disabled, setting to 0');
    }
  }, [pricing.totalAmount, availableCredits, creditsEnabled, creditsLoading]);

  // Validate that a check-in date is selected
  const validateCheckInDate = useCallback(() => {
    console.log('[BookingSummary] Validating check-in date. Selected:', selectedCheckInDate?.toISOString());
    if (!selectedCheckInDate) {
      console.log('[BookingSummary] Validation FAILED: No check-in date selected');
      setError('Please select a check-in date');
      return false;
    }

    // Add detailed logging here
    if (hasFlexibleDates && flexibleDates) {
      console.log('[BookingSummary] Validating flex date. Selected Check In:', selectedCheckInDate.toISOString(), selectedCheckInDate.toString());
      flexibleDates.forEach((date, index) => {
        console.log(`[BookingSummary] Flex Date Option ${index}:`, date.toISOString(), date.toString());
        // Use UTC comparison instead of isSameDay
        const areDatesSameUTC = date.getUTCFullYear() === selectedCheckInDate.getUTCFullYear() &&
                               date.getUTCMonth() === selectedCheckInDate.getUTCMonth() &&
                               date.getUTCDate() === selectedCheckInDate.getUTCDate();
        console.log(`[BookingSummary] areDatesSameUTC(flexDate ${index}, selectedCheckInDate)?`, areDatesSameUTC);
      });
      // Perform the check using UTC comparison
      const isValid = flexibleDates.some(date => 
        date.getUTCFullYear() === selectedCheckInDate.getUTCFullYear() &&
        date.getUTCMonth() === selectedCheckInDate.getUTCMonth() &&
        date.getUTCDate() === selectedCheckInDate.getUTCDate()
      );
      console.log('[BookingSummary] Overall isValid based on UTC comparison:', isValid);
    }
    // End of added logging

    // Use UTC comparison for the actual validation check
    if (hasFlexibleDates && !flexibleDates?.some(date => 
        date.getUTCFullYear() === selectedCheckInDate.getUTCFullYear() &&
        date.getUTCMonth() === selectedCheckInDate.getUTCMonth() &&
        date.getUTCDate() === selectedCheckInDate.getUTCDate()
      )) {
      console.log('[BookingSummary] Invalid check-in date selected (based on UTC comparison):', selectedCheckInDate);
      setError('Please select a valid check-in date from the available options');
      return false;
    }
    return true;
  }, [selectedCheckInDate, hasFlexibleDates, flexibleDates]);

  useEffect(() => {
    console.log('[BookingSummary] useEffect(getSession) called');
    console.log('[Booking Summary] Getting Supabase session...');
    supabase.auth.getSession().then(res => {
      const token = res?.data?.session?.access_token;
      console.log('[Booking Summary] Auth token retrieved:', !!token);
      if(token && token !== '') {
        setAuthToken(token);
      } else {
        console.warn('[Booking Summary] No auth token found');
        setError('Authentication required. Please sign in again.');
      }
    }).catch(err => {
      console.error('[Booking Summary] Error getting session:', err);
      setError('Failed to authenticate. Please try again.');
    });
  }, []);

  // Validate availability before showing Stripe modal
  const validateAvailability = async () => {
    console.log('[Booking Summary] Validating availability...');
    if (!selectedAccommodation || selectedWeeks.length === 0) {
      console.warn('[Booking Summary] Missing accommodation or weeks for validation');
      setError('Please select accommodation and dates first.');
      return false;
    }

    const startDate = selectedWeeks[0].startDate;
    const endDate = selectedWeeks[selectedWeeks.length - 1].endDate;
    
    console.log('[Booking Summary] Checking availability for:', {
      accommodation: selectedAccommodation.title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // If accommodation is unlimited, it's always available
    if (selectedAccommodation.is_unlimited) {
      console.log('[Booking Summary] Accommodation is unlimited, skipping availability check');
      return true;
    }

    try {
      const availability = await bookingService.getAvailability(startDate, endDate);
      const accommodationAvailability = availability.find(a => a.accommodation_id === selectedAccommodation.id);
      const isAvailable = accommodationAvailability?.is_available ?? false;
      console.log('[Booking Summary] Availability check result:', {
        isAvailable,
        accommodationId: selectedAccommodation.id
      });
      return isAvailable;
    } catch (err) {
      console.error('[Booking Summary] Error checking availability:', err);
      return false;
    }
  };

  const handleBookingSuccess = useCallback(async (paymentIntentId?: string) => {
    // Added optional paymentIntentId
    console.log('[BookingSummary] handleBookingSuccess called. Payment Intent ID:', paymentIntentId || 'N/A');
    console.log('[BookingSummary] ENTRY - Checking required info:', {
      selectedAccommodation: !!selectedAccommodation,
      selectedAccommodationTitle: selectedAccommodation?.title,
      selectedWeeksLength: selectedWeeks.length,
      selectedCheckInDate: !!selectedCheckInDate,
      selectedCheckInDateISO: selectedCheckInDate?.toISOString()
    });
    try {
      if (!selectedAccommodation || selectedWeeks.length === 0 || !selectedCheckInDate) {
        console.error('[Booking Summary] Missing required info for booking success:', { selectedAccommodation: !!selectedAccommodation, selectedWeeks: selectedWeeks.length > 0, selectedCheckInDate: !!selectedCheckInDate });
        throw new Error('Missing required booking information');
      }
      
      console.log('[BookingSummary] VALIDATION PASSED - Proceeding with booking');

      // Calculate check-out date based on the selected check-in date
      const totalDays = calculateTotalDays(selectedWeeks);
      const checkOut = addDays(selectedCheckInDate, totalDays-1);

              console.log('[BookingSummary] Starting booking process...');
        console.log('[BookingSummary] handleBookingSuccess: Raw Dates:', { // ADDED LOG BLOCK
          selectedCheckInDate_ISO: selectedCheckInDate.toISOString(),
          selectedCheckInDate_Raw: selectedCheckInDate,
          checkOut_ISO: checkOut.toISOString(),
          checkOut_Raw: checkOut
        });
        console.log('[BookingSummary] Setting isBooking to true and clearing errors');
        setIsBooking(true);
        setError(null);
      
      try {
        // (Pricing should already be rounded to 2 decimal places)
        const roundedTotal = pricing.totalAmount;
        console.log('[Booking Summary] Calculated rounded total for booking/confirmation:', roundedTotal);

        const formattedCheckIn = formatInTimeZone(selectedCheckInDate, 'UTC', 'yyyy-MM-dd');
        const formattedCheckOut = formatInTimeZone(checkOut, 'UTC', 'yyyy-MM-dd');
        console.log('[Booking Summary] Creating booking with FORMATTED (UTC) dates and ROUNDED total:', { 
          formattedCheckIn,
          formattedCheckOut,
          accommodationId: selectedAccommodation.id,
          totalPrice: roundedTotal // Use rounded total
        });

        // Add applied discount code if present
        console.log('[BookingSummary] REACHED PRICING BREAKDOWN SECTION');
        
        // Calculate the base accommodation price BEFORE any discounts
        // Use pricing.baseAccommodationRate which is the actual base rate, not selectedAccommodation.base_price
        const baseAccommodationPrice = pricing.baseAccommodationRate * pricing.weeksStaying;
        
        console.log('[Booking Summary] DEBUG VALUES:', {
          'selectedAccommodation.base_price': selectedAccommodation.base_price,
          'pricing.baseAccommodationRate': pricing.baseAccommodationRate,
          'pricing.weeksStaying': pricing.weeksStaying,
          'pricing.totalAccommodationCost': pricing.totalAccommodationCost,
          'baseAccommodationPrice (calculated)': baseAccommodationPrice
        });
        
        // Calculate seasonal discount amount for accommodation
        let seasonalDiscountAmount = 0;
        let avgSeasonalDiscountPercent = 0; // Store percentage for saving to DB
        if (seasonBreakdownState && selectedAccommodation && !selectedAccommodation.title.toLowerCase().includes('dorm')) {
          const preciseDiscount = seasonBreakdownState.seasons.reduce((sum, season) => 
            sum + (season.discount * season.nights), 0) / 
            seasonBreakdownState.seasons.reduce((sum, season) => sum + season.nights, 0);
          
          // CRITICAL FIX: Round to match what's displayed in modal (Math.round(value * 100))
          // This ensures calculations use the same value users see (e.g., 10% not 9.51%)
          avgSeasonalDiscountPercent = Math.round(preciseDiscount * 100) / 100;
          
          // Calculate the actual discount amount: base price * weeks * ROUNDED seasonal discount %
          seasonalDiscountAmount = baseAccommodationPrice * avgSeasonalDiscountPercent;
        }
        
        // Calculate duration discount amount for accommodation
        const accommodationDurationDiscountAmount = baseAccommodationPrice * (pricing.durationDiscountPercent / 100);
        
        // Use the already-calculated accommodation price from pricing hook (avoids rounding discrepancies)
        const accommodationAfterSeasonalDuration = pricing.totalAccommodationCost;
        
        // Calculate subtotal after discount code (but before credits)
        const subtotalAfterDiscountCode = pricing.totalAmount; // This is already calculated in usePricing hook
        
        // Log the breakdown for debugging
        console.log('[Booking Summary] Accommodation pricing breakdown:', {
          baseWeeklyRate: selectedAccommodation.base_price,
          weeksStaying: pricing.weeksStaying,
          baseAccommodationPrice: baseAccommodationPrice,
          seasonalDiscountAmount: seasonalDiscountAmount,
          seasonalDiscountPercent: avgSeasonalDiscountPercent * 100, // Convert to percentage
          durationDiscountPercent: pricing.durationDiscountPercent,
          accommodationDurationDiscountAmount: accommodationDurationDiscountAmount,
          accommodationAfterSeasonalDuration: accommodationAfterSeasonalDuration,
          finalAccommodationPrice: pricing.totalAccommodationCost,
          // Note: Now using pricing.totalAccommodationCost directly to avoid rounding discrepancies
          usingPricingHookValue: true
        });
        
        console.log('[Booking Summary] CRITICAL: Accommodation price values being sent:', {
          accommodationPrice: parseFloat(baseAccommodationPrice.toFixed(2)), // Should be base price BEFORE discounts
          accommodationPricePaid: pricing.totalAccommodationCost // Should be actual price AFTER discounts
        });
        
        const bookingPayload: any = {
          accommodationId: selectedAccommodation.id,
          checkIn: formattedCheckIn,
          checkOut: formattedCheckOut,
          totalPrice: roundedTotal, // Send the final price calculated by the frontend
          // Add price breakdown for future bookings
          accommodationPrice: parseFloat(baseAccommodationPrice.toFixed(2)), // Base price BEFORE discounts
          foodContribution: pricing.totalFoodAndFacilitiesCost,
          seasonalAdjustment: parseFloat(seasonalDiscountAmount.toFixed(2)),
          seasonalDiscountPercent: Math.round(avgSeasonalDiscountPercent * 100), // Store as rounded integer percentage (matches display)
          durationDiscountPercent: pricing.durationDiscountPercent,
          // Calculate total discount amount (accommodation duration + food duration + code + seasonal discounts)
          discountAmount: accommodationDurationDiscountAmount + pricing.durationDiscountAmount + pricing.appliedCodeDiscountValue + parseFloat(seasonalDiscountAmount.toFixed(2)),
          // NEW: Store the actual accommodation amount paid (after all discounts)
          accommodationPricePaid: pricing.totalAccommodationCost,
          // NEW: Store accommodation price after seasonal/duration but before discount codes
          accommodationPriceAfterSeasonalDuration: parseFloat(accommodationAfterSeasonalDuration.toFixed(2)),
          // NEW: Store subtotal after discount code but before credits
          subtotalAfterDiscountCode: parseFloat(subtotalAfterDiscountCode.toFixed(2))
        };

        if (appliedDiscount?.code) {
            bookingPayload.appliedDiscountCode = appliedDiscount.code;
            bookingPayload.discountCodePercent = appliedDiscount.percentage_discount;
            bookingPayload.discountCodeAppliesTo = appliedDiscount.applies_to; // NEW: Save what the discount applies to
            console.log("[Booking Summary] Adding applied discount code to booking payload:", appliedDiscount.code, "with", appliedDiscount.percentage_discount, "% discount, applies to:", appliedDiscount.applies_to);
        }

        // Add credits used if any
        if (creditsToUse > 0) {
            bookingPayload.creditsUsed = creditsToUse;
            console.log("[Booking Summary] Adding credits used to booking payload:", creditsToUse);
        }

        // Add payment intent ID if available (for webhook coordination)
        if (paymentIntentId) {
            bookingPayload.paymentIntentId = paymentIntentId;
            console.log("[Booking Summary] Adding payment intent ID to booking payload:", paymentIntentId);
        }

        // TEST CONDITION: Simulate booking failure for payments under €1
        // Check the actual payment amount (after credits are applied)
        const paymentAmount = Math.max(0, roundedTotal - (creditsToUse || 0));
        const isTestPayment = paymentAmount < 1 && paymentAmount > 0; // Don't trigger for €0 payments (fully covered by credits)
        if (isTestPayment) {
          console.log("[TEST MODE] Simulating booking failure for payment under €1. Payment amount:", paymentAmount);
          throw new Error("TEST: Simulated booking failure for small payment amount");
        }

        console.log("[Booking Summary] SENDING BOOKING PAYLOAD:", JSON.stringify(bookingPayload, null, 2));
        
        const booking = await bookingService.createBooking(bookingPayload);

        console.log("[Booking Summary] Booking created:", booking);
        
        // Trigger celebration fireflies
        setShowCelebrationFireflies(true);
        
        // Refresh credits manually to ensure UI updates immediately
        if (creditsToUse > 0) {
          console.log("[Booking Summary] Credits used, manually refreshing credits");
          try {
            await refreshCredits();
            console.log("[Booking Summary] Credits refreshed successfully");
            
            // Add a fallback refresh with delay in case the first one was too fast
            setTimeout(async () => {
              console.log("[Booking Summary] Fallback credits refresh after 1 second");
              try {
                await refreshCredits();
                console.log("[Booking Summary] Fallback credits refresh completed");
              } catch (err) {
                console.error("[Booking Summary] Fallback credits refresh failed:", err);
              }
            }, 1000);
          } catch (err) {
            console.error("[Booking Summary] Error refreshing credits:", err);
          }
        }
        
        // Delay navigation slightly to show fireflies
        setTimeout(() => {
          // Calculate actual amount donated (after credits)
          const actualDonationAmount = Math.max(0, booking.total_price - (creditsToUse || 0));
          
          navigate('/confirmation', { 
            state: { 
              booking: {
                ...booking,
                accommodation: selectedAccommodation.title,
                guests: selectedAccommodation.inventory,
                totalPrice: actualDonationAmount, // Show actual amount donated after credits
                checkIn: selectedCheckInDate,
                checkOut: checkOut
              }
            } 
          });
        }, 1500);
      } catch (err) {
        console.error('[Booking Summary] Error creating booking:', err);
        
        // CRITICAL: Log detailed error for payment without booking
        const errorDetails = {
          paymentIntentId: paymentIntentId || undefined,
          userEmail: userEmail || 'Unknown',
          error: err instanceof Error ? err.message : 'Unknown error',
          errorStack: err instanceof Error ? err.stack : undefined,
          bookingDetails: {
            accommodation: selectedAccommodation.title,
            checkIn: formatInTimeZone(selectedCheckInDate, 'UTC', 'yyyy-MM-dd'),
            checkOut: formatInTimeZone(addDays(selectedCheckInDate, calculateTotalDays(selectedWeeks)-1), 'UTC', 'yyyy-MM-dd'),
            totalPaid: Math.max(0, pricing.totalAmount - (creditsToUse || 0)), // Actual payment amount after credits
            originalTotal: pricing.totalAmount, // Include original total for admin reference
            creditsUsed: creditsToUse > 0 ? creditsToUse : undefined,
            discountCode: appliedDiscount?.code || undefined
          },
          // CRITICAL STATUS TRACKING
          systemStatus: {
            confirmationEmailSent: false, // Will be updated after email attempt
            creditsWereDeducted: false, // Credits only deducted on successful booking insert
            userWillSeeConfirmationPage: true // We navigate to confirmation page anyway
          },
          timestamp: new Date().toISOString()
        };
        
        console.error('[CRITICAL] PAYMENT WITHOUT BOOKING:', errorDetails);
        

        
        // ALWAYS navigate to confirmation page when payment succeeded but booking failed
        console.log('[BookingSummary] Payment succeeded but booking failed - navigating to confirmation page anyway');
        
        // Track status for admin alert
        let confirmationEmailSent = false;
        let creditsWereDeducted = false;
        
        // Try to send confirmation email even though booking failed
        if (userEmail && paymentIntentId) {
          console.log('[BookingSummary] Attempting to send confirmation email despite booking failure');
          try {
            const formattedCheckIn = formatInTimeZone(selectedCheckInDate, 'UTC', 'yyyy-MM-dd');
            const formattedCheckOut = formatInTimeZone(checkOut, 'UTC', 'yyyy-MM-dd');
            
            // Calculate actual payment amount (after credits)
            const actualPaymentAmount = Math.max(0, pricing.totalAmount - (creditsToUse || 0));
            
            // Generate a temporary booking ID for email purposes
            const tempBookingId = `temp-${Date.now()}-${paymentIntentId}`;
            
            const { error: emailError } = await supabase.functions.invoke('send-booking-confirmation', {
              body: { 
                email: userEmail,
                bookingId: tempBookingId,
                checkIn: formattedCheckIn,
                checkOut: formattedCheckOut,
                accommodation: selectedAccommodation.title,
                totalPrice: actualPaymentAmount, // Use actual payment amount after credits
                frontendUrl: window.location.origin
              }
            });
            
            if (emailError) {
              console.error('[BookingSummary] Failed to send confirmation email:', emailError);
              confirmationEmailSent = false;
            } else {
              console.log('[BookingSummary] Confirmation email sent successfully despite booking failure');
              confirmationEmailSent = true;
            }
          } catch (emailErr) {
            console.error('[BookingSummary] Exception while sending confirmation email:', emailErr);
            confirmationEmailSent = false;
          }
        }
        
        // Try to manually deduct credits since payment succeeded but booking failed
        if (creditsToUse > 0) {
          console.log('[BookingSummary] Payment succeeded but booking failed - attempting to manually deduct credits:', creditsToUse);
          try {
            // Get current user for the credit deduction
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: newBalance, error: creditError } = await supabase.rpc('admin_remove_credits', {
                p_user_id: user.id,
                p_amount: creditsToUse,
                p_admin_note: `Credits deducted for successful payment (Payment Intent: ${paymentIntentId}) - booking creation failed and requires manual resolution`
              });
              
              if (creditError) {
                console.error('[BookingSummary] Failed to deduct credits manually:', creditError);
                creditsWereDeducted = false;
              } else {
                console.log('[BookingSummary] Successfully deducted credits manually. New balance:', newBalance);
                creditsWereDeducted = true;
                
                // Refresh credits in the UI to reflect the deduction
                try {
                  await refreshCredits();
                  console.log('[BookingSummary] Credits UI refreshed after manual deduction');
                } catch (refreshErr) {
                  console.error('[BookingSummary] Failed to refresh credits UI:', refreshErr);
                }
              }
            } else {
              console.error('[BookingSummary] No user found for manual credit deduction');
              creditsWereDeducted = false;
            }
          } catch (creditDeductionErr) {
            console.error('[BookingSummary] Exception during manual credit deduction:', creditDeductionErr);
            creditsWereDeducted = false;
          }
        } else {
          // No credits to deduct
          creditsWereDeducted = false;
        }
        
        // Update the original errorDetails with actual status
        const updatedErrorDetails = {
          ...errorDetails,
          systemStatus: {
            confirmationEmailSent,
            creditsWereDeducted,
            userWillSeeConfirmationPage: true
          }
        };
        
        // Check if webhook has already created the booking before sending alert
        let bookingExistsFromWebhook = false;
        if (paymentIntentId) {
          console.log('[BookingSummary] Checking if webhook already created booking...');
          
          // Wait a bit to give webhook time to process
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            bookingExistsFromWebhook = await bookingService.checkBookingByPaymentIntent(paymentIntentId);
            console.log('[BookingSummary] Webhook booking check result:', bookingExistsFromWebhook);
          } catch (checkError) {
            console.error('[BookingSummary] Error checking for webhook booking:', checkError);
            // Continue with alert even if check fails
          }
        }
        
        // Only send admin alert if booking truly doesn't exist
        if (!bookingExistsFromWebhook) {
          console.log('[BookingSummary] Booking does not exist after webhook check, sending admin alert');
          
          // NOW send admin alert with updated status
          try {
            const { data, error } = await supabase.functions.invoke('alert-booking-failure', {
              body: updatedErrorDetails
            });
            
            if (error) {
              throw error;
            }
            
            console.log('[Booking Summary] Admin alert email sent successfully');
          } catch (alertErr) {
            console.error('[Booking Summary] Failed to send admin alert:', alertErr);
            // Still try the old bug report method as fallback
            try {
              const bugReportDescription = `CRITICAL: Payment received but booking creation failed!
          
Payment Intent: ${paymentIntentId || 'N/A'}
User Email: ${userEmail || 'Unknown'}
Accommodation: ${selectedAccommodation.title}
Check-in: ${updatedErrorDetails.bookingDetails.checkIn}
Check-out: ${updatedErrorDetails.bookingDetails.checkOut}
Amount Paid: €${Math.max(0, pricing.totalAmount - (creditsToUse || 0))}
Credits Used: ${creditsToUse}
Discount Code: ${appliedDiscount?.code || 'None'}

SYSTEM STATUS:
- Confirmation Email Sent: ${confirmationEmailSent ? 'YES' : 'NO'}
- Credits Deducted: ${creditsWereDeducted ? 'YES' : 'NO'}
- User Sees Confirmation Page: YES

Error: ${err instanceof Error ? err.message : 'Unknown error'}

Please manually create the booking for this user or process a refund.`;

              await supabase.functions.invoke('submit-bug-report', {
                body: {
                  description: bugReportDescription,
                  stepsToReproduce: `Automatic report: Booking creation failed after successful payment.`,
                  pageUrl: window.location.href,
                  image_urls: null
                }
              });
              console.log('[Booking Summary] Fallback bug report submitted');
            } catch (fallbackErr) {
              console.error('[Booking Summary] Failed to submit fallback bug report:', fallbackErr);
            }
          }
        } else {
          console.log('[BookingSummary] Booking was successfully created by webhook! No alert needed.');
          // Refresh credits since the webhook booking would have used them
          if (creditsToUse > 0) {
            console.log('[BookingSummary] Refreshing credits after webhook booking creation');
            try {
              await refreshCredits();
            } catch (err) {
              console.error('[BookingSummary] Error refreshing credits:', err);
            }
          }
        }
        
        // Create a booking object for the confirmation page
        const actualPaymentAmount = Math.max(0, pricing.totalAmount - (creditsToUse || 0));
        const bookingForConfirmation = {
          id: bookingExistsFromWebhook ? `webhook-booking-${paymentIntentId}` : `pending-booking-${Date.now()}`,
          accommodation: selectedAccommodation.title,
          guests: selectedAccommodation.inventory,
          totalPrice: actualPaymentAmount, // Show actual payment amount after credits
          checkIn: selectedCheckInDate,
          checkOut: checkOut,
          status: 'confirmed',
          created_at: new Date().toISOString(),
          // Add flags to indicate status
          isPendingManualCreation: !bookingExistsFromWebhook,
          manualCreationMessage: bookingExistsFromWebhook 
            ? undefined // No message needed if webhook succeeded
            : 'Your payment was successful and confirmation email has been sent! Our team is finalizing your booking in our system. Note: This booking may not appear in your bookings list immediately but will be processed manually.'
        };
        
        // Navigate to confirmation page with the booking data
        navigate('/confirmation', { 
          state: { 
            booking: bookingForConfirmation
          }
        });
        
        // Clear selections after navigation
        setTimeout(() => {
          onClearWeeks();
          onClearAccommodation();
        }, 1000);
        
        // Exit without throwing error since we handled it gracefully
        return;
      }
    } catch (err) {
      console.error('[BookingSummary] CRITICAL ERROR in booking success handler:', err);
      console.error('[BookingSummary] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        type: typeof err,
        err
      });
      // Don't re-throw any errors - we've handled them gracefully above
      setError('An error occurred. Please try again.');
      setIsBooking(false);
    }
  }, [selectedAccommodation, selectedWeeks, selectedCheckInDate, navigate, pricing.totalAmount, appliedDiscount, creditsToUse, refreshCredits, userEmail, onClearWeeks, onClearAccommodation, bookingService]);

  const handleConfirmClick = async () => {
    console.log('[Booking Summary] Confirm button clicked.');
    console.log('[Booking Summary] handleConfirmClick: Initial selectedCheckInDate:', selectedCheckInDate?.toISOString(), selectedCheckInDate); // ADDED LOG
    setError(null); // Clear previous errors

    if (!validateCheckInDate()) {
      console.warn('[Booking Summary] Confirm FAILED: Check-in date validation failed.');
      return;
    }
    
    if (!selectedAccommodation) {
      console.warn('[Booking Summary] No accommodation selected');
      setError('Please select an accommodation');
      return;
    }
    
    try {
      // Check if the accommodation is still available
      const isAvailable = await validateAvailability();
      if (!isAvailable) {
        console.warn('[Booking Summary] Accommodation is no longer available');
        setError('This accommodation is no longer available for the selected dates');
        return;
      }
      
      // If the final amount is 0 (fully paid with credits), skip payment
      if (finalAmountAfterCredits === 0 && creditsToUse > 0) {
        console.log('[Booking Summary] Total is 0 after credits, skipping payment');
        await handleBookingSuccess();
        return;
      }
      
      // If we have a valid auth token, show the Stripe modal
      if (authToken) {
        console.log('[Booking Summary] Showing Stripe modal');
        setShowStripeModal(true);
      } else {
        console.warn('[Booking Summary] No auth token, redirecting to login');
        setError('Please sign in to continue with your booking');
        navigate('/login', { 
          state: { 
            returnTo: '/book',
            message: 'Please sign in to complete your booking' 
          } 
        });
      }
    } catch (err) {
      console.error('[Booking Summary] Error in confirm click handler:', err);
      setError('An error occurred. Please try again.');
    }
  };

  const handleAdminConfirm = async () => {
    console.log('[Booking Summary] Admin confirm button clicked.');
    console.log('[Booking Summary] handleAdminConfirm: Initial selectedCheckInDate:', selectedCheckInDate?.toISOString(), selectedCheckInDate); // ADDED LOG
    setError(null);

    if (!validateCheckInDate()) {
      console.warn('[Booking Summary] Admin Confirm FAILED: Check-in date validation failed.');
      return;
    }
    
    if (!selectedAccommodation) {
      console.warn('[Booking Summary] No accommodation selected');
      setError('Please select an accommodation');
      return;
    }
    
    try {
      // For admin, we skip payment and go straight to booking success
      await handleBookingSuccess();
    } catch (err) {
      console.error('[Booking Summary] Error in admin confirm handler:', err);
      setError('An error occurred. Please try again.');
    }
  };

  // --- Placeholder Handlers for Discount Code ---
  const handleApplyDiscount = useCallback(async () => {
    const codeToApply = discountCodeInput.trim().toUpperCase(); // Standardize
    if (!codeToApply) return;

    console.log('[BookingSummary] Applying discount code:', codeToApply);
    setIsApplyingDiscount(true);
    setError(null); 
    setDiscountError(null);
    setAppliedDiscount(null); // Clear previous discount first

    try {
      // Get the current session token for authorization
      const sessionResponse = await supabase.auth.getSession();
      const token = sessionResponse?.data?.session?.access_token;

      if (!token) {
          throw new Error('Authentication token not found. Please sign in.');
      }

      // Get Supabase URL from the client
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lpsdzjvyvufwqrnuafqd.supabase.co';
      
      // Use direct fetch instead of Supabase Functions API
      console.log('[BookingSummary] Sending discount code validation request');
      const response = await fetch(`${supabaseUrl}/functions/v1/validate-discount-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: codeToApply })
      });
      
      // Always get the response as text first to properly handle both success and error responses
      const responseText = await response.text();
      console.log('[BookingSummary] Raw response:', responseText);
      
      // Try to parse the response as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('[BookingSummary] Parsed response data:', responseData);
      } catch (parseError) {
        console.error('[BookingSummary] Failed to parse response as JSON:', parseError);
        setDiscountError('Invalid response from server');
        return;
      }
      
      // If response is not ok, handle the error
      if (!response.ok) {
        const errorMessage = responseData?.error || 'Invalid code';
        console.error('[BookingSummary] Error response:', errorMessage);
        setDiscountError(errorMessage);
        return;
      }
      
      // --- Success Case --- 
      if (responseData && responseData.code && typeof responseData.percentage_discount === 'number') {
        console.log("[BookingSummary] code validated successfully:", responseData);
        setAppliedDiscount({
          code: responseData.code,
          percentage_discount: responseData.percentage_discount,
          applies_to: responseData.applies_to || 'total'
        });
        setDiscountCodeInput(''); // Clear input on success
      } else {
        // Malformed success response
        console.warn("[BookingSummary] Discount validation returned unexpected data:", responseData);
        setDiscountError('Invalid response from validation service');
      }
    } catch (error) {
      // This now only catches network errors, not HTTP error responses
      console.error('[BookingSummary] Network error during discount validation:', error);
      setDiscountError(error instanceof Error ? error.message : 'Failed to connect to validation service');
    } finally {
      setIsApplyingDiscount(false);
    }
  }, [discountCodeInput, supabase]);

  const handleRemoveDiscount = useCallback(() => {
    console.log('[BookingSummary] Removing applied discount');
    setAppliedDiscount(null);
    setDiscountCodeInput(''); // Also clear the input maybe?
    setDiscountError(null);
  }, []);
  // --- End Placeholder Handlers ---

  // --- LOGGING: Final Render Values ---
  console.log('[BookingSummary] --- Final Render Values ---');
  console.log('[BookingSummary] Pricing details:', pricing);
  console.log('[BookingSummary] Selected Check-in Date:', selectedCheckInDate?.toISOString());
  console.log('[BookingSummary] Food Contribution:', foodContribution);
  console.log('[BookingSummary] Season Breakdown State:', seasonBreakdownState ? JSON.stringify(seasonBreakdownState) : 'undefined');
  console.log('[BookingSummary] Is Admin:', isAdmin);
  console.log('[BookingSummary] Error state:', error);
  console.log('[BookingSummary] Is Booking state:', isBooking);
  console.log('[BookingSummary] Show Stripe Modal state:', showStripeModal);
  // --- END LOGGING ---

  const fallbackDate = new Date();
  fallbackDate.setUTCHours(0, 0, 0, 0);

  // Helper function to format dates consistently (needed for the modal)
  const formatDateForDisplay = (date: Date): string => {
    return formatInTimeZone(date, 'UTC', 'MMM d, yyyy');
  };

  // Render the component
  return (
    <>
      {/* Celebration fireflies */}
      {showCelebrationFireflies && (
        <Fireflies 
          count={100}
          color="#10b981"
          minSize={1}
          maxSize={4}
          fadeIn={true}
          fadeOut={true}
          duration={3000}
          clickTrigger={false}
          ambient={false}
          className="pointer-events-none z-[70]"
        />
      )}
      
      <AnimatePresence>
        {showStripeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-surface rounded-sm max-w-xl w-full p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-primary">Complete Payment</h3>
                <button
                  onClick={() => setShowStripeModal(false)}
                  className="text-secondary hover:text-secondary-hover"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* --- ADD LOGGING FOR EMAIL BEFORE PASSING --- */}
              {/* {console.log("[BookingSummary] Rendering StripeCheckoutForm, userEmail:", userEmail)} */}
              <StripeCheckoutForm
                authToken={authToken}
                userEmail={userEmail || ''} // Pass email as prop, default to empty string if undefined
                // --- TEST ACCOMMODATION OVERRIDE FOR PAYMENT --- 
                total={
                  selectedAccommodation?.type === 'test' 
                  ? 0.50 // Force 0.50 if it's the test type (Stripe minimum)
                  : testPaymentAmount !== null && isAdmin 
                    ? testPaymentAmount // Otherwise use admin test amount if set
                    : finalAmountAfterCredits // Use amount after credits
                }
                description={`${selectedAccommodation?.title || 'Accommodation'} for ${pricing.totalNights} nights${selectedCheckInDate ? ` from ${selectedCheckInDate.getDate()}. ${selectedCheckInDate.toLocaleDateString('en-US', { month: 'long' })}` : ''}`}
                bookingMetadata={selectedAccommodation && selectedCheckInDate ? {
                  accommodationId: selectedAccommodation.id,
                  checkIn: selectedCheckInDate ? formatInTimeZone(selectedCheckInDate, 'UTC', 'yyyy-MM-dd') : undefined,
                  checkOut: selectedCheckInDate ? formatInTimeZone(addDays(selectedCheckInDate, calculateTotalDays(selectedWeeks)-1), 'UTC', 'yyyy-MM-dd') : undefined,
                  originalTotal: pricing.totalAmount,
                  creditsUsed: creditsToUse > 0 ? creditsToUse : 0,
                  discountCode: appliedDiscount?.code
                } : undefined}
                onSuccess={handleBookingSuccess}
                onClose={() => {
                  console.log('[BookingSummary] StripeCheckoutForm onClose called');
                  setShowStripeModal(false);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary of Stay section - Outer sticky wrapper */}
      <div className="w-full max-w-md lg:max-w-lg mx-auto">

        {/* Actual Content Container (Ensure Transparent Background) */}
        <div className="relative p-3 xs:p-4 sm:p-6 bg-transparent"> 
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-light text-primary">
                Summary of Stay
              </h2>
            </div>
          </div>

          {error && (
            <div className={`mb-6 p-4 rounded-lg flex justify-between items-center font-mono text-xs sm:text-sm ${
              error.includes('payment was successful') 
                ? 'bg-amber-100 text-amber-900 border-2 border-amber-400' 
                : 'bg-error-muted text-error'
            }`}>
              <div>
                {error.includes('payment was successful') && (
                  <div className="font-bold mb-2 text-base">⚠️ Payment Processed - Action Required</div>
                )}
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="ml-4 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {selectedWeeks.length > 0 && (
            <div className="">
              {/* Stay Details Section */}
              <StayDetails selectedWeeks={selectedWeeks} />

              {/* Accommodation Section */}
              {selectedAccommodation && (
                <AccommodationSection 
                  selectedAccommodation={selectedAccommodation}
                  onClearAccommodation={onClearAccommodation}
                />
              )}

              {/* Add thin horizontal line */}
              <hr className="border-t border-[var(--color-text-primary)] my-6 opacity-30" /> {/* Added opacity */}

              {/* NEW Wrapper for Solid Background Sections - Make sure this is TRANSPARENT */}
              <div className="bg-transparent"> {/* Removed mt-6 */}
                {/* Price Breakdown */}
                <PriceBreakdown
                  selectedAccommodation={selectedAccommodation}
                  pricing={pricing}
                  foodContribution={foodContribution}
                  setFoodContribution={setFoodContribution}
                  isStateOfTheArtist={isStateOfTheArtist}
                  selectedWeeks={selectedWeeks}
                  onShowDiscountModal={() => setShowDiscountModal(true)}
                />

                {/* Add HR before Total */}
                <hr className="border-t border-border my-2 opacity-30" /> 

                {/* Total Donated - Shows value being donated to the garden */}
                <div className="pt-4 mt-4">
                  <div className="flex font-mono justify-between items-baseline">
                    <span className="uppercase text-primary font-display text-2xl">Total</span>
                    {/* Show original price if discount applied */}
                    {(appliedDiscount && pricing.appliedCodeDiscountValue > 0) ? (
                        <div className="text-right">
                            <span className="text-sm line-through text-secondary mr-2">
                                {formatPriceDisplay(pricing.subtotal)}
                            </span>
                            <span className="text-2xl font-display text-primary">
                                {formatPriceDisplay(pricing.totalAmount)}
                            </span>
                        </div>
                    ) : (
                        <span className="text-2xl font-display text-primary">
                            {formatPriceDisplay(pricing.totalAmount)}
                        </span>
                    )}
                  </div>
                   <p className="text-sm text-shade-1 mt-1 font-display">
                     Includes accommodation, food, facilities, and discounts.
                   </p>
                </div>



                {/* Discount Code Section */}
                <DiscountCodeSection
                  appliedDiscount={appliedDiscount}
                  discountCodeInput={discountCodeInput}
                  setDiscountCodeInput={setDiscountCodeInput}
                  discountError={discountError}
                  isApplyingDiscount={isApplyingDiscount}
                  onApplyDiscount={handleApplyDiscount}
                  onRemoveDiscount={handleRemoveDiscount}
                />

                {/* Credits Section */}
                <CreditsSection
                  availableCredits={availableCredits}
                  creditsLoading={creditsLoading}
                  creditsEnabled={creditsEnabled}
                  setCreditsEnabled={setCreditsEnabled}
                  creditsToUse={creditsToUse}
                  setCreditsToUse={setCreditsToUse}
                  pricing={pricing}
                  finalAmountAfterCredits={finalAmountAfterCredits}
                />

                {/* --- START: Cancellation Policy Section --- */}
                <div className="pt-2 mt-2">
                  <button
                    onClick={() => setShowCancellationModal(true)}
                    className="text-xs text-shade-2 hover:text-shade-1 underline underline-offset-2 transition-colors font-display"
                  >
                    ► Cancellation Policy
                  </button>
                </div>
                {/* --- END: Cancellation Policy Section --- */}

                {/* Confirm Buttons */}
                <ConfirmButtons
                  isBooking={isBooking}
                  selectedAccommodation={selectedAccommodation}
                  selectedWeeks={selectedWeeks}
                  finalAmountAfterCredits={finalAmountAfterCredits}
                  creditsToUse={creditsToUse}
                  isAdmin={isAdmin}
                  permissionsLoading={permissionsLoading}
                  onConfirm={handleConfirmClick}
                  onAdminConfirm={handleAdminConfirm}
                />
              </div> {/* End of Wrapper (now transparent) */}
            </div>
          )}

          {selectedWeeks.length === 0 && (
            <div className="text-center py-10 bg-surface/50 rounded-sm shadow-sm">
              <Calendar className="w-12 h-12 mx-auto text-secondary mb-4" />
              <p className="text-secondary text-sm">Select your dates to see the summary</p>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Policy Modal */}
      <CancellationPolicyModal
        isOpen={showCancellationModal}
        onClose={() => setShowCancellationModal(false)}
      />

      {/* Discount Modal */}
      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        checkInDate={selectedWeeks[0]?.startDate || fallbackDate}
        checkOutDate={selectedWeeks[selectedWeeks.length - 1]?.endDate || fallbackDate}
        accommodationName={selectedAccommodation?.title || ''}
        basePrice={selectedAccommodation?.base_price || 0}
        calculatedWeeklyPrice={calculatedWeeklyAccommodationPrice}
        averageSeasonalDiscount={seasonBreakdownState && seasonBreakdownState.seasons.length > 0 
          ? Math.round(seasonBreakdownState.seasons.reduce((sum, season) => sum + (season.discount * season.nights), 0) / 
            seasonBreakdownState.seasons.reduce((sum, season) => sum + season.nights, 0) * 100) / 100
          : null}
      />
    </>
  );
}
