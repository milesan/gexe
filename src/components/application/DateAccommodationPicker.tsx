import React, { useState, useEffect } from 'react';
import { Calendar, Home, Info } from 'lucide-react';
import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { useWeeklyAccommodations } from '../../hooks/useWeeklyAccommodations';
import { motion, AnimatePresence } from 'framer-motion';

interface DateAccommodationPickerProps {
  onDatesChange: (checkIn: Date | null, checkOut: Date | null) => void;
  onAccommodationChange: (accommodationId: string | null) => void;
  initialCheckIn?: Date | null;
  initialCheckOut?: Date | null;
  initialAccommodation?: string | null;
  minStay?: number;
  maxStay?: number;
}

export function DateAccommodationPicker({
  onDatesChange,
  onAccommodationChange,
  initialCheckIn = null,
  initialCheckOut = null,
  initialAccommodation = null,
  minStay = 7,
  maxStay = 84
}: DateAccommodationPickerProps) {
  const [checkIn, setCheckIn] = useState<Date | null>(initialCheckIn);
  const [checkOut, setCheckOut] = useState<Date | null>(initialCheckOut);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(initialAccommodation);
  const [dateError, setDateError] = useState<string>('');
  
  const { accommodations, loading: accommodationsLoading } = useWeeklyAccommodations();

  // Validate dates
  useEffect(() => {
    if (checkIn && checkOut) {
      const days = differenceInDays(checkOut, checkIn);
      if (days < minStay) {
        setDateError(`Minimum stay is ${minStay} days`);
      } else if (days > maxStay) {
        setDateError(`Maximum stay is ${maxStay} days`);
      } else if (isBefore(checkOut, checkIn)) {
        setDateError('Check-out must be after check-in');
      } else {
        setDateError('');
      }
    } else {
      setDateError('');
    }
  }, [checkIn, checkOut, minStay, maxStay]);

  // Handle check-in date change
  const handleCheckInChange = (date: Date | null) => {
    setCheckIn(date);
    
    // Auto-set checkout to minimum stay if not set
    if (date && !checkOut) {
      const suggestedCheckOut = addDays(date, minStay);
      setCheckOut(suggestedCheckOut);
      onDatesChange(date, suggestedCheckOut);
    } else {
      onDatesChange(date, checkOut);
    }
  };

  // Handle check-out date change
  const handleCheckOutChange = (date: Date | null) => {
    setCheckOut(date);
    onDatesChange(checkIn, date);
  };

  // Handle accommodation selection
  const handleAccommodationSelect = (id: string) => {
    const newSelection = selectedAccommodation === id ? null : id;
    setSelectedAccommodation(newSelection);
    onAccommodationChange(newSelection);
  };

  // Get today's date in YYYY-MM-DD format for date input min attribute
  const today = format(new Date(), 'yyyy-MM-dd');
  const minCheckOut = checkIn ? format(addDays(checkIn, minStay), 'yyyy-MM-dd') : today;
  const maxCheckOut = checkIn ? format(addDays(checkIn, maxStay), 'yyyy-MM-dd') : undefined;

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-retro-accent flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Select Your Dates
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-mono text-retro-accent mb-2">
              Check-in Date
            </label>
            <input
              type="date"
              value={checkIn ? format(checkIn, 'yyyy-MM-dd') : ''}
              onChange={(e) => handleCheckInChange(e.target.value ? new Date(e.target.value) : null)}
              min={today}
              className="w-full px-3 py-2 bg-black border border-retro-accent text-retro-accent font-mono focus:outline-none focus:border-retro-accent-bright"
            />
          </div>
          
          <div>
            <label className="block text-sm font-mono text-retro-accent mb-2">
              Check-out Date
            </label>
            <input
              type="date"
              value={checkOut ? format(checkOut, 'yyyy-MM-dd') : ''}
              onChange={(e) => handleCheckOutChange(e.target.value ? new Date(e.target.value) : null)}
              min={minCheckOut}
              max={maxCheckOut}
              disabled={!checkIn}
              className="w-full px-3 py-2 bg-black border border-retro-accent text-retro-accent font-mono focus:outline-none focus:border-retro-accent-bright disabled:opacity-50"
            />
          </div>
        </div>

        {/* Date Error or Info */}
        <AnimatePresence>
          {dateError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-red-500 text-sm font-mono flex items-center gap-2"
            >
              <Info className="w-4 h-4" />
              {dateError}
            </motion.div>
          )}
        </AnimatePresence>

        {checkIn && checkOut && !dateError && (
          <div className="text-retro-accent-dim text-sm font-mono">
            {differenceInDays(checkOut, checkIn)} days selected
          </div>
        )}
      </div>

      {/* Accommodation Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-retro-accent flex items-center gap-2">
          <Home className="w-5 h-5" />
          Select Your Accommodation
        </h3>

        {accommodationsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-retro-accent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {accommodations?.filter(acc => !acc.parent_accommodation_id).map((accommodation) => (
              <motion.button
                key={accommodation.id}
                onClick={() => handleAccommodationSelect(accommodation.id)}
                className={`p-4 border text-left transition-all ${
                  selectedAccommodation === accommodation.id
                    ? 'border-retro-accent bg-retro-accent/10 text-retro-accent'
                    : 'border-retro-accent/30 text-retro-accent-dim hover:border-retro-accent/60'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="font-mono text-sm font-bold mb-1">
                  {accommodation.title}
                </div>
                <div className="text-xs opacity-80">
                  €{accommodation.base_price}/week
                </div>
                {accommodation.description && (
                  <div className="text-xs mt-2 opacity-60 line-clamp-2">
                    {accommodation.description}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {selectedAccommodation && (
          <div className="text-retro-accent-dim text-sm font-mono">
            Selected: {accommodations?.find(a => a.id === selectedAccommodation)?.title}
          </div>
        )}
      </div>

      {/* Summary */}
      {checkIn && checkOut && selectedAccommodation && !dateError && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 border border-retro-accent/50 bg-retro-accent/5"
        >
          <h4 className="text-retro-accent font-mono font-bold mb-2">Your Selection:</h4>
          <div className="space-y-1 text-sm font-mono text-retro-accent-dim">
            <div>Check-in: {format(checkIn, 'MMMM d, yyyy')}</div>
            <div>Check-out: {format(checkOut, 'MMMM d, yyyy')}</div>
            <div>Accommodation: {accommodations?.find(a => a.id === selectedAccommodation)?.title}</div>
            <div>Duration: {differenceInDays(checkOut, checkIn)} days</div>
          </div>
          <div className="mt-3 text-xs text-retro-accent-dim">
            Note: These selections will be reserved for 72 hours if your application is approved.
            You can change them later if needed.
          </div>
        </motion.div>
      )}
    </div>
  );
}