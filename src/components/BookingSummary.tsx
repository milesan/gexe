import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, ArrowRight, LogOut, Sun, Moon, Home, Bed, ChevronDown, ChevronUp, Percent, Info } from 'lucide-react';
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
import { calculateTotalNights, calculateDurationDiscountWeeks } from '../utils/dates';
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
}

// Helper function to format numbers without decimal points when they're integers
const formatNumber = (num: number, decimals: number = 1): string => {
  // Check if the number is an integer
  if (Number.isInteger(num)) {
    return num.toString();
  }
  return num.toFixed(decimals);
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
  weeksStaying: number;
  totalAmount: number;
  totalAmountInCents: number;
  seasonalDiscount: number;
}

const calculatePricing = (
  selectedWeeks: Week[],
  selectedAccommodation: Accommodation | null,
  seasonBreakdown?: SeasonBreakdown,
  foodContribution?: number | null
): PricingDetails => {
  // Log inputs to the pricing function
  console.log('[calculatePricing] Inputs:', {
    selectedWeeksCount: selectedWeeks.length,
    selectedAccommodationId: selectedAccommodation?.id,
    seasonBreakdownExists: !!seasonBreakdown,
    foodContribution,
    seasonBreakdownDetails: seasonBreakdown ? JSON.stringify(seasonBreakdown) : 'undefined',
  });

  // Calculate total nights
  const totalNights = calculateTotalNights(selectedWeeks);
  
  // Get base accommodation rate from the selected accommodation
  const baseAccommodationRate = selectedAccommodation?.base_price || 0;

  console.log('[calculatePricing] Base accommodation rate:', baseAccommodationRate);
  
  // Calculate seasonal discount and total accommodation cost
  let baseAccommodationCostWithDiscount = 0;
  
  if (seasonBreakdown && seasonBreakdown.seasons && seasonBreakdown.seasons.length > 0 && baseAccommodationRate > 0) {
    console.log('[calculatePricing] Applying seasonal breakdown for cost calculation:', seasonBreakdown);
    // Calculate cost based on the provided breakdown's seasons
    baseAccommodationCostWithDiscount = seasonBreakdown.seasons.reduce((acc, season) => {
      const nightlyRate = baseAccommodationRate / 6;
      const seasonCost = nightlyRate * (1 - season.discount) * season.nights;
       console.log(`[calculatePricing] Season segment: ${season.name}, Nights: ${season.nights}, Discount: ${season.discount}, Nightly Rate: ${nightlyRate.toFixed(2)}, Segment Cost: ${seasonCost.toFixed(2)}`);
      return acc + seasonCost;
    }, 0);
     console.log('[calculatePricing] Total cost after seasonal breakdown:', baseAccommodationCostWithDiscount.toFixed(2));
  } else if (selectedAccommodation && totalNights > 0) {
    console.log('[calculatePricing] No valid seasonal breakdown applied. Calculating base cost.');
    const nightlyRate = baseAccommodationRate / 6;
    baseAccommodationCostWithDiscount = nightlyRate * totalNights;
  } else {
    baseAccommodationCostWithDiscount = 0;
  }
  // Ensure the result has max 2 decimal places, handle potential floating point issues
  baseAccommodationCostWithDiscount = +(baseAccommodationCostWithDiscount.toFixed(2));
  
  // Calculate duration discount using the utility function
  const completeWeeks = calculateDurationDiscountWeeks(selectedWeeks);
  const durationDiscount = getDurationDiscount(completeWeeks);
  console.log('[calculatePricing] Duration discount:', { completeWeeks, durationDiscount });
  
  // Apply duration discount to accommodation cost
  const accommodationWithDurationDiscount = +(baseAccommodationCostWithDiscount * (1 - durationDiscount)).toFixed(2);
  
  // Calculate nightly rate for display purposes only
  const nightlyAccommodationRate = baseAccommodationCostWithDiscount > 0 
    ? totalNights <= 6 
      ? baseAccommodationCostWithDiscount // For 6 nights or less, use the rate directly
      : +(baseAccommodationCostWithDiscount / totalNights).toFixed(2) // For longer stays, divide by total nights
    : 0;

  // Determine food & facilities rate based on contribution or default
  let nightlyFoodRate: number;
  
  if (foodContribution !== null && foodContribution !== undefined) {
    nightlyFoodRate = foodContribution / 6;
  } else {
    // Use default base rate for food & facilities (convert weekly rate to daily)
    // For food & facilities, we'll use a default rate of €345 per week
    const defaultWeeklyRate = 345;
    nightlyFoodRate = defaultWeeklyRate / 6;
  }
  console.log('[calculatePricing] Nightly food rate:', nightlyFoodRate);

  // Calculate total food & facilities cost using daily rate
  const totalFoodAndFacilitiesCost = +(nightlyFoodRate * totalNights).toFixed(2);
  
  // Calculate total with duration discount on accommodation
  const subtotal = +(accommodationWithDurationDiscount + totalFoodAndFacilitiesCost).toFixed(2);
  
  // Calculate total amount with cent precision
  const totalAmount = subtotal;
  
  // Calculate total amount in cents for database storage (as integer)
  const totalAmountInCents = Math.round(totalAmount * 100);

  // Calculate duration discount amount
  const durationDiscountAmount = +(baseAccommodationCostWithDiscount - accommodationWithDurationDiscount).toFixed(2);

  // Calculate average seasonal discount for display (but note it's not used in final price calc)
  // This calculation might be misleading if seasons have different lengths/discounts
  const averageSeasonalDiscount = seasonBreakdown 
    ? seasonBreakdown.seasons.reduce((sum, season) => 
        sum + (season.discount * season.nights), 0) / seasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0)
    : 0;
   console.log('[calculatePricing] Average seasonal discount (for info only):', averageSeasonalDiscount);

  return {
    totalNights,
    nightlyAccommodationRate,
    baseAccommodationRate,
    effectiveBaseRate: nightlyFoodRate,
    totalAccommodationCost: accommodationWithDurationDiscount,
    totalFoodAndFacilitiesCost,
    subtotal,
    durationDiscountAmount,
    durationDiscountPercent: durationDiscount * 100, // Convert to percentage for display
    weeksStaying: completeWeeks,
    totalAmount,
    totalAmountInCents,
    seasonalDiscount: averageSeasonalDiscount
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

export function BookingSummary({
  selectedWeeks,
  selectedAccommodation,
  onClearWeeks,
  onClearAccommodation,
  seasonBreakdown: initialSeasonBreakdown
}: BookingSummaryProps) {
  // --- LOGGING: Initial props and state ---
  console.log('[BookingSummary] --- Component Render Start ---');
  console.log('[BookingSummary] Initial Props Received:', {
    selectedWeeksCount: selectedWeeks?.length,
    selectedAccommodationId: selectedAccommodation?.id,
    selectedAccommodationTitle: selectedAccommodation?.title,
    initialSeasonBreakdownProvided: !!initialSeasonBreakdown,
  });
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

  // Calculate pricing details - MEMOIZED
  const pricing = useMemo(() => {
    // --- LOGGING: Inside useMemo for pricing ---
    console.log('[BookingSummary] --- Recalculating Pricing (useMemo) ---');
    console.log('[BookingSummary] useMemo Dependencies:', {
      selectedWeeksLength: selectedWeeks.length,
      selectedAccommodationId_Prop: selectedAccommodation?.id,
      foodContribution,
      seasonBreakdownStateExists_Input: !!seasonBreakdownState, // Log the state it's ABOUT to use
      seasonBreakdownState_Input: seasonBreakdownState ? JSON.stringify(seasonBreakdownState) : 'undefined',
    });
    // --- END LOGGING ---

    const calculatedPricingDetails = calculatePricing(selectedWeeks, selectedAccommodation, seasonBreakdownState, foodContribution);

    // --- LOGGING: Pricing result ---
    console.log('[BookingSummary] useMemo: Pricing calculation COMPLETE. Result:', calculatedPricingDetails);
    console.log('[BookingSummary] --- Finished Pricing Recalculation (useMemo) ---');
    // --- END LOGGING ---

    return calculatedPricingDetails;
  }, [selectedWeeks, selectedAccommodation, seasonBreakdownState, foodContribution]); // Use the state variable here

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

  // Initialize food contribution based on number of nights
  useEffect(() => {
    console.log('[BookingSummary] useEffect[selectedWeeks, durationDiscountPercent] - Updating food contribution...');
    if (selectedWeeks.length > 0) {
      const totalNights = calculateTotalNights(selectedWeeks);
      // Set default contribution to the middle of the range
      if (totalNights <= 6) {
        // For 6 nights or less (1 week): €345-€390 range
        const min = Math.round(345 * (1 - pricing.durationDiscountPercent / 100));
        const max = Math.round(390 * (1 - pricing.durationDiscountPercent / 100));
        setFoodContribution(Math.round((min + max) / 2));
        console.log('[BookingSummary] Setting default food contribution for short stay:', Math.round((min + max) / 2), 'per week');
      } else {
        // For 7+ nights (more than 1 week): €240-€390 range
        const min = Math.round(240 * (1 - pricing.durationDiscountPercent / 100));
        const max = Math.round(390 * (1 - pricing.durationDiscountPercent / 100));
        setFoodContribution(Math.round((min + max) / 2));
        console.log('[BookingSummary] Setting default food contribution for long stay:', Math.round((min + max) / 2), 'per week');
      }
    } else {
      setFoodContribution(null);
      console.log('[BookingSummary] Clearing food contribution');
    }
  }, [selectedWeeks, pricing.durationDiscountPercent]);

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
      const totalDays = differenceInDays(
        selectedWeeks[selectedWeeks.length - 1].endDate,
        selectedWeeks[0].startDate
      );
      const checkOut = addDays(selectedCheckInDate, totalDays);

      console.log('[Booking Summary] Starting booking process...');
      setIsBooking(true);
      setError(null);
      
      try {
        console.log('[Booking Summary] Creating booking:', {
          accommodationId: selectedAccommodation.id,
          checkIn: formatInTimeZone(selectedCheckInDate, 'UTC', 'yyyy-MM-dd'), 
          checkOut: formatInTimeZone(checkOut, 'UTC', 'yyyy-MM-dd'),
          totalPrice: pricing.totalAmount
        });

        const booking = await bookingService.createBooking({
          accommodationId: selectedAccommodation.id,
          checkIn: formatInTimeZone(selectedCheckInDate, 'UTC', 'yyyy-MM-dd'),
          checkOut: formatInTimeZone(checkOut, 'UTC', 'yyyy-MM-dd'),
          totalPrice: pricing.totalAmount
        });

        console.log('[Booking Summary] Booking created:', booking);
        
        // Updated navigation to match the route in AuthenticatedApp.tsx
        navigate('/confirmation', { 
          state: { 
            booking: {
              ...booking,
              accommodation: selectedAccommodation.title,
              guests: selectedAccommodation.capacity,
              totalPrice: pricing.totalAmount,
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
  }, [selectedAccommodation, selectedWeeks, selectedCheckInDate, navigate, pricing.totalAmount]);

  const handleConfirmClick = async () => {
    console.log('[Booking Summary] Confirm button clicked.');
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
              className="bg-white rounded-lg max-w-xl w-full p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif">Complete Payment</h3>
                <button
                  onClick={() => setShowStripeModal(false)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <StripeCheckoutForm
                authToken={authToken}
                total={testPaymentAmount !== null && isAdmin ? testPaymentAmount : pricing.totalAmount}
                description={`${selectedAccommodation?.title || 'Accommodation'} for ${pricing.totalNights} nights${testPaymentAmount !== null && isAdmin ? ' (TEST PAYMENT)' : ''}`}
                onSuccess={handleBookingSuccess}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary of Stay section - Changes from sticky right positioning on mobile to regular flow */}
      <div className="lg:sticky lg:top-4 w-full max-w-md lg:max-w-lg mx-auto">
        <div className="bg-white p-5 sm:p-6 lg:p-8 pixel-corners">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-display font-light text-stone-900">
                Summary of Stay
              </h2>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-lg flex justify-between items-center font-regular text-xs sm:text-sm">
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {selectedWeeks.length > 0 && (
            <div className="space-y-6">
              {/* Stay Details Section */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-sm pixel-corners overflow-hidden relative">
                <button
                  onClick={onClearWeeks}
                  className="absolute top-0.5 right-0.5 p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="sr-only">Clear Selected Dates</span>
                </button>
                <div className="space-y-4 sm:space-y-5">
                  {/* Arrival Information */}
                  <div className="bg-white border border-emerald-200 rounded-lg shadow-sm p-3 sm:p-4">
                    <h4 className="font-medium text-stone-800 mb-2 font-regular text-base sm:text-lg">Arrival</h4>
                    <div className="space-y-1">
                      <p className="text-emerald-700 text-sm sm:text-base font-regular">{formatDateWithDay(selectedWeeks[0].startDate)}</p>
                      <p className="text-emerald-700 text-sm sm:text-base font-regular">3PM-8PM</p>
                    </div>
                  </div>
                  
                  {/* Departure Information */}
                  <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-3 sm:p-4">
                    <h4 className="font-medium text-stone-800 mb-2 font-regular text-base sm:text-lg">Begone by</h4>
                    <div className="space-y-1">
                      <p className="text-stone-600 text-sm sm:text-base font-regular">{formatDateWithOrdinal(selectedWeeks[selectedWeeks.length - 1].endDate)}</p>
                      <p className="text-stone-600 text-sm sm:text-base font-regular">12PM Noon</p>
                    </div>
                  </div>
                  
                  {/* Duration */}
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <div className="hidden xl:flex xl:justify-between xl:items-center">
                      <div className="flex items-center">
                        <div className="bg-emerald-100 p-2.5 rounded-lg mr-3">
                          <Home className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h4 className="font-medium text-stone-800 font-regular text-base sm:text-lg">Total Stay</h4>
                      </div>
                      <div>
                        <span className="text-emerald-800 font-medium font-regular text-sm sm:text-base">
                          {pricing.totalNights} nights
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center xl:hidden">
                      <div className="bg-emerald-100 p-2.5 rounded-lg mr-3 flex-shrink-0 self-start mt-1">
                        <Home className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-stone-800 font-regular text-base sm:text-lg">Total Stay</h4>
                        <p className="text-emerald-700 text-sm sm:text-base font-regular mt-0.5">{pricing.totalNights} nights</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accommodation Section */}
              {selectedAccommodation && (
                <motion.div 
                  className="bg-white p-4 sm:p-5 rounded-lg border border-stone-200 shadow-sm relative"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    onClick={onClearAccommodation}
                    className="absolute top-3 right-3 p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Clear Selected Accommodation</span>
                  </button>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base sm:text-lg text-stone-800 flex items-center font-regular">
                      <Bed className="w-5 h-5 mr-2.5 text-emerald-600" />
                      Accommodation
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-emerald-50 p-3 sm:p-4 rounded-lg border border-emerald-100">
                      <div className="text-center">
                        <span className="text-emerald-800 font-medium text-sm sm:text-base font-regular">
                          {selectedAccommodation.title === 'Van Parking' || 
                           selectedAccommodation.title === 'Your Own Tent' || 
                           selectedAccommodation.title === '+1 Accommodation' || 
                           selectedAccommodation.title === 'The Hearth' 
                           ? selectedAccommodation.title
                           : `The ${selectedAccommodation.title}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Price Breakdown */}
              <div className="border-t border-stone-200 pt-3 sm:pt-4 mt-3 sm:mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-stone-800 font-regular text-base sm:text-lg">Price Breakdown</h3>
                  <Tooltip.Provider>
                    <Tooltip.Root delayDuration={0}>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={() => setShowDiscountModal(true)}
                          className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                        >
                          <Info className="w-4 h-4" />
                          <span className="sr-only">View Discount Details</span>
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 xxs:mb-1.5 px-1.5 xxs:px-2 py-0.5 xxs:py-1 bg-stone-800 text-white text-[8px] xxs:text-[10px] sm:text-xs rounded opacity-0 data-[state=delayed-open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity whitespace-nowrap pointer-events-none font-regular text-center"
                          sideOffset={5}
                        >
                          <p className="font-medium">View Discount Details</p>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-stone-800"></div>
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </div>
                
                <div className="space-y-2 sm:space-y-3">
                  {/* Accommodation pricing */}
                  <div className="flex justify-between text-stone-600 font-regular text-sm sm:text-base">
                    <div className="flex items-center gap-2 mr-4">
                      <span>Accommodation <span className="whitespace-nowrap">({pricing.totalNights} nights)</span></span>
                    </div>
                    <span>€{pricing.totalAccommodationCost.toFixed(2)}</span>
                  </div>
                  
                  {/* Food & Facilities */}
                  <div className="space-y-4 sm:space-y-5">
                    <div className="flex justify-between text-stone-600 font-regular text-sm sm:text-base">
                      <span className="mr-4">Food & facilities <span className="whitespace-nowrap">({pricing.totalNights} {pricing.totalNights === 1 ? 'night' : 'nights'})</span></span>
                      <span>€{pricing.totalFoodAndFacilitiesCost.toFixed(2)}</span>
                    </div>
                    
                    {/* Contribution Slider */}
                    <div className="bg-stone-50 p-3 sm:p-4 rounded-lg border border-stone-200">
                      <div className="flex justify-between items-center mb-2 sm:mb-3">
                        <h4 className="text-xs sm:text-sm font-medium text-stone-800 font-regular">Weekly Contribution</h4>
                        <span className="text-xs sm:text-sm font-medium bg-emerald-600 text-white px-2 sm:px-3 py-1 rounded-full font-regular">
                          €{foodContribution}
                        </span>
                      </div>
                      
                      <p className="text-xs text-stone-600 mb-3 sm:mb-4 font-regular">
                        Choose how much you'd like to contribute to food & facilities per week based on your means.
                      </p>
                      
                      {/* Slider implementation */}
                      <div className="mb-4 sm:mb-6">
                        <div className="flex justify-between text-xs text-stone-600 mb-2 font-regular">
                          <span>€{Math.round((pricing.totalNights <= 6 ? 345 : 240) * (1 - pricing.durationDiscountPercent / 100))}</span>
                          <span>€{Math.round(390 * (1 - pricing.durationDiscountPercent / 100))}</span>
                        </div>
                        
                        <input 
                          type="range" 
                          min={Math.round((pricing.totalNights <= 6 ? 345 : 240) * (1 - pricing.durationDiscountPercent / 100))} 
                          max={Math.round(390 * (1 - pricing.durationDiscountPercent / 100))} 
                          step={1}
                          value={foodContribution || 0}
                          onChange={(e) => {
                            const newValue = Number(e.target.value);
                            // Basic validation: ensure value is within calculated bounds
                            if (newValue >= Math.round((pricing.totalNights <= 6 ? 345 : 240) * (1 - pricing.durationDiscountPercent / 100)) && newValue <= Math.round(390 * (1 - pricing.durationDiscountPercent / 100))) {
                              setFoodContribution(newValue);
                              console.log('[BookingSummary] Food contribution slider changed:', newValue);
                            } else {
                              console.warn(`[BookingSummary] Slider value ${newValue} out of bounds (${Math.round((pricing.totalNights <= 6 ? 345 : 240) * (1 - pricing.durationDiscountPercent / 100))}-${Math.round(390 * (1 - pricing.durationDiscountPercent / 100))}). Clamping.`);
                              // Optionally clamp the value
                              setFoodContribution(Math.max(Math.min(newValue, Math.round(390 * (1 - pricing.durationDiscountPercent / 100))), Math.round((pricing.totalNights <= 6 ? 345 : 240) * (1 - pricing.durationDiscountPercent / 100))));
                            }
                          }}
                          className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                      </div>
                      
                      <div className="text-xs text-stone-600 bg-stone-100 p-3 sm:p-4 rounded-lg border border-stone-200">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <span className="text-emerald-700 mt-0.5 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          <div className="flex-1">
                            <p className="mb-1 text-stone-700 font-medium font-regular text-xs sm:text-sm">Your contribution helps us:</p>
                            <ul className="list-disc list-inside space-y-1 sm:space-y-1.5 pl-0 mb-1 sm:mb-1.5 font-regular text-xs sm:text-sm">
                              <li>Provide meals during your stay</li>
                              <li>Maintain our community spaces</li>
                              <li>Ongoing Technical & Wellness Upgrades</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 font-medium text-stone-800 border-t border-stone-200 pt-2 sm:pt-3 mt-2 font-regular text-lg sm:text-xl">
                    <span className="col-span-1">Total</span>
                    <span className="col-span-1 text-right whitespace-nowrap">€{pricing.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Test Payment Option for Admins */}
              {isAdmin && (
                <div className="mt-4 mb-4 sm:mb-6 bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-2 font-regular text-base sm:text-lg">Test Payment Options</h4>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
                    <input
                      type="number"
                      min="0.50"
                      step="0.01"
                      value={testPaymentAmount !== null ? testPaymentAmount : ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : parseFloat(e.target.value);
                        setTestPaymentAmount(value);
                      }}
                      placeholder="0.50"
                      className="w-full sm:w-32 px-3 py-2 border border-blue-300 rounded-md text-blue-800 font-regular text-sm"
                    />
                    <span className="text-xs sm:text-sm text-blue-600 font-regular">Set custom test amount (€)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTestPaymentAmount(0.50)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs rounded font-regular"
                    >
                      €0.50
                    </button>
                    <button
                      onClick={() => setTestPaymentAmount(1)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs rounded font-regular"
                    >
                      €1.00
                    </button>
                    <button
                      onClick={() => setTestPaymentAmount(null)}
                      className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs rounded ml-auto font-regular"
                    >
                      Reset
                    </button>
                  </div>
                  {testPaymentAmount !== null && (
                    <p className="text-xs sm:text-sm text-blue-600 mt-2 font-regular">
                      Using test payment amount: <strong>€{testPaymentAmount.toFixed(2)}</strong> instead of €{pricing.totalAmount.toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4">
                <motion.button
                  onClick={handleConfirmClick}
                  disabled={!selectedAccommodation || isBooking}
                  className="w-full bg-emerald-600 text-white py-2.5 sm:py-3 rounded-lg hover:bg-emerald-700 transition-all disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed font-regular text-sm sm:text-base pixel-corners shadow-sm flex items-center justify-center"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isBooking ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </motion.button>

                {isAdmin && (
                  <motion.button
                    onClick={handleAdminConfirm}
                    disabled={!selectedAccommodation || isBooking}
                    className="w-full bg-white border-2 border-emerald-600 text-emerald-700 py-2.5 sm:py-3 rounded-lg hover:bg-emerald-50 transition-all disabled:bg-stone-100 disabled:border-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed font-regular text-sm sm:text-base pixel-corners shadow-sm flex items-center justify-center"
                    whileHover={{ scale: 1.02, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isBooking ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Admin Confirm (No Payment)'
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          )}

          {selectedWeeks.length === 0 && (
            <div className="text-stone-500 text-center py-6 sm:py-8 font-regular text-sm sm:text-base">
              Select dates to see pricing
            </div>
          )}
        </div>
      </div>

      {/* Add DiscountModal */}
      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        checkInDate={selectedWeeks[0]?.startDate || fallbackDate.toISOString()}
        checkOutDate={selectedWeeks[selectedWeeks.length - 1]?.endDate || fallbackDate.toISOString()}
        accommodationName={selectedAccommodation?.title || ''}
        basePrice={selectedAccommodation?.base_price || 0}
      />
    </>
  );
}