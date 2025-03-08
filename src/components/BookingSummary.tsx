import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar } from 'lucide-react';
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
      ? 'High Season' 
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
    discountPercentage: `${(seasonalDiscount * 100).toFixed(1)}%`,
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

  // Hooks
  const { getArrivalDepartureForDate } = useSchedulingRules();
  const navigate = useNavigate();
  const session = useSession();
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' || session?.user?.email === 'redis213@gmail.com';

  // Get flexible dates from the first week if available
  const flexibleDates = selectedWeeks[0]?.flexibleDates;
  const hasFlexibleDates = flexibleDates && flexibleDates.length > 0;

  // Calculate pricing details
  const pricing = calculatePricing(selectedWeeks, selectedAccommodation, baseRate, seasonBreakdown, foodContribution);

  // If no flexible dates are available, use the first week's start date
  useEffect(() => {
    if (selectedWeeks.length > 0) {
      if (!hasFlexibleDates || !selectedCheckInDate) {
        setSelectedCheckInDate(selectedWeeks[0].startDate);
      }
    } else {
      setSelectedCheckInDate(null);
    }
  }, [selectedWeeks, hasFlexibleDates, selectedCheckInDate]);

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
      // Keep the same duration as originally selected
      const totalDays = differenceInDays(
        selectedWeeks[selectedWeeks.length - 1].endDate,
        selectedWeeks[0].startDate
      );
      const checkOut = addDays(selectedCheckInDate, totalDays);

      console.log('[Booking Summary] Date debug:', {
        selectedWeeks,
        firstWeek: selectedWeeks[0],
        selectedCheckIn: selectedCheckInDate,
        checkOut,
        totalDays
      });

      console.log('[Booking Summary] Starting booking process...');
      setIsBooking(true);
      setError(null);
      
      try {
        console.log('[Booking Summary] Creating booking:', {
          accommodationId: selectedAccommodation.id,
          checkIn: selectedCheckInDate.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          totalPrice: pricing.totalAmountInCents // Use cents as integer
        });

        const booking = await bookingService.createBooking({
          accommodationId: selectedAccommodation.id,
          checkIn: selectedCheckInDate.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0],
          totalPrice: pricing.totalAmountInCents // Use cents as integer
        });

        console.log('[Booking Summary] Booking created:', booking);
        
        // Navigate to success page
        navigate(`/booking-success/${booking.id}`);
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
  }, [selectedAccommodation, selectedWeeks, selectedCheckInDate, navigate, pricing.totalAmountInCents]);

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
                total={pricing.totalAmount}
                description={`${selectedAccommodation?.title || 'Accommodation'} for ${pricing.totalNights} nights`}
                onSuccess={handleBookingSuccess}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-4">
        <div className="bg-white p-8 pixel-corners">
          <h2 className="text-2xl font-serif font-light text-stone-900 mb-4">
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
              <div className="bg-stone-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-stone-800">Stay Details</h3>
                  <button
                    onClick={onClearWeeks}
                    className="text-stone-400 hover:text-stone-600"
                    title="Clear selected dates"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Date Range */}
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600">Dates</span>
                    <span className="text-stone-800 font-medium">{formatOverallDateRange(selectedWeeks)}</span>
                  </div>
                  
                  {/* Nights */}
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600">Duration</span>
                    <span className="text-stone-800 font-medium">{pricing.totalNights} nights</span>
                  </div>
                  
                  {/* Check-in Date */}
                  {hasFlexibleDates ? (
                    <div className="mt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-stone-600">Check-in</span>
                        <span className="text-stone-800 font-medium">
                          {selectedCheckInDate ? format(selectedCheckInDate, 'EEE, MMM d') : 'Select a date'}
                        </span>
                      </div>
                      
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2">
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-emerald-800 mb-1">
                              Flexible check-in available for this period.
                            </p>
                            <button
                              onClick={() => setShowDatePicker(prev => !prev)}
                              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                            >
                              {showDatePicker ? 'Hide options' : 'Choose check-in date'}
                            </button>
                            <AnimatePresence>
                              {showDatePicker && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="mt-2"
                                >
                                  <DayPicker
                                    mode="single"
                                    selected={selectedCheckInDate || undefined}
                                    onSelect={(date) => {
                                      if (date) {
                                        setSelectedCheckInDate(date);
                                        setShowDatePicker(false);
                                        setError(null);
                                      }
                                    }}
                                    disabled={(date) => !flexibleDates?.some(d => isSameDay(d, date))}
                                    defaultMonth={selectedWeeks[0]?.startDate || new Date()}
                                    className="bg-white border border-emerald-200 rounded-lg p-2 shadow-sm"
                                    modifiersClassNames={{
                                      selected: 'bg-emerald-600 text-white hover:bg-emerald-500',
                                      today: 'font-bold text-emerald-900'
                                    }}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600">Check-in</span>
                      <span className="text-stone-800 font-medium">{format(selectedWeeks[0].startDate, 'EEE, MMM d')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Accommodation Section */}
              {selectedAccommodation && (
                <div className="bg-stone-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-stone-800">Accommodation</h3>
                    <button
                      onClick={onClearAccommodation}
                      className="text-stone-400 hover:text-stone-600"
                      title="Clear selected accommodation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600">Selected</span>
                    <span className="text-stone-800 font-medium">{selectedAccommodation.title}</span>
                  </div>
                </div>
              )}

              {/* Season Information - only show for non-free accommodations */}
              {selectedAccommodation && selectedAccommodation.base_price > 0 && (
                seasonBreakdown?.hasMultipleSeasons ? (
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <h3 className="font-medium text-amber-800 mb-2">Seasonal Pricing</h3>
                    <div className="space-y-2">
                      {seasonBreakdown.seasons.map((season, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              season.name === 'High Season' ? 'bg-amber-500' : 
                              season.name === 'Shoulder Season' ? 'bg-amber-300' : 'bg-amber-200'
                            }`}></div>
                            <span className="text-amber-800">{season.name}</span>
                          </div>
                          <div className="text-amber-800">
                            <span className="font-medium">{season.nights} {season.nights === 1 ? 'night' : 'nights'}</span>
                            {season.discount > 0 && (
                              <span className="ml-1 text-xs">({Math.round(season.discount * 100)}% off)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  pricing.seasonalDiscount > 0 && selectedAccommodation && selectedAccommodation.base_price > 0 && (
                    <div className="bg-emerald-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-emerald-800">Seasonal Discount</h3>
                        <span className="text-emerald-800 font-medium">{Math.round(pricing.seasonalDiscount * 100)}% off</span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-1">
                        You're booking during {pricing.seasonName}, which offers a discount on accommodation.
                      </p>
                    </div>
                  )
                )
              )}

              {/* Duration Discount Information - Simplified */}
              {pricing.durationDiscountAmount > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-blue-800">Duration Discount</h3>
                    <span className="text-blue-800 font-medium">
                      {pricing.durationDiscountPercent.toFixed(1)}% off
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    {pricing.weeksStaying >= 3 && pricing.weeksStaying <= 10 ? (
                      <>You're booking for {pricing.weeksStaying.toFixed(1)} weeks, which gives you a {pricing.durationDiscountPercent.toFixed(1)}% discount on your entire stay.</>
                    ) : pricing.weeksStaying > 10 ? (
                      <>You're booking for {pricing.weeksStaying.toFixed(1)} weeks, which gives you our maximum 20% discount on your entire stay.</>
                    ) : null}
                  </p>
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
                          <span>€{pricing.totalNights <= 6 ? '368' : '315'}</span>
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
                        
                        {/* Labels for the preset options */}
                        <div className="flex justify-between text-xs text-stone-600 mt-2">
                          <span>Subsidized</span>
                          <span>Standard</span>
                          <span>Supporter</span>
                        </div>
                      </div>
                      
                      {/* Quick selection buttons */}
                      <div className="flex justify-between gap-2 mb-4">
                        <button 
                          onClick={() => setFoodContribution(pricing.totalNights <= 6 ? 345 : 240)}
                          className={`text-xs py-1.5 rounded-full transition-colors flex-1 ${
                            foodContribution === (pricing.totalNights <= 6 ? 345 : 240) 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          Subsidized
                        </button>
                        <button 
                          onClick={() => setFoodContribution(pricing.totalNights <= 6 ? 368 : 315)}
                          className={`text-xs py-1.5 rounded-full transition-colors flex-1 ${
                            foodContribution === (pricing.totalNights <= 6 ? 368 : 315) 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          Standard
                        </button>
                        <button 
                          onClick={() => setFoodContribution(390)}
                          className={`text-xs py-1.5 rounded-full transition-colors flex-1 ${
                            foodContribution === 390 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          Supporter
                        </button>
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
                              <li>Cover operational costs</li>
                            </ul>
                            
                            <div className="pt-2 border-t border-stone-200">
                              <p className="mt-2 font-medium">Total for your stay: <span className="text-emerald-700">€{pricing.totalFoodAndFacilitiesCost.toFixed(2)}</span></p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Duration Discount in price breakdown - Improved alignment */}
                  {pricing.durationDiscountAmount > 0 && (
                    <div className="grid grid-cols-2 text-stone-600 py-2">
                      <span className="col-span-1">Duration Discount ({pricing.weeksStaying.toFixed(1)} weeks)</span>
                      <span className="col-span-1 text-right text-blue-600 font-medium whitespace-nowrap">
                        -{pricing.durationDiscountPercent.toFixed(1)}% (€{pricing.durationDiscountAmount.toFixed(2)})
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 font-medium text-stone-800 border-t border-stone-200 pt-3 mt-2">
                    <span className="col-span-1">Total</span>
                    <span className="col-span-1 text-right whitespace-nowrap">€{pricing.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <motion.button
                  onClick={handleConfirmClick}
                  disabled={!selectedAccommodation || isBooking}
                  className="w-full bg-emerald-900 text-white py-3 rounded-lg hover:bg-emerald-800 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed font-serif text-lg pixel-corners"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isBooking ? 'Processing...' : 'Confirm Booking'}
                </motion.button>

                {isAdmin && (
                  <motion.button
                    onClick={handleAdminConfirm}
                    disabled={!selectedAccommodation || isBooking}
                    className="w-full bg-rose-600 text-white py-3 rounded-lg hover:bg-rose-700 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed font-serif text-lg pixel-corners"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isBooking ? 'Processing...' : 'Admin Confirm (No Payment)'}
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