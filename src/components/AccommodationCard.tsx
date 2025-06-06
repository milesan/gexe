//TODO: Dead code? Remove?
/*
import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import type { Database } from '../types/database';
import { BookingModal } from './BookingModal';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { getDurationDiscount } from '../utils/pricing';

type Accommodation = Database['public']['Tables']['accommodations']['Row'];

interface AccommodationCardProps {
  accommodation: Accommodation;
  checkIn?: Date;
  checkOut?: Date;
}

export function AccommodationCard({ accommodation, checkIn, checkOut }: AccommodationCardProps) {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | null>(null);
  const basePrice = accommodation.base_price;
  const threeWeekDiscount = basePrice * getDurationDiscount(3);
  const sixWeekDiscount = basePrice * getDurationDiscount(6);

  useEffect(() => {
    if (checkIn && checkOut) {
      checkAvailability();
    }
  }, [checkIn, checkOut]);

  const checkAvailability = async () => {
    console.log('[AccommodationCard] checkAvailability called for:', {
      accommodationId: accommodation.id,
      checkIn,
      checkOut
    });
    if (!checkIn || !checkOut) return;

    try {
      console.log('[AccommodationCard] Querying supabase for availability');
      const { data: unavailableDates, error } = await supabase
        .from('availability')
        .select('*')
        .eq('accommodation_id', accommodation.id)
        .in('status', ['BOOKED', 'HOLD'])
        .gte('date', checkIn.toISOString().split('T')[0])
        .lt('date', checkOut.toISOString().split('T')[0]);

      if (error) throw error;

      const available = !unavailableDates || unavailableDates.length === 0;
      console.log('[AccommodationCard] Availability result:', { available, unavailableDates });
      setIsAvailable(available);

      if (!available) {
        const { data: nextAvailable } = await supabase
          .from('availability')
          .select('date')
          .eq('accommodation_id', accommodation.id)
          .gt('date', checkOut.toISOString().split('T')[0])
          .not('status', 'in', '("BOOKED","HOLD")')
          .order('date', { ascending: true })
          .limit(1)
          .single();

        if (nextAvailable) {
          setNextAvailableDate(new Date(nextAvailable.date));
        }
      }
    } catch (err) {
      console.error('Error checking availability:', err);
    }
  };

  const handleClick = () => {
    if (checkIn && checkOut && isAvailable) {
      setShowBookingModal(true);
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group cursor-pointer ${!isAvailable ? 'opacity-50 grayscale pointer-events-none' : ''}`}
        onClick={handleClick}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
          <img
            src={accommodation.image_url || ''}
            alt={accommodation.title}
            className={`object-cover w-full h-full ${isAvailable ? 'group-hover:scale-105' : ''} transition-transform duration-500`}
          />
          {!isAvailable && nextAvailableDate && (
            <div className="absolute inset-x-0 bottom-0 bg-black bg-opacity-75 text-white px-4 py-3 text-center font-medium backdrop-blur-sm">
              Available from {format(nextAvailableDate, 'MMMM d')}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-display text-xl text-stone-900">{accommodation.title}</h3>
              <p className="text-stone-500 mt-1">{accommodation.type}</p>
            </div>
            <div className="flex items-center gap-1 text-stone-700">
              <Star className="w-4 h-4 fill-current text-stone-900" />
              <span className="font-medium">4.8</span>
            </div>
          </div>

          <p className="text-stone-500 mt-2">
            {accommodation.type} · {accommodation.inventory} guests
            {accommodation.has_wifi ? ' · WiFi' : ''}
            {accommodation.has_electricity ? ' · Electricity' : ''}
          </p>

          <div className="mt-4 space-y-1">
            <p className="font-display text-lg text-stone-900">
              €{basePrice} <span className="text-stone-500 text-base">per week</span>
            </p>
            <p className="text-sm text-stone-500">
              3+ weeks: €{(basePrice - threeWeekDiscount).toFixed(0)} per week
            </p>
            <p className="text-sm text-stone-500">
              6+ weeks: €{(basePrice - sixWeekDiscount).toFixed(0)} per week
            </p>
          </div>
        </div>
      </motion.div>

      {showBookingModal && checkIn && checkOut && (
        <BookingModal
          accommodation={{
            id: accommodation.id,
            title: accommodation.title,
            price: accommodation.base_price
          }}
          checkIn={checkIn}
          checkOut={checkOut}
          onClose={() => setShowBookingModal(false)}
          onBookingComplete={() => {
            setShowBookingModal(false);
          }}
        />
      )}
    </>
  );
}
*/