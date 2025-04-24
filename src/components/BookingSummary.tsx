import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, ArrowRight, LogOut, Home, Bed, ChevronDown, ChevronUp, Info, Tag, AlertTriangle } from 'lucide-react';
import { useSchedulingRules } from '../hooks/useSchedulingRules';
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown } from '../utils/pricing';
import type { Week } from '../types/calendar';
import type { Accommodation } from '../types';
import { format, addDays, differenceInDays, isSameDay, isBefore } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/BookingService';
import { supabase } from '../lib/supabase';
import { StripeCheckoutForm } from './StripeCheckoutForm';
import { useSession } from '../hooks/useSession';
import { DayPicker } from 'react-day-picker';
import type { DayPickerSingleProps } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { formatDateForDisplay } from '../utils/dates';
import * as Tooltip from '@radix-ui/react-tooltip';
import { calculateTotalNights, calculateDurationDiscountWeeks, calculateTotalDays, calculateTotalWeeksDecimal } from '../utils/dates';
import { DiscountModal } from './DiscountModal';
import { formatInTimeZone } from 'date-fns-tz';

// Define the season breakdown type
export interface SeasonBreakdown {
  hasMultipleSeasons: boolean;
  seasons: Array<{
    name: string;
    discount: number;
    nights: number;
  }>;
}

interface BookingSummaryProps {
  selectedWeeks: Week[];
  selectedAccommodation: Accommodation | null;
  onClearWeeks: () => void;
  onClearAccommodation: () => void;
  seasonBreakdown?: SeasonBreakdown; // Optional for backward compatibility
  calculatedWeeklyAccommodationPrice: number | null;
}

// Helper function to format numbers without decimal points when they're integers
const formatNumber = (num: number, decimals: number = 1): string => {
  // Check if the number is an integer
  if (Number.isInteger(num)) {
    return num.toString();
  }
  return num.toFixed(decimals);
};

// Helper function to format price display, showing "Free" for zero
// UPDATED: Dont round
const formatPriceDisplay = (price: number): React.ReactNode => {
  console.log('[formatPriceDisplay] Input price:', price);
  if (price === 0) {
    return <span className="text-accent-primary text-xl font-mono">Free</span>;
  }

  // Check if the price is a whole number
  if (Number.isInteger(price)) {
    return `€${price}`;
  }

  // Return the price with two decimal places
  return `€${price.toFixed(2)}`;
};

// Helper function to calculate pricing details
interface PricingDetails {
  totalNights: number;
  nightlyAccommodationRate: number;
  baseAccommodationRate: number;
  effectiveBaseRate: number;
  totalAccommodationCost: number;
  totalFoodAndFacilitiesCost: number;
  subtotal: number;
  durationDiscountAmount: number;
  durationDiscountPercent: number;
  weeksStaying: number; // This will now store the DISPLAY (rounded) weeks
  totalAmount: number;
  seasonalDiscount: number;
}

// === REVISED HELPER ===
// Accepts pre-calculated rounded weeks for consistency with display
const calculateBaseFoodCost = (
  totalNights: number, // Pass totalNights in
  displayWeeks: number, // Use the rounded weeks for calculation
  foodContribution?: number | null
): { totalBaseFoodCost: number; effectiveWeeklyRate: number } => {
  console.log('[calculateBaseFoodCost] Inputs:', {
    totalNights, // Log received nights
    displayWeeks, // Log received rounded weeks
    foodContribution,
  });

  // Determine BASE weekly food & facilities rate
  let weeklyFoodRate: number;
  const defaultWeeklyRate = 345; // Default weekly rate

  if (foodContribution !== null && foodContribution !== undefined) {
    weeklyFoodRate = foodContribution;
    console.log('[calculateBaseFoodCost] Using food contribution for weekly rate:', { foodContribution, weeklyFoodRate });
  } else {
    weeklyFoodRate = defaultWeeklyRate;
    console.log('[calculateBaseFoodCost] Using default weekly food rate:', weeklyFoodRate);
  }

  // === Use the provided DISPLAY (rounded) weeks for BASE cost calculation ===
  const totalBaseFoodCost = weeklyFoodRate * displayWeeks; // Use passed-in rounded weeks
  console.log('[calculateBaseFoodCost] Results:', { displayWeeks, weeklyFoodRate, totalBaseFoodCost });

  return {
    // totalNights is calculated outside now
    totalBaseFoodCost, // Return the undiscounted cost calculated with rounded weeks
    effectiveWeeklyRate: weeklyFoodRate // Return the base rate used
  };
};

// Helper function to format date ranges
const formatDateRange = (week: Week): string => {
  return `${format(week.startDate, 'MMM d')} - ${format(week.endDate, 'MMM d')}`;
};

// Helper function to format overall date range
// For a date range like "Jul 1 → Jul 14", this represents 13 nights
// The number of nights is calculated as (end date - start date) in days
const formatOverallDateRange = (selectedWeeks: Week[]): string => {
  if (selectedWeeks.length === 0) return '';
  
  // Determine the effective start date (could be a selected flex date)
  const firstWeek = selectedWeeks[0];
  const effectiveStartDate = firstWeek.selectedFlexDate || firstWeek.startDate;

  const lastDate = selectedWeeks[selectedWeeks.length - 1].endDate;
  
  // Use formatInTimeZone for consistent UTC display
  return `${formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d')} → ${formatInTimeZone(lastDate, 'UTC', 'MMM d')}`;
};

// Helper function to format date with day of week (Use UTC)
const formatDateWithDay = (date: Date): string => {
  return formatInTimeZone(date, 'UTC', 'EEEE, MMMM d');
};

// Helper function to add ordinal suffix to day of month (Use UTC)
const formatDateWithOrdinal = (date: Date): string => {
  // Get UTC date parts
  const day = date.getUTCDate();
  const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)];
  return formatInTimeZone(date, 'UTC', 'EEEE, MMMM') + ' ' + day + suffix;
};

// --- Added Applied Discount Type ---
interface AppliedDiscount {
  code: string;
  percentage_discount: number;
}
// --- End Added Type ---

export function BookingSummary({
  selectedWeeks,
  selectedAccommodation,
  onClearWeeks,
  onClearAccommodation,
  seasonBreakdown: initialSeasonBreakdown,
  calculatedWeeklyAccommodationPrice
}: BookingSummaryProps) {
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

  // --- State for Discount Code ---
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  // --- End Discount Code State ---

  // State for internally calculated season breakdown
  const [seasonBreakdownState, setSeasonBreakdownState] = useState<SeasonBreakdown | undefined>(initialSeasonBreakdown);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
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
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' ||
    session?.user?.email === 'redis213@gmail.com' ||
    session?.user?.email === 'dawn@thegarden.pt' ||
    session?.user?.email === 'simone@thegarden.pt' ||
    session?.user?.email === 'samjlloa@gmail.com' ||
    session?.user?.email === 'redis213+testadmin@gmail.com';
  const userEmail = session?.user?.email; // Get user email

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

  // Calculate pricing details - MEMOIZED (applying duration discount to food)
  const pricing = useMemo((): PricingDetails => {
    console.log('[BookingSummary] --- Recalculating Pricing (useMemo) ---');
    console.log('[BookingSummary] useMemo Inputs:', {
      selectedWeeksLength: selectedWeeks.length,
      selectedAccommodationId_Prop: selectedAccommodation?.id,
      calculatedWeeklyAccommodationPrice_Prop: calculatedWeeklyAccommodationPrice,
      foodContribution,
      appliedDiscount,
    });

    // === Calculate fundamental values: nights, complete weeks (for discount), exact decimal weeks ===
    const totalNights = calculateTotalNights(selectedWeeks);
    const completeWeeks = calculateDurationDiscountWeeks(selectedWeeks); // Uses floor(days/7)
    const exactWeeksDecimal = calculateTotalWeeksDecimal(selectedWeeks); // Returns full precision days/7

    // === NEW: Calculate weeks rounded for display (WYSIWYG) ===
    const displayWeeks = selectedWeeks.length > 0 ? Math.round(exactWeeksDecimal * 10) / 10 : 0;
    console.log('[BookingSummary] useMemo: Calculated Weeks:', { totalNights, completeWeeks, exactWeeksDecimal, displayWeeks });

    // === Calculate Accommodation Cost using DISPLAY (rounded) weeks for WYSIWYG ===
    const weeklyAccPrice = calculatedWeeklyAccommodationPrice ?? 0;
    // Use DISPLAY weeks here for WYSIWYG consistency with the label
    const totalAccommodationCost = parseFloat((weeklyAccPrice * displayWeeks).toFixed(2)); // Changed exactWeeksDecimal to displayWeeks
    console.log('[BookingSummary] useMemo: Calculated Accommodation Cost (using DISPLAY weeks):', { weeklyAccPrice, displayWeeks, totalAccommodationCost });
    // VERIFICATION LOG (keeping for now, should show integer * rounded_decimal)
    console.log('[BookingSummary] useMemo: VERIFYING Cost Calc:', {
        integerWeeklyRate: weeklyAccPrice, // Should be integer
        decimalWeeks: exactWeeksDecimal, // Should be decimal
        calculatedTotal: totalAccommodationCost // Result of integer * decimal
    });

    // === Calculate BASE Food Cost using DISPLAY (rounded) weeks ===
    const { totalBaseFoodCost, effectiveWeeklyRate } = calculateBaseFoodCost(
        totalNights, // Pass totalNights
        displayWeeks, // Pass rounded display weeks
        foodContribution
    );
    console.log('[BookingSummary] useMemo: Calculated Base Food Cost (based on rounded display weeks):', { totalBaseFoodCost, effectiveWeeklyRate });

    // === Determine Duration Discount % using COMPLETE weeks ===
    const rawDurationDiscountPercent = getDurationDiscount(completeWeeks);
    // === NEW: Round the discount factor to match display (WYSIWYG) ===
    console.log('[BookingSummary] useMemo: Determined Duration Discount % (using complete weeks):', { rawDurationDiscountPercent });

    // === Apply ROUNDED Discount % to BASE Food Cost (which was calculated using rounded weeks) ===
    // 1. Calculate the effective *integer* weekly F&F cost *after* discount (matching slider display)
    const baseWeeklyRateForCalc = foodContribution ?? (totalNights <= 6 ? 345 : 240); // Get base rate from slider or default
    const displayedWeeklyFFCost = Math.round(baseWeeklyRateForCalc * (1 - rawDurationDiscountPercent));
    // 2. Multiply this displayed weekly cost by the displayed number of weeks
    const finalFoodCost = parseFloat((displayedWeeklyFFCost * displayWeeks).toFixed(2));
    // 3. Recalculate the discount amount based on the difference (for display/info purposes)
    const foodDiscountAmount = parseFloat((totalBaseFoodCost - finalFoodCost).toFixed(2)); // Base cost (base rate * display weeks) - final cost

    console.log('[BookingSummary] useMemo: Calculated Final Food Cost (WYSIWYG):', { 
      baseWeeklyRateForCalc,
      rawDurationDiscountPercent, 
      displayedWeeklyFFCost, // Integer weekly cost after discount
      displayWeeks, // Decimal weeks display
      finalFoodCost, // displayedWeeklyFFCost * displayWeeks
      totalBaseFoodCost, // For comparison
      foodDiscountAmount // Recalculated difference
    });

    // 4. Combine results
    const subtotal = parseFloat((+totalAccommodationCost + +finalFoodCost).toFixed(2));
    console.log('[BookingSummary] useMemo: Calculated Subtotal:', { totalAccommodationCost, finalFoodCost, subtotal });

    // --- START: Apply Discount Code --- 
    let finalTotalAmount = subtotal;
    let discountCodeAmount = 0;

    if (appliedDiscount && subtotal > 0) {
        const discountPercentage = appliedDiscount.percentage_discount / 100;
        discountCodeAmount = parseFloat((subtotal * discountPercentage).toFixed(2));
        finalTotalAmount = parseFloat((subtotal - discountCodeAmount).toFixed(2));
        // Ensure total doesn't go below zero, although unlikely with percentage discounts
        if (finalTotalAmount < 0) finalTotalAmount = 0;

        console.log('[BookingSummary] useMemo: Applied Discount Code:', {
            code: appliedDiscount.code,
            percentage: appliedDiscount.percentage_discount,
            subtotalBeforeDiscount: subtotal,
            discountCodeAmountApplied: discountCodeAmount,
            finalTotalAmountAfterDiscount: finalTotalAmount
        });
    } else {
         console.log('[BookingSummary] useMemo: No discount code applied or subtotal is zero.');
    }
    // --- END: Apply Discount Code ---

    // 5. Construct the final object
    const calculatedPricingDetails: PricingDetails = {
      totalNights,
      totalAccommodationCost,
      totalFoodAndFacilitiesCost: finalFoodCost,
      subtotal,
      totalAmount: finalTotalAmount,
      weeksStaying: displayWeeks,
      effectiveBaseRate: effectiveWeeklyRate,
      nightlyAccommodationRate: totalNights > 0 ? +(totalAccommodationCost / totalNights).toFixed(2) : 0,
      baseAccommodationRate: selectedAccommodation?.base_price || 0,
      durationDiscountAmount: foodDiscountAmount,
      durationDiscountPercent: rawDurationDiscountPercent * 100,
      seasonalDiscount: 0,
    };

    // ADDED LOG BLOCK: Values right before returning details
    console.log('[BookingSummary] useMemo: Final Calculation Values for Food Cost', {
      displayWeeks, // The rounded weeks used
      foodContribution, // The input from the slider
      totalBaseFoodCost, // displayWeeks * foodContribution
      completeWeeks, // For discount lookup
      rawDurationDiscountPercent, // Raw discount %
      finalFoodCost_unrounded: finalFoodCost, // Base * (1 - Discount) BEFORE final display rounding
    });

    // --- START TEST ACCOMMODATION OVERRIDE ---
    if (selectedAccommodation?.type === 'test') {
      console.log('[BookingSummary] useMemo: OVERRIDING costs for TEST accommodation.');
      calculatedPricingDetails.totalFoodAndFacilitiesCost = 0;
      calculatedPricingDetails.subtotal = calculatedPricingDetails.totalAccommodationCost; // Keep accom cost, just zero out food
      calculatedPricingDetails.totalAmount = calculatedPricingDetails.totalAccommodationCost; // Total is just accom cost
      calculatedPricingDetails.durationDiscountAmount = 0; // No food discount applicable
    }
    // --- END TEST ACCOMMODATION OVERRIDE ---

    console.log('[BookingSummary] useMemo: Pricing calculation COMPLETE. Result:', calculatedPricingDetails);
    console.log('[BookingSummary] --- Finished Pricing Recalculation (useMemo) ---');
    return calculatedPricingDetails;

  }, [selectedWeeks, calculatedWeeklyAccommodationPrice, foodContribution, selectedAccommodation, appliedDiscount]);

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
    try {
      if (!selectedAccommodation || selectedWeeks.length === 0 || !selectedCheckInDate) {
        console.error('[Booking Summary] Missing required info for booking success:', { selectedAccommodation: !!selectedAccommodation, selectedWeeks: selectedWeeks.length > 0, selectedCheckInDate: !!selectedCheckInDate });
        throw new Error('Missing required booking information');
      }

      // Calculate check-out date based on the selected check-in date
      const totalDays = calculateTotalDays(selectedWeeks);
      const checkOut = addDays(selectedCheckInDate, totalDays-1);

      console.log('[Booking Summary] Starting booking process...');
      console.log('[Booking Summary] handleBookingSuccess: Raw Dates:', { // ADDED LOG BLOCK
        selectedCheckInDate_ISO: selectedCheckInDate.toISOString(),
        selectedCheckInDate_Raw: selectedCheckInDate,
        checkOut_ISO: checkOut.toISOString(),
        checkOut_Raw: checkOut
      });
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
        const bookingPayload: any = {
          accommodationId: selectedAccommodation.id,
          checkIn: formattedCheckIn,
          checkOut: formattedCheckOut,
          totalPrice: roundedTotal // Send the final price calculated by the frontend
        };

        if (appliedDiscount?.code) {
            bookingPayload.appliedDiscountCode = appliedDiscount.code;
            console.log("[Booking Summary] Adding applied discount code to booking payload:", appliedDiscount.code);
        }

        const booking = await bookingService.createBooking(bookingPayload);

        console.log("[Booking Summary] Booking created:", booking);
        
        // Updated navigation to match the route in AuthenticatedApp.tsx
        navigate('/confirmation', { 
          state: { 
            booking: {
              ...booking,
              accommodation: selectedAccommodation.title,
              guests: selectedAccommodation.capacity,
              totalPrice: roundedTotal, // Use rounded total
              checkIn: selectedCheckInDate,
              checkOut: checkOut
            }
          } 
        });
      } catch (err) {
        console.error('[Booking Summary] Error creating booking:', err);
        setError('Failed to create booking. Please try again.');
        setIsBooking(false);
      }
    } catch (err) {
      console.error('[Booking Summary] Error in booking success handler:', err);
      setError('An error occurred. Please try again.');
      setIsBooking(false);
    }
  }, [selectedAccommodation, selectedWeeks, selectedCheckInDate, navigate, pricing.totalAmount, appliedDiscount]);

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
        const errorMessage = responseData?.error || 'Invalid discount code';
        console.error('[BookingSummary] Error response:', errorMessage);
        setDiscountError(errorMessage);
        return;
      }
      
      // --- Success Case --- 
      if (responseData && responseData.code && typeof responseData.percentage_discount === 'number') {
        console.log("[BookingSummary] Discount code validated successfully:", responseData);
        setAppliedDiscount({
          code: responseData.code,
          percentage_discount: responseData.percentage_discount
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

  // --- Calculate display weeks using utility function ---
  // --- Use DECIMAL weeks for display --- 
  const totalWeeksDisplay = calculateTotalWeeksDecimal(selectedWeeks);
  console.log('[BookingSummary] Calculated display weeks (decimal):', { totalWeeksDecimal: totalWeeksDisplay });
  // --- END Calculation ---

  const fallbackDate = new Date();
  fallbackDate.setUTCHours(0, 0, 0, 0);

  // Render the component
  return (
    <>
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
              className="bg-surface rounded-lg max-w-xl w-full p-6"
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
              {console.log("[BookingSummary] Rendering StripeCheckoutForm, userEmail:", userEmail)}
              <StripeCheckoutForm
                authToken={authToken}
                userEmail={userEmail || ''} // Pass email as prop, default to empty string if undefined
                // --- TEST ACCOMMODATION OVERRIDE FOR PAYMENT --- 
                total={
                  selectedAccommodation?.type === 'test' 
                  ? 0.50 // Force 0.50 if it's the test type (Stripe minimum)
                  : testPaymentAmount !== null && isAdmin 
                    ? testPaymentAmount // Otherwise use admin test amount if set
                    : pricing.totalAmount // Otherwise use the calculated total
                }
                description={`${selectedAccommodation?.title || 'Accommodation'} for ${pricing.totalNights} nights`}
                onSuccess={handleBookingSuccess}
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
            <div className="mb-6 p-4 bg-error-muted text-error rounded-lg flex justify-between items-center font-mono text-xs sm:text-sm">
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {selectedWeeks.length > 0 && (
            <div className="">
              {/* Stay Details Section - Outer div handles layout/animation */}
              {/* REMOVED visuals, ADDED mb-6 */}
              <motion.div 
                className="relative mb-6" 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {/* Middle div handles border, padding, visuals */}
                <div className="relative p-4 sm:p-5 rounded-xl border border-border/50 shadow-sm overflow-hidden bg-transparent">
                  {/* Inner Blur Layer */}
                  <div className="absolute inset-0 -z-10 backdrop-blur-sm bg-surface/50 rounded-xl"></div>

                  {/* Clear Button (relative to middle div) */}
                  <button
                    onClick={onClearWeeks}
                    className="absolute top-0.5 right-0.5 p-1.5 text-secondary hover:text-error hover:bg-error-muted-hover rounded-md transition-colors z-20" /* Ensure button is above content */
                  >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Clear Selected Dates</span>
                  </button>

                  {/* Content Wrapper (maybe add relative z-10 if needed) */}
                  <div className="relative z-10 space-y-4 sm:space-y-5"> 
                    {/* Arrival Information */}
                    <div className="border border-border rounded-lg shadow-sm p-3 sm:p-4 bg-card-highlight">
                      <h4 className="font-medium text-primary mb-2 font-mono text-lg sm:text-xl">Arrive By</h4>
                      <div className="space-y-1">
                        <p className="text-accent-primary text-sm font-mono">{formatDateWithDay(selectedWeeks[0].startDate)}</p>
                        <p className="text-accent-primary text-sm font-mono">2PM-6PM</p>
                      </div>
                    </div>
                    
                    {/* Departure Information */}
                    <div className="border border-border rounded-lg shadow-sm p-3 sm:p-4 bg-card-highlight">
                      <h4 className="font-medium text-primary mb-2 font-mono text-lg sm:text-xl">Begone by</h4>
                      <div className="space-y-1">
                        <p className="text-secondary text-sm font-mono">{formatDateWithOrdinal(selectedWeeks[selectedWeeks.length - 1].endDate)}</p>
                        <p className="text-secondary text-sm font-mono">11AM</p>
                      </div>
                    </div>
                    
                    {/* Duration */}
                    <div className="p-4 rounded-lg border border-border bg-card-highlight">
                      <div className="hidden xl:flex xl:justify-between xl:items-center">
                        <div className="w-full text-center">
                          <span className="text-accent-primary text-lg sm:text-xl font-medium font-mono">
                            {formatNumber(totalWeeksDisplay)} {totalWeeksDisplay === 1 ? 'week' : 'weeks'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center xl:hidden">
                        <div className="p-2.5 rounded-lg mr-3 flex-shrink-0 self-start mt-1">
                          <Home className="w-5 h-5 text-accent-primary" />
                        </div>
                        <div className="">
                          <h4 className="font-medium text-primary font-mono text-lg">Total Stay</h4>
                          <p className="text-accent-primary text-sm font-mono mt-0.5">{pricing.totalNights} nights</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Accommodation Section - Outer div handles layout/animation */}
              {selectedAccommodation && (
                /* REMOVED visuals, ADDED mt-6 */
                <motion.div 
                  className="relative mt-6" 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Middle div handles border, padding, visuals */}
                  <div className="relative p-4 sm:p-5 rounded-lg border border-border/50 shadow-sm bg-transparent overflow-hidden"> {/* Added overflow-hidden here too */} 
                    {/* Inner Blur Layer */}
                    <div className="absolute inset-0 -z-10 backdrop-blur-sm bg-surface/50 rounded-lg"></div>
                    
                    {/* Clear Button (relative to middle div) */}
                    <button
                      onClick={onClearAccommodation}
                      className="absolute top-3 right-3 p-1.5 text-secondary hover:text-error hover:bg-error-muted-hover rounded-md transition-colors z-20" /* Ensure button is above content */
                    >
                      <X className="w-4 h-4" />
                      <span className="sr-only">Clear Selected Accommodation</span>
                    </button>

                    {/* Content Wrapper (maybe add relative z-10 if needed) */} 
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg sm:text-xl text-primary flex items-center font-mono">
                          Thy Kingdom
                        </h3>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="p-3 sm:p-4 text-sm rounded-lg border border-border bg-card-highlight">
                          <div className="text-center">
                            <span className="text-accent-primary font-medium font-mono">
                              {selectedAccommodation.title === 'Van Parking' || 
                               selectedAccommodation.title === 'Your Own Tent' || 
                               selectedAccommodation.title === 'Staying with somebody' || 
                               selectedAccommodation.title === 'The Hearth' 
                               ? selectedAccommodation.title
                               : `The ${selectedAccommodation.title}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* NEW Wrapper for Solid Background Sections - Make sure this is TRANSPARENT */}
              <div className="bg-transparent mt-6"> 
                {/* Price Breakdown */}
                <div className="border-t border-border pt-3 sm:pt-4"> 
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-primary font-mono text-lg sm:text-xl">Price Breakdown</h3>
                    <Tooltip.Provider delayDuration={50} skipDelayDuration={0} disableHoverableContent={true}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent event bubbling
                              setShowDiscountModal(true);
                            }}
                            className="p-1.5 text-secondary hover:text-[var(--color-accent-primary)] hover:bg-accent-muted rounded-md transition-colors"
                          >
                            <Info className="w-4 h-4" />
                            <span className="sr-only">View Discount Details</span>
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="tooltip-content !font-mono"
                            sideOffset={5}
                            side="top"
                            align="end"
                          >
                            <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                            <span className="text-white text-sm">See discounts applied</span>
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedAccommodation ? (
                      <div className="flex justify-between gap-x-4 items-baseline">
                        <span className="text-sm text-secondary font-mono">
                          Accommodation <span className="whitespace-nowrap">({formatNumber(pricing.weeksStaying)} {pricing.weeksStaying === 1 ? 'week' : 'weeks'})</span>
                        </span>
                        <span className="text-primary font-mono text-sm">{formatPriceDisplay(pricing.totalAccommodationCost)}</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline min-h-[1.25rem]">
                        <span className="text-sm text-secondary font-mono italic">No accommodation selected</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between gap-x-4 items-baseline">
                      <Tooltip.Provider delayDuration={50} skipDelayDuration={0} disableHoverableContent={true}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <span className="text-sm text-secondary flex items-center cursor-help font-mono" onClick={(e) => e.stopPropagation()}>
                              Food & Facilities
                              <Info className="w-3 h-3 ml-1 opacity-70" />
                            </span>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              className="tooltip-content !font-mono text-sm"
                              sideOffset={5}
                              side="top"
                              align="end"
                            >
                              <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                              <span className="text-white">Community meals & operations costs</span>
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                      <span className="text-primary font-mono text-sm">{formatPriceDisplay(pricing.totalFoodAndFacilitiesCost)}</span>
                    </div>

                    {/* Optional Contribution Slider */}
                    {foodContribution !== null && selectedWeeks.length > 0 && (
                      <div className="pt-4">
                        <div className="flex justify-between items-center mb-2">
                           <label htmlFor="food-contribution" className="text-secondary font-mono text-sm">Contribution</label>
                            <Tooltip.Provider delayDuration={50} skipDelayDuration={0} disableHoverableContent={true}>
                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                        <button 
                                          className="text-secondary hover:text-secondary-hover"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                            <Info className="w-4 h-4" />
                                        </button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content
                                            sideOffset={5}
                                            className="tooltip-content !font-mono text-sm"
                                            side="top"
                                            align="end"
                                        >
                                            <Tooltip.Arrow className="tooltip-arrow" width={11} height={5} />
                                            Adjust your contribution based on your means. Minimum varies by stay length.
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            </Tooltip.Provider>
                        </div>
                        <input
                          id="food-contribution"
                          type="range"
                          min={pricing.totalNights <= 6 ? 345 : 240} 
                          max={390} 
                          value={foodContribution ?? (pricing.totalNights <= 6 ? 345 : 240)}
                          onChange={(e) => setFoodContribution(Number(e.target.value))}
                          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent-primary"
                        />
                         <div className="flex justify-between text-xs text-secondary mt-1 font-mono">
                            <span>
                              Min: €{Math.round((pricing.totalNights <= 6 ? 345 : 240) * (1 - pricing.durationDiscountPercent / 100))}
                            </span>
                            <span className="font-medium text-primary text-sm"> 
                               €{Math.round((foodContribution ?? (pricing.totalNights <= 6 ? 345 : 240)) * (1 - pricing.durationDiscountPercent / 100))} / week 
                            </span>
                            <span>
                              Max: €{Math.round(390 * (1 - pricing.durationDiscountPercent / 100))}
                            </span>
                         </div>
                         {pricing.durationDiscountPercent > 0 && (
                            <p className="text-sm text-secondary mt-1 text-center font-mono">
                                Duration discount of {pricing.durationDiscountPercent.toFixed(0)}% applied.
                            </p>
                         )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Final Total */}
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex font-mono justify-between items-baseline">
                    <span className="text-xl font-semibold text-primary">Total</span>
                    {/* --- UPDATED: Show original price if discount applied --- */}
                    {appliedDiscount ? (
                        <div className="text-right">
                            <span className="text-sm line-through text-secondary mr-2">
                                {formatPriceDisplay(pricing.subtotal)}
                            </span>
                            <span className="text-lg font-semibold text-primary">
                                {formatPriceDisplay(pricing.totalAmount)}
                            </span>
                        </div>
                    ) : (
                        <span className="text-lg font-semibold text-primary">
                            {formatPriceDisplay(pricing.totalAmount)}
                        </span>
                    )}
                    {/* --- End Update --- */}
                  </div>
                   <p className="text-sm text-secondary mt-1 font-mono">Includes accommodation, food, facilities, and discounts.</p>
                </div>

                {/* --- START: Discount Code Section --- */} 
                <div className="border-t border-border pt-4 mt-4 font-mono">
                  {!appliedDiscount ? (
                    <div>
                      <label htmlFor="discount-code" className="block text-sm font-medium text-secondary mb-1">Discount Code</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          id="discount-code"
                          value={discountCodeInput}
                          onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                          className="flex-grow px-3 py-2 bg-[var(--color-input-bg)] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent text-primary placeholder-secondary-muted text-sm disabled:opacity-50"
                          placeholder="Enter code"
                          disabled={isApplyingDiscount}
                        />
                        <button
                          onClick={handleApplyDiscount}
                          disabled={isApplyingDiscount || !discountCodeInput.trim()}
                          className="px-4 py-2 bg-secondary-muted text-white rounded-md hover:bg-secondary-muted-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-muted text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isApplyingDiscount ? 'Applying...' : 'Apply'}
                        </button>
                      </div>
                      {discountError && (
                         <div className="mt-2 text-xs text-error flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>{discountError}</span>
                         </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-success-muted rounded-md border border-success">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-sm text-success">
                                <Tag className="w-4 h-4" />
                                <span>Applied: <strong>{appliedDiscount.code}</strong> (-{appliedDiscount.percentage_discount}%)</span>
                            </div>
                            <button 
                                onClick={handleRemoveDiscount}
                                className="p-1 text-success hover:text-error hover:bg-error-muted rounded-full text-xs"
                                title="Remove discount code"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                  )}
                </div>
                {/* --- END: Discount Code Section --- */} 

                {/* Confirm Button */}
                <div className="mt-6 font-mono sm:mt-8">
                  <button
                    onClick={handleConfirmClick}
                    disabled={isBooking || !selectedAccommodation || selectedWeeks.length === 0}
                    className={`w-full flex items-center justify-center pixel-corners--wrapper relative overflow-hidden px-6 py-3.5 sm:py-4 text-lg font-medium rounded-md transition-colors duration-200
                      ${
                        isBooking || !selectedAccommodation || selectedWeeks.length === 0
                          ? 'bg-border text-secondary cursor-not-allowed'
                          : 'bg-accent-primary text-stone-800 hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary'
                      }`}
                  >
                    <span className="pixel-corners--content 2xl:text-2xl">
                      {isBooking ? 'Processing...' : 'Confirm & Pay'}
                      
                    </span>
                  </button>
                  
                  {isAdmin && (
                    <button
                      onClick={handleAdminConfirm}
                      disabled={isBooking || !selectedAccommodation || selectedWeeks.length === 0}
                      className={`w-full mt-3 flex items-center justify-center pixel-corners--wrapper relative overflow-hidden px-6 py-3.5 sm:py-4 text-lg font-medium rounded-md transition-colors duration-200
                        ${isBooking || !selectedAccommodation || selectedWeeks.length === 0
                          ? 'bg-border text-secondary cursor-not-allowed'
                          : 'bg-secondary-muted text-white hover:bg-secondary-muted-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-muted'
                        }`}
                    >
                      <span className="pixel-corners--content 2xl:text-2xl">
                         {isBooking ? 'Confirming...' : <span>Admin Confirm<br />(No Payment)</span>}
                      </span>
                    </button>
                  )}
                </div>
              </div> {/* End of Wrapper (now transparent) */}
            </div>
          )}

          {selectedWeeks.length === 0 && (
            <div className="text-center py-10 bg-surface/50 rounded-xl shadow-sm">
              <Calendar className="w-12 h-12 mx-auto text-secondary mb-4" />
              <p className="text-secondary text-sm">Select your dates to see the summary</p>
            </div>
          )}
        </div>
      </div>

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
          ? seasonBreakdownState.seasons.reduce((sum, season) => sum + (season.discount * season.nights), 0) / 
            seasonBreakdownState.seasons.reduce((sum, season) => sum + season.nights, 0)
          : null}
      />
    </>
  );
}
