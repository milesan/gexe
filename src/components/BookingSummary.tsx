import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSchedulingRules } from '../hooks/useSchedulingRules';
import { getSeasonalDiscount, getDurationDiscount } from '../utils/pricing';
import type { Accommodation } from '../types';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/BookingService';
import { supabase } from '../lib/supabase';
import { StripeCheckoutForm } from './StripeCheckoutForm';
import { useSession } from '../hooks/useSession';

interface Props {
  selectedWeeks: Date[];
  selectedAccommodation: Accommodation | null;
  baseRate: number;
  onClearWeeks: () => void;
  onClearAccommodation: () => void;
}

export function BookingSummary({
  selectedWeeks,
  selectedAccommodation,
  baseRate,
  onClearWeeks,
  onClearAccommodation,
}: Props) {
  console.log('[Booking Summary] Component mounted with:', {
    selectedWeeks: selectedWeeks.map(w => w.toISOString()),
    selectedAccommodation: selectedAccommodation?.title,
    baseRate
  });

  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const { getArrivalDepartureForDate } = useSchedulingRules();
  const navigate = useNavigate();
  const session = useSession();
  const isAdmin = session?.user?.email === 'andre@thegarden.pt';

  useEffect(() => {
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

    const startDate = selectedWeeks[0];
    const endDate = addDays(selectedWeeks[selectedWeeks.length - 1], 6);
    
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

  if (selectedWeeks.length === 0 && !selectedAccommodation) return null;

  const numberOfWeeks = selectedWeeks.length;
  const baseAccommodationRate = selectedAccommodation?.price || 0;
  
  // Calculate seasonal discount
  const seasonalDiscount = selectedWeeks.length > 0 ? 
    selectedWeeks.reduce((acc, week) => acc + getSeasonalDiscount(week), 0) / selectedWeeks.length : 
    0;

  // Calculate duration discount
  const durationDiscount = getDurationDiscount(numberOfWeeks);
  
  // Apply seasonal discount to accommodation rate
  const accommodationRate = baseAccommodationRate * (1 - seasonalDiscount);

  // Special December 2024 rate for food & facilities
  const effectiveBaseRate = selectedWeeks.some(week => {
    const month = week.getMonth();
    const year = week.getFullYear();
    return month === 11 && year === 2024;
  }) ? 190 : baseRate;

  const weeklyRate = effectiveBaseRate + Math.round(accommodationRate);
  const subtotal = weeklyRate * numberOfWeeks;
  const durationDiscountAmount = Math.round(subtotal * durationDiscount);
  const totalAmount = Math.round(subtotal - durationDiscountAmount);

  const handleBookingSuccess = async () => {
    if (!selectedAccommodation) {
      console.warn('[Booking Summary] No accommodation selected for booking');
      return;
    }
    
    console.log('[Booking Summary] Starting booking process...');
    setIsBooking(true);
    setError(null);
    
    try {
      const checkIn = selectedWeeks[0];
      const checkOut = addDays(selectedWeeks[selectedWeeks.length - 1], 6);
      
      console.log('[Booking Summary] Creating booking:', {
        accommodationId: selectedAccommodation.id,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        totalPrice: totalAmount
      });

      const booking = await bookingService.createBooking({
        accommodationId: selectedAccommodation.id,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        totalPrice: totalAmount
      });

      console.log('[Booking Summary] Booking created:', booking);

      // Update booking status to confirmed after successful payment
      console.log('[Booking Summary] Updating booking status to confirmed...');
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'confirmed',
          payment_intent_id: booking.id // Use booking ID as payment intent for now
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('[Booking Summary] Error updating booking status:', updateError);
        throw updateError;
      }

      console.log('[Booking Summary] Booking status updated successfully');
      
      onClearWeeks();
      onClearAccommodation();
      setShowStripeModal(false);
      
      console.log('[Booking Summary] Navigating to confirmation page...');
      navigate('/confirmation', {
        state: {
          booking: {
            checkIn,
            checkOut,
            accommodation: selectedAccommodation.title,
            totalPrice: totalAmount,
            guests: 1
          }
        }
      });
    } catch (err) {
      console.error('[Booking Summary] Error in booking process:', err);
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setIsBooking(false);
    }
  };

  const handleConfirmClick = async () => {
    console.log('[Booking Summary] Confirm button clicked');
    setError(null);
    
    if (!authToken) {
      console.warn('[Booking Summary] No auth token available');
      setError('Authentication required');
      return;
    }

    try {
      console.log('[Booking Summary] Validating availability before showing payment modal');
      const isAvailable = await validateAvailability();
      if (!isAvailable) {
        console.warn('[Booking Summary] Accommodation no longer available');
        setError('Selected accommodation is no longer available for these dates');
        return;
      }

      console.log('[Booking Summary] Showing Stripe modal');
      setShowStripeModal(true);
    } catch (err) {
      console.error('[Booking Summary] Error in confirm process:', err);
      setError('Failed to validate availability. Please try again.');
    }
  };

  const handleAdminConfirm = async () => {
    if (!selectedAccommodation) {
      console.warn('[Booking Summary] No accommodation selected for admin booking');
      return;
    }
    
    console.log('[Booking Summary] Starting admin booking process...');
    setIsBooking(true);
    setError(null);
    
    try {
      const checkIn = selectedWeeks[0];
      const checkOut = addDays(selectedWeeks[selectedWeeks.length - 1], 6);
      
      console.log('[Booking Summary] Creating admin booking:', {
        accommodationId: selectedAccommodation.id,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        totalPrice: totalAmount,
        isAdmin: true
      });

      await bookingService.createBooking({
        accommodationId: selectedAccommodation.id,
        checkIn,
        checkOut,
        totalPrice: totalAmount,
        isAdmin: true
      });
      
      console.log('[Booking Summary] Admin booking created successfully');
      onClearWeeks();
      onClearAccommodation();
      
      console.log('[Booking Summary] Navigating to confirmation page...');
      navigate('/confirmation', {
        state: {
          booking: {
            checkIn,
            checkOut,
            accommodation: selectedAccommodation.title,
            totalPrice: totalAmount,
            guests: 1
          }
        }
      });
    } catch (err) {
      console.error('[Booking Summary] Error in admin booking process:', err);
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setIsBooking(false);
    }
  };

  // Get arrival/departure days for first and last week
  const firstWeek = selectedWeeks[0];
  const lastWeek = selectedWeeks[selectedWeeks.length - 1];
  
  const firstWeekDays = firstWeek ? getArrivalDepartureForDate(firstWeek) : null;
  const lastWeekDays = lastWeek ? getArrivalDepartureForDate(lastWeek) : null;

  return (
    <>
      <div 
        className="lg:sticky lg:z-50" 
        style={{ 
          position: '-webkit-sticky',
          position: 'sticky',
          top: 'calc(4.5rem + 1px)', // Height of navbar (4.5rem) plus border (1px)
          height: 'fit-content',
          maxHeight: 'calc(100vh - 4.5rem - 2rem)', // Viewport height minus navbar height minus some padding
          overflowY: 'auto'
        }}
      >
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
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">{numberOfWeeks} weeks</h3>
                  <button
                    onClick={onClearWeeks}
                    className="text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-stone-600">
                  <div className="text-lg font-serif">
                    {format(firstWeek, 'MMM d')} → {format(addDays(lastWeek, 6), 'MMM d')}
                  </div>
                  <div className="text-sm">
                    Check-in {firstWeekDays?.arrival.charAt(0).toUpperCase() + firstWeekDays?.arrival.slice(1)} 3-6PM
                  </div>
                  <div className="text-sm">
                    Check-out {lastWeekDays?.departure.charAt(0).toUpperCase() + lastWeekDays?.departure.slice(1)} 12PM
                  </div>
                </div>
              </div>

              {selectedAccommodation && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{selectedAccommodation.title}</h3>
                    <button
                      onClick={onClearAccommodation}
                      className="text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 font-mono text-base">
                <div className="text-right">€{effectiveBaseRate}</div>
                <div className="text-center text-stone-400">+</div>
                <div>
                  {selectedAccommodation?.price === 0 ? 'Free' : `€${Math.round(accommodationRate)}`}
                </div>
                <div className="text-right text-stone-500">food & facilities</div>
                <div></div>
                <div className="text-stone-500">accommodation</div>
              </div>

              <div className="border-t border-stone-200 pt-4">
                <div className="flex justify-between text-stone-600 mb-4">
                  <span>€{weeklyRate} × {numberOfWeeks} weeks</span>
                  <span>€{subtotal}</span>
                </div>

                {durationDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 mb-4">
                    <span>{Math.round(durationDiscount * 100)}% duration discount</span>
                    <span>-€{durationDiscountAmount}</span>
                  </div>
                )}

                <div className="flex justify-between text-xl font-serif border-t border-stone-200 pt-4">
                  <span>Total</span>
                  <span>€{totalAmount}</span>
                </div>
              </div>

              <motion.button
                onClick={handleConfirmClick}
                disabled={!selectedAccommodation || isBooking}
                className="w-full bg-emerald-900 text-white py-3 rounded-lg hover:bg-emerald-800 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed font-serif text-lg pixel-corners"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isBooking ? 'Processing...' : 'Confirm'}
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
          )}
        </div>
      </div>

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

              {authToken && selectedAccommodation && (
                console.log('[Booking Summary] Auth Token:', authToken),
                <StripeCheckoutForm
                  authToken={authToken}
                  total={totalAmount}
                  description={`${selectedAccommodation.title} for ${numberOfWeeks} weeks`}
                  onSuccess={handleBookingSuccess}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}