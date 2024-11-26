import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCredits } from '../hooks/useCredits';
import { useSchedulingRules } from '../hooks/useSchedulingRules';
import { getSeasonalDiscount, getDurationDiscount } from '../utils/pricing';
import type { Accommodation } from '../types';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createBooking } from '../services/bookings';

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
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { credits, loading: creditsLoading, refresh: refreshCredits } = useCredits();
  const { getArrivalDepartureForDate } = useSchedulingRules();
  const navigate = useNavigate();

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

  const handleBooking = async () => {
    if (!selectedAccommodation) return;
    
    if (credits < totalAmount) {
      setError(`Insufficient credits. You need €${totalAmount} but have €${credits}`);
      return;
    }

    setIsBooking(true);
    setError(null);
    
    try {
      const checkIn = selectedWeeks[0];
      const checkOut = addDays(selectedWeeks[selectedWeeks.length - 1], 6);
      
      await createBooking(
        selectedAccommodation.id,
        checkIn,
        checkOut,
        totalAmount,
        false
      );
      
      await refreshCredits();
      onClearWeeks();
      onClearAccommodation();
      
      // Navigate to confirmation page with booking details
      navigate('/payment', {
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
              onClick={handleBooking}
              disabled={!selectedAccommodation || isBooking || creditsLoading}
              className="w-full bg-emerald-900 text-white py-3 rounded-lg hover:bg-emerald-800 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed font-serif text-lg pixel-corners"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isBooking ? 'Processing...' : 'Confirm'}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}