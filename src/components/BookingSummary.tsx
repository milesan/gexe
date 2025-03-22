import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, ArrowRight, LogOut, Sun, Moon, Home, Bed, ChevronDown, ChevronUp, Percent } from 'lucide-react';
import { useSchedulingRules } from '../hooks/useSchedulingRules';
import { getSeasonalDiscount, getDurationDiscount, getSeasonName } from '../utils/pricing';
import type { Week } from '../types/calendar';
import type { Accommodation } from '../types';
import { format, addDays, differenceInDays, isSameDay, isBefore, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/BookingService';
import { supabase } from '../lib/supabase';
import { StripeCheckoutForm } from './StripeCheckoutForm';
import { useSession } from '../hooks/useSession';
import { DayPicker } from 'react-day-picker';
import type { DayPickerSingleProps } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { formatDateForDisplay } from '../utils/dates';

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
  baseRate: number;
  onClearWeeks: () => void;
  onClearAccommodation: () => void;
  seasonBreakdown?: SeasonBreakdown; // Optional for backward compatibility
}

// Helper function to calculate total nights from selected weeks
const calculateTotalNights = (selectedWeeks: Week[]): number => {
  if (selectedWeeks.length === 0) return 0;
  
  // For a date range like "Jul 1 → Jul 14", the correct number of nights is 13
  // We need to calculate (end date - start date) in days
  const firstDate = selectedWeeks[0].startDate;
  const lastDate = selectedWeeks[selectedWeeks.length - 1].endDate;
  
  // differenceInDays gives us the exact number of nights
  return differenceInDays(lastDate, firstDate);
};

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
  nightlyRate: number;
  totalAccommodationCost: number;
  totalFoodAndFacilitiesCost: number;
  originalAccommodationCost: number;
  accommodationDiscountAmount: number;
  subtotal: number;
  durationDiscountAmount: number;
  durationDiscountPercent: number;
  weeksStaying: number;
  totalAmount: number;
  totalAmountInCents: number;
  seasonalDiscount: number;
  seasonName: string;
}

const calculatePricing = (
  selectedWeeks: Week[],
  selectedAccommodation: Accommodation | null,
  baseRate: number,
  seasonBreakdown?: SeasonBreakdown,
  foodContribution?: number | null
): PricingDetails => {
  // Calculate total nights
  const totalNights = calculateTotalNights(selectedWeeks);
  
  // Log the night calculation for verification
  if (selectedWeeks.length > 0) {
    console.log('[BookingSummary] Night calculation:', {
      firstDate: selectedWeeks[0].startDate.toISOString().split('T')[0],
      lastDate: selectedWeeks[selectedWeeks.length - 1].endDate.toISOString().split('T')[0],
      totalNights,
      dateRange: formatOverallDateRange(selectedWeeks)
    });
  }
  
  // Get base accommodation rate
  const baseAccommodationRate = selectedAccommodation?.base_price || 0;
  
  // Calculate seasonal discount - use the provided breakdown if available
  const seasonalDiscount = seasonBreakdown 
    ? seasonBreakdown.seasons.reduce((acc, season) => acc + (season.discount * season.nights), 0) / 
      seasonBreakdown.seasons.reduce((acc, season) => acc + season.nights, 0)
    : selectedWeeks.length > 0 
      ? selectedWeeks.reduce((acc, week) => acc + getSeasonalDiscount(week.startDate), 0) / selectedWeeks.length 
      : 0;

  // Determine the season name based on the discount
  const seasonName = seasonBreakdown?.hasMultipleSeasons 
    ? "Multiple Seasons" 
    : seasonalDiscount === 0 
      ? 'Summer Season' 
      : seasonalDiscount === 0.15 
        ? 'Shoulder Season' 
        : 'Winter Season';
  
  // Apply seasonal discount to accommodation rate with cent precision
  const accommodationRate = baseAccommodationRate > 0 
    ? +(baseAccommodationRate * (1 - seasonalDiscount)).toFixed(2)
    : 0;
  
  // Log the accommodation rate calculation
  console.log('[BookingSummary] Accommodation rate calculation:', {
    baseAccommodationRate,
    seasonalDiscount,
    discountPercentage: `${formatNumber(seasonalDiscount * 100)}%`,
    discountAmount: +(baseAccommodationRate * seasonalDiscount).toFixed(2),
    accommodationRate,
    seasonName,
    hasMultipleSeasons: seasonBreakdown?.hasMultipleSeasons
  });
  
  // Calculate nightly accommodation rate (base_price is for 6 nights) with cent precision
  const nightlyAccommodationRate = accommodationRate > 0 
    ? +(accommodationRate / 6).toFixed(2)
    : 0;

  // Determine food & facilities rate based on contribution or default
  let effectiveBaseRate: number;
  let totalFoodAndFacilitiesCost: number;
  
  if (foodContribution !== null && foodContribution !== undefined) {
    // Use the user-selected contribution amount (weekly rate)
    // For food & facilities, we calculate based on complete and partial weeks
    const completeWeeks = Math.floor(totalNights / 6);
    const remainingNights = totalNights % 6;
    
    // Calculate cost for complete weeks
    const completeWeeksCost = completeWeeks * foodContribution;
    
    // Calculate cost for remaining nights (pro-rated from weekly rate)
    const remainingNightsCost = remainingNights > 0 ? (remainingNights / 6) * foodContribution : 0;
    
    // Total food & facilities cost
    totalFoodAndFacilitiesCost = +(completeWeeksCost + remainingNightsCost).toFixed(2);
    
    // For other calculations, we still need a nightly rate
    effectiveBaseRate = foodContribution / 6;
    
    console.log('[BookingSummary] Food contribution calculation:', {
      weeklyRate: foodContribution,
      nightlyRate: effectiveBaseRate,
      totalNights,
      completeWeeks,
      remainingNights,
      completeWeeksCost,
      remainingNightsCost,
      totalCost: totalFoodAndFacilitiesCost
    });
  } else {
    // Special December 2024 rate for food & facilities
    effectiveBaseRate = selectedWeeks.some(week => {
      const month = week.startDate.getMonth();
      const year = week.startDate.getFullYear();
      return month === 11 && year === 2024;
    }) ? 190 : baseRate;
    
    // Calculate total food & facilities cost using nightly rate
    totalFoodAndFacilitiesCost = +(effectiveBaseRate * totalNights).toFixed(2);
    
    console.log('[BookingSummary] Using default food contribution:', effectiveBaseRate, 'per night');
  }

  // Calculate nightly rate with cent precision
  const nightlyRate = +(effectiveBaseRate + nightlyAccommodationRate).toFixed(2);
  
  // Calculate total costs for each component
  const totalAccommodationCost = +(nightlyAccommodationRate * totalNights).toFixed(2);
  // totalFoodAndFacilitiesCost is calculated above
  
  // Calculate original accommodation cost before discount
  const originalAccommodationCost = +((baseAccommodationRate / 6) * totalNights).toFixed(2);
  const accommodationDiscountAmount = +(originalAccommodationCost - totalAccommodationCost).toFixed(2);
  
  // Calculate subtotal with cent precision
  const subtotal = +(totalAccommodationCost + totalFoodAndFacilitiesCost).toFixed(2);
  
  // Calculate duration discount
  // Duration Discounts:
  // - 3+ weeks: 10% off
  // - Additional weeks: +1.5% off per week
  // - Maximum discount: 20% (at 10 weeks)
  let durationDiscountPercent = 0;
  
  // Calculate weeks based on days (7 days = 1 week)
  // For a date range like "Jul 1 → Jul 14", that's 14 days (inclusive of start and end dates)
  // So we add 1 to the nights to get the total days
  const totalDays = totalNights + 1;
  const weeksStaying = totalDays / 7;
  
  if (weeksStaying >= 3) {
    // Base discount for 3 weeks
    durationDiscountPercent = 10;
    
    // Additional discount for each week beyond 3
    if (weeksStaying > 3) {
      const additionalWeeks = weeksStaying - 3;
      durationDiscountPercent += additionalWeeks * 1.5;
      
      // Cap at 20%
      durationDiscountPercent = Math.min(durationDiscountPercent, 20);
    }
    
    // Ensure precision to 1 decimal place
    durationDiscountPercent = Math.round(durationDiscountPercent * 10) / 10;
  }
  
  // Calculate duration discount amount with cent precision
  const durationDiscountAmount = +(subtotal * (durationDiscountPercent / 100)).toFixed(2);
  
  // Calculate total amount with cent precision
  const totalAmount = +(subtotal - durationDiscountAmount).toFixed(2);
  
  // Calculate total amount in cents for database storage (as integer)
  const totalAmountInCents = Math.round(totalAmount * 100);

  return {
    totalNights,
    nightlyAccommodationRate,
    baseAccommodationRate,
    effectiveBaseRate,
    nightlyRate,
    totalAccommodationCost,
    totalFoodAndFacilitiesCost,
    originalAccommodationCost,
    accommodationDiscountAmount,
    subtotal,
    durationDiscountAmount,
    durationDiscountPercent,
    weeksStaying,
    totalAmount,
    totalAmountInCents,
    seasonalDiscount,
    seasonName
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
  const firstDate = selectedWeeks[0].startDate;
  const lastDate = selectedWeeks[selectedWeeks.length - 1].endDate;
  return `${format(firstDate, 'MMM d')} → ${format(lastDate, 'MMM d')}`;
};

// Helper function to format date with day of week
const formatDateWithDay = (date: Date): string => {
  return format(date, 'EEEE, MMMM d');
};

// Helper function to add ordinal suffix to day of month
const formatDateWithOrdinal = (date: Date): string => {
  const day = date.getDate();
  const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)];
  return format(date, 'EEEE, MMMM ') + day + suffix;
};

export function BookingSummary({
  selectedWeeks,
  selectedAccommodation,
  baseRate,
  onClearWeeks,
  onClearAccommodation,
  seasonBreakdown
}: BookingSummaryProps) {
  console.log('[BookingSummary] Rendering:', {
    selectedWeeksCount: selectedWeeks?.length,
    selectedWeeksDates: selectedWeeks.map(w => ({
      start: w.startDate.toISOString(),
      end: w.endDate.toISOString()
    })),
    selectedAccommodation: selectedAccommodation?.title,
    baseRate,
    seasonBreakdown
  });

  console.log('[Booking Summary] Component mounted with:', {
    selectedWeeks: selectedWeeks.map(w => w.startDate.toISOString()),
    selectedAccommodation: selectedAccommodation?.title,
    baseRate
  });

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

  // Calculate pricing details
  const pricing = calculatePricing(selectedWeeks, selectedAccommodation, baseRate, seasonBreakdown, foodContribution);

  // Always update the check-in date when selectedWeeks changes
  useEffect(() => {
    if (selectedWeeks.length > 0) {
      // Check if the first week has a selectedFlexDate property (from flexible check-in)
      if (selectedWeeks[0].selectedFlexDate) {
        console.log('[BookingSummary] Using selectedFlexDate from first week:', formatDateForDisplay(selectedWeeks[0].selectedFlexDate));
        setSelectedCheckInDate(selectedWeeks[0].selectedFlexDate);
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
    if (selectedWeeks.length > 0) {
      const totalNights = calculateTotalNights(selectedWeeks);
      // Set default contribution to the middle of the range
      if (totalNights <= 6) {
        // For 6 nights or less (1 week): €345-€390 range
        setFoodContribution(368); // Middle of the range
        console.log('[BookingSummary] Setting default food contribution for short stay:', 368, 'per week');
      } else {
        // For 7+ nights (more than 1 week): €240-€390 range
        setFoodContribution(315); // Middle of the range
        console.log('[BookingSummary] Setting default food contribution for long stay:', 315, 'per week');
      }
    } else {
      setFoodContribution(null);
      console.log('[BookingSummary] Clearing food contribution');
    }
  }, [selectedWeeks]);

  // Log when food contribution changes
  useEffect(() => {
    if (foodContribution !== null) {
      console.log('[BookingSummary] Food contribution updated, recalculating pricing:', foodContribution);
    }
  }, [foodContribution]);

  // Validate that a check-in date is selected
  const validateCheckInDate = useCallback(() => {
    if (!selectedCheckInDate) {
      setError('Please select a check-in date');
      return false;
    }
    if (hasFlexibleDates && !flexibleDates?.some(date => isSameDay(date, selectedCheckInDate))) {
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

  const handleBookingSuccess = useCallback(async () => {
    try {
      if (!selectedAccommodation || selectedWeeks.length === 0 || !selectedCheckInDate) {
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
          checkIn: selectedCheckInDate.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          totalPrice: pricing.totalAmount
        });

        const booking = await bookingService.createBooking({
          accommodationId: selectedAccommodation.id,
          checkIn: selectedCheckInDate.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
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
    console.log('[Booking Summary] Confirm button clicked');
    
    if (!validateCheckInDate()) {
      console.warn('[Booking Summary] Check-in date validation failed');
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
    console.log('[Booking Summary] Admin confirm button clicked');
    
    if (!validateCheckInDate()) {
      console.warn('[Booking Summary] Check-in date validation failed');
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
      <div className="lg:sticky lg:top-4">
        <div className="bg-white p-6 lg:p-8 pixel-corners">
          <h2 className="text-xl lg:text-2xl font-serif font-light text-stone-900 mb-4">
            Summary of Stay
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {selectedWeeks.length > 0 && (
            <div className="space-y-6">
              {/* Stay Details Section */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm pixel-corners overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg text-stone-800 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                    Stay Details
                  </h3>
                  <button
                    onClick={onClearWeeks}
                    className="text-stone-400 hover:text-stone-600 transition-colors"
                    title="Clear selected dates"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Arrival Information - Simplified and optimized */}
                  <div className="bg-white border border-emerald-200 rounded-lg shadow-sm p-3">
                    <h4 className="font-medium text-stone-800 mb-1.5">Arrival</h4>
                    <div className="space-y-0.5">
                      <p className="text-emerald-700 text-sm">{formatDateWithDay(selectedWeeks[0].startDate)}</p>
                      <p className="text-emerald-700 text-sm">3PM-8PM</p>
                    </div>
                  </div>
                  
                  {/* Departure Information - Simplified and optimized */}
                  <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-3">
                    <h4 className="font-medium text-stone-800 mb-1.5">Begone by</h4>
                    <div className="space-y-0.5">
                      <p className="text-stone-600 text-sm">{formatDateWithOrdinal(selectedWeeks[selectedWeeks.length - 1].endDate)}</p>
                      <p className="text-stone-600 text-sm">12PM Noon</p>
                    </div>
                  </div>
                  
                  {/* Duration - Simplified */}
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    {/* On larger screens, display horizontally */}
                    <div className="hidden xl:flex xl:justify-between xl:items-center">
                      <div className="flex items-center">
                        <div className="bg-emerald-100 p-2 rounded-lg mr-3">
                          <Home className="w-4 h-4 text-emerald-600" />
                        </div>
                        <h4 className="font-medium text-stone-800">Total Stay</h4>
                      </div>
                      <div>
                        <span className="text-emerald-800 font-medium">
                          {pricing.totalNights} nights
                        </span>
                      </div>
                    </div>
                    
                    {/* On smaller screens, display vertically */}
                    <div className="flex items-center xl:hidden">
                      <div className="bg-emerald-100 p-2 rounded-lg mr-3 flex-shrink-0 self-start mt-1">
                        <Home className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-stone-800">Total Stay</h4>
                        <p className="text-emerald-700 text-sm">{pricing.totalNights} nights</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accommodation Section */}
              {selectedAccommodation && (
                <motion.div 
                  className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-serif text-lg text-stone-800 flex items-center">
                      <Bed className="w-4 h-4 mr-2 text-emerald-600" />
                      Accommodation
                    </h3>
                    <button
                      onClick={onClearAccommodation}
                      className="text-stone-400 hover:text-stone-600 transition-colors"
                      title="Clear selected accommodation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600">Selected</span>
                      <span className="text-stone-800 font-medium">{selectedAccommodation.title}</span>
                    </div>
                    
                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                      <div className="text-center">
                        <span className="text-emerald-800 font-serif">
                          Sleeping in {selectedAccommodation.title === 'Van Parking' || 
                                     selectedAccommodation.title === 'Your Own Tent' || 
                                     selectedAccommodation.title === '+1 Accommodation' || 
                                     selectedAccommodation.title === 'The Hearth' 
                                     ? '' : "the '"}{selectedAccommodation.title}
                          {selectedAccommodation.title === 'Van Parking' || 
                           selectedAccommodation.title === 'Your Own Tent' || 
                           selectedAccommodation.title === '+1 Accommodation' || 
                           selectedAccommodation.title === 'The Hearth' 
                           ? '' : "'"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Consolidated Discounts Section */}
              {(pricing.seasonalDiscount > 0 || pricing.durationDiscountAmount > 0 || seasonBreakdown?.hasMultipleSeasons) && (
                <div className="bg-white p-4 rounded-lg border border-emerald-200 shadow-sm">
                  <button 
                    onClick={() => setShowDiscountDetails(!showDiscountDetails)}
                    className="w-full flex justify-between items-center"
                  >
                    <div className="flex items-center">
                      <div className="bg-emerald-100 p-1.5 rounded-lg mr-2">
                        <Percent className="w-4 h-4 text-emerald-700" />
                      </div>
                      <h3 className="font-medium text-stone-800">Discounts</h3>
                    </div>
                    <div className="flex items-center ml-2">
                      {/* Only show descriptive text on screens >= 1280px */}
                      <span className="hidden xl:inline text-emerald-700 font-medium mr-2 text-right">
                        {seasonBreakdown?.hasMultipleSeasons 
                          ? 'Seasonal' 
                          : pricing.seasonalDiscount > 0 && pricing.durationDiscountAmount > 0 
                            ? 'Multiple' 
                            : pricing.seasonalDiscount > 0 
                              ? `${Math.round(pricing.seasonalDiscount * 100)}%` 
                              : `${formatNumber(pricing.durationDiscountPercent)}%`}
                      </span>
                      {showDiscountDetails ? (
                        <ChevronUp className="w-4 h-4 text-stone-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {showDiscountDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 mt-3 border-t border-stone-100 space-y-3">
                          {/* Multiple Seasons Breakdown */}
                          {seasonBreakdown?.hasMultipleSeasons && (
                            <div className="bg-amber-50 p-3 rounded-lg">
                              <h4 className="font-medium text-amber-800 text-sm mb-2">Seasonal Pricing</h4>
                              <div className="space-y-2">
                                {seasonBreakdown.seasons
                                  .slice()
                                  .sort((a, b) => {
                                    // Sort in chronological order: Winter -> Shoulder -> Summer
                                    const getSeasonOrder = (season: {name: string, discount: number}) => {
                                      if (season.name === 'Winter Season' || (season.name === 'High Season' && season.discount === 0.40)) return 1;
                                      if (season.name === 'Shoulder Season' || (season.name === 'High Season' && season.discount === 0.15)) return 2;
                                      return 3; // Summer/High Season
                                    };
                                    return getSeasonOrder(a) - getSeasonOrder(b);
                                  })
                                  .map((season, index) => (
                                    <div key={index} className="xl:flex xl:justify-between xl:items-center">
                                      <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                                          season.name === 'High Season' ? 'bg-amber-500' : 
                                          season.name === 'Shoulder Season' ? 'bg-amber-300' : 'bg-amber-200'
                                        }`}></div>
                                        <span className="text-amber-800 text-sm">{season.name === 'High Season' ? 'Summer Season' : season.name}</span>
                                      </div>
                                      <div className="text-amber-800 text-sm xl:text-right mt-1 xl:mt-0 ml-4 xl:ml-0">
                                        <span className="font-medium">{season.nights} {season.nights === 1 ? 'night' : 'nights'}</span>
                                        {season.discount > 0 && (
                                          <span className="ml-1 text-xs">({Math.round(season.discount * 100)}% off)</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        
                          {/* Seasonal Discount - only show if not multiple seasons */}
                          {!seasonBreakdown?.hasMultipleSeasons && pricing.seasonalDiscount > 0 && selectedAccommodation && selectedAccommodation.base_price > 0 && (
                            <div className="bg-emerald-50 p-3 rounded-lg">
                              <div className="xl:flex xl:justify-between xl:items-center">
                                <h4 className="font-medium text-emerald-800 text-sm">Seasonal Discount</h4>
                                <span className="text-emerald-800 font-medium text-sm block xl:inline-block mt-1 xl:mt-0">{Math.round(pricing.seasonalDiscount * 100)}% off</span>
                              </div>
                              <p className="text-xs text-emerald-700 mt-1">
                                You're booking during {pricing.seasonName}, which offers a discount on accommodation.
                              </p>
                            </div>
                          )}
                          
                          {/* Duration Discount */}
                          {pricing.durationDiscountAmount > 0 && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <div className="xl:flex xl:justify-between xl:items-center">
                                <h4 className="font-medium text-blue-800 text-sm">Duration Discount</h4>
                                <span className="text-blue-800 font-medium text-sm block xl:inline-block mt-1 xl:mt-0">
                                  {formatNumber(pricing.durationDiscountPercent)}% off
                                </span>
                              </div>
                              <p className="text-xs text-blue-700 mt-1">
                                {pricing.weeksStaying >= 3 && pricing.weeksStaying <= 10 ? (
                                  <>You're booking for {formatNumber(pricing.weeksStaying)} weeks, which gives you a {formatNumber(pricing.durationDiscountPercent)}% discount.</>
                                ) : pricing.weeksStaying > 10 ? (
                                  <>You're booking for {formatNumber(pricing.weeksStaying)} weeks, which gives you our maximum 20% discount.</>
                                ) : null}
                              </p>
                            </div>
                          )}
                          
                          {/* Total Savings */}
                          <div className="xl:flex xl:justify-between xl:items-center px-2">
                            <span className="text-stone-600 text-sm">Total savings</span>
                            <span className="text-emerald-700 font-medium block xl:inline-block mt-1 xl:mt-0">
                              €{(pricing.accommodationDiscountAmount + pricing.durationDiscountAmount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="border-t border-stone-200 pt-4 mt-4">
                <h3 className="font-medium text-stone-800 mb-3">Price Breakdown</h3>
                
                <div className="space-y-3">
                  {/* Accommodation pricing - Simplified */}
                  <div className="flex justify-between text-stone-600">
                    <span>Accommodation ({pricing.totalNights} nights)</span>
                    <span>€{pricing.totalAccommodationCost.toFixed(2)}</span>
                  </div>
                  
                  {/* Food & Facilities with Contribution Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-stone-600">
                      <span>Food & facilities ({pricing.totalNights} {pricing.totalNights === 1 ? 'night' : 'nights'})</span>
                      <span>€{pricing.totalFoodAndFacilitiesCost.toFixed(2)}</span>
                    </div>
                    
                    {/* Contribution Slider */}
                    <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-medium text-stone-800">Weekly Contribution</h4>
                        <span className="text-sm font-medium bg-emerald-600 text-white px-3 py-1 rounded-full">
                          €{foodContribution}
                        </span>
                      </div>
                      
                      <p className="text-xs text-stone-600 mb-4">
                        Choose how much you'd like to contribute to food & facilities per week based on your means. 
                        {pricing.totalNights <= 6 
                          ? ' For stays of 6 nights or less, the range is €345-€390 per week.' 
                          : ' For stays of 7+ nights, the range is €240-€390 per week.'}
                      </p>
                      
                      {/* Simplified slider implementation */}
                      <div className="mb-6">
                        {/* Simple slider with labels */}
                        <div className="flex justify-between text-xs text-stone-600 mb-2">
                          <span>€{pricing.totalNights <= 6 ? '345' : '240'}</span>
                          <span>€390</span>
                        </div>
                        
                        {/* Standard HTML range input with better styling */}
                        <input 
                          type="range" 
                          min={pricing.totalNights <= 6 ? 345 : 240} 
                          max={390} 
                          step={1}
                          value={foodContribution || 0}
                          onChange={(e) => {
                            const newValue = Number(e.target.value);
                            setFoodContribution(newValue);
                            console.log('[BookingSummary] Food contribution changed:', newValue, 'per week');
                          }}
                          className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        
                        {/* Display only the min/max values */}
                        <div className="flex justify-between text-xs text-stone-600 mt-2">
                          <span>€{pricing.totalNights <= 6 ? '345' : '240'}</span>
                          <span>€390</span>
                        </div>
                      </div>
                      
                      <div className="text-xs text-stone-600 bg-stone-100 p-4 rounded-lg border border-stone-200">
                        <div className="flex items-start gap-3">
                          <span className="text-emerald-700 mt-0.5 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          <div className="flex-1">
                            <p className="mb-2 text-stone-700 font-medium">Your contribution helps us:</p>
                            <ul className="list-disc list-inside space-y-1.5 pl-0 mb-3">
                              <li>Provide meals during your stay</li>
                              <li>Maintain our community spaces</li>
                              <li>Ongoing Technical & Wellness Upgrades</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 font-medium text-stone-800 border-t border-stone-200 pt-3 mt-2">
                    <span className="col-span-1">Total</span>
                    <span className="col-span-1 text-right whitespace-nowrap">€{pricing.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Test Payment Option for Admins */}
              {isAdmin && (
                <div className="mt-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-2">Test Payment Options</h4>
                  <div className="flex items-center gap-3 mb-2">
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
                      className="px-3 py-2 border border-blue-300 rounded-md w-32 text-blue-800"
                    />
                    <span className="text-sm text-blue-600">Set custom test amount (€)</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTestPaymentAmount(0.50)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs rounded"
                    >
                      €0.50
                    </button>
                    <button
                      onClick={() => setTestPaymentAmount(1)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs rounded"
                    >
                      €1.00
                    </button>
                    <button
                      onClick={() => setTestPaymentAmount(null)}
                      className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs rounded ml-auto"
                    >
                      Reset
                    </button>
                  </div>
                  {testPaymentAmount !== null && (
                    <p className="text-xs text-blue-600 mt-2">
                      Using test payment amount: <strong>€{testPaymentAmount.toFixed(2)}</strong> instead of €{pricing.totalAmount.toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <motion.button
                  onClick={handleConfirmClick}
                  disabled={!selectedAccommodation || isBooking}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-all disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed font-serif text-lg pixel-corners shadow-sm flex items-center justify-center"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isBooking ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                    className="w-full bg-white border-2 border-emerald-600 text-emerald-700 py-3 rounded-lg hover:bg-emerald-50 transition-all disabled:bg-stone-100 disabled:border-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed font-serif text-lg pixel-corners shadow-sm flex items-center justify-center"
                    whileHover={{ scale: 1.02, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isBooking ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            <div className="text-stone-500 text-center py-8">
              Select dates to see pricing
            </div>
          )}
        </div>
      </div>
    </>
  );
}