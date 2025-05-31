import React, { useState, useEffect } from 'react';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StatusModal } from './StatusModal';
import type { AvailabilityStatus } from '../types/availability';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeToUTCDate, formatDateForDisplay } from '../utils/dates';
import { calculateDaysBetween } from '../utils/dates';

interface Props {
  onClose: () => void;
}

interface Booking {
  id: string;
  check_in: Date;
  check_out: Date;
  status: string;
}

interface AvailabilityData {
  availability_date: Date;
  accommodation_id: string;
  title: string;
  is_available: boolean;
  available_capacity: number | null;
  bookings: Booking[];
}

interface DailyAvailability {
  [date: string]: {
    [accommodationId: string]: AvailabilityData;
  };
}

export function InventoryCalendar({ onClose }: Props) {
  const [events, setEvents] = useState<Booking[]>([]);
  const [accommodations, setAccommodations] = useState<any[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string>('all');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyAvailability, setDailyAvailability] = useState<DailyAvailability>({});

  const daysInMonth = Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, 
    (_, i) => {
      // Create dates in UTC from the start to avoid timezone conversion issues
      const utcDate = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), i + 1));
      return utcDate;
    });

  useEffect(() => {
    loadData();
  }, [currentDate, selectedAccommodation]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Get all accommodations
      const { data: accommodationsData, error: accommodationsError } = await supabase
        .from('accommodations')
        .select('*')
        .order('title');

      if (accommodationsError) throw accommodationsError;
      
      // Filter out unlimited accommodations (Your own tent, van parking, etc.) and test accommodations
      const filteredAccommodations = accommodationsData.filter(acc => 
        !acc.is_unlimited && 
        !acc.title.toLowerCase().includes('test')
      );
      setAccommodations(filteredAccommodations);

      // Get availability data for the current month
      // Normalize to UTC before sending to API
      const utcStartDate = normalizeToUTCDate(startOfMonth(currentDate));
      const utcEndDate = normalizeToUTCDate(endOfMonth(currentDate));
      const startDate = formatDateForDisplay(utcStartDate);
      const endDate = formatDateForDisplay(utcEndDate);

      console.log('[InventoryCalendar] Fetching availability for:', {
        startDate,
        endDate,
        utcStartDate: utcStartDate.toISOString(),
        utcEndDate: utcEndDate.toISOString()
      });

      const { data: availabilityData, error: availabilityError } = await supabase
        .rpc('get_accommodation_availability_range', {
          start_date: startDate,
          end_date: endDate
        });

      if (availabilityError) throw availabilityError;

      console.log('[InventoryCalendar] Availability data sample:', availabilityData.slice(0, 3));

      // Transform availability data into a more usable format with normalized dates
      const availability: DailyAvailability = {};
      availabilityData.forEach((data: AvailabilityData) => {
        // Normalize the availability date to UTC midnight
        
        const normalizedDate = normalizeToUTCDate(data.availability_date);
        const dateStr = formatDateForDisplay(normalizedDate);
        
        if (!availability[dateStr]) {
          availability[dateStr] = {};
        }
        
        // Ensure bookings is always an array and normalize all booking dates
        if (!data.bookings) {
          data.bookings = [];
        }
        
        // Normalize all booking dates
        const normalizedBookings = data.bookings.map(booking => ({
          ...booking,
          check_in: normalizeToUTCDate(booking.check_in),
          check_out: normalizeToUTCDate(booking.check_out)
        }));
        
        // Debug: Log any checkout dates found
        normalizedBookings.forEach(booking => {
          const checkOutDate = formatDateForDisplay(booking.check_out);
          if (checkOutDate === dateStr) {
            console.log('[InventoryCalendar] Found checkout date:', dateStr, 'for accommodation:', data.accommodation_id);
          }
        });
        
        availability[dateStr][data.accommodation_id] = {
          ...data,
          availability_date: normalizedDate,
          bookings: normalizedBookings
        };
      });

      setDailyAvailability(availability);
    } catch (err) {
      console.error('[InventoryCalendar] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const getDateStatus = (date: Date, accommodationId: string): AvailabilityStatus | number | string => {
    // Normalize the input date to UTC midnight
    const normalizedDate = normalizeToUTCDate(date);
    const dateStr = formatDateForDisplay(normalizedDate);
    const availabilityData = dailyAvailability[dateStr]?.[accommodationId];
    
    if (!availabilityData) return 'AVAILABLE';
    
    // Check for check-in/out dates first - this takes priority over capacity
    if (availabilityData.bookings && availabilityData.bookings.length > 0) {
      const hasCheckIn = availabilityData.bookings.some(b => 
        formatDateForDisplay(b.check_in) === dateStr
      );
      const hasCheckOut = availabilityData.bookings.some(b => 
        formatDateForDisplay(b.check_out) === dateStr
      );
      
      console.log(`[InventoryCalendar] Checking date status for ${dateStr} (${accommodationId}):`, {
        hasBookings: availabilityData.bookings.length > 0,
        hasCheckIn,
        hasCheckOut,
        bookingsInfo: availabilityData.bookings.map(b => ({
          id: b.id,
          checkIn: formatDateForDisplay(b.check_in),
          checkOut: formatDateForDisplay(b.check_out),
          isCheckInToday: formatDateForDisplay(b.check_in) === dateStr,
          isCheckOutToday: formatDateForDisplay(b.check_out) === dateStr,
          durationDays: calculateDaysBetween(b.check_in, b.check_out, true)
        }))
      });
      
      // Simple rule: check-out day = available, check-in day = occupied
      if (hasCheckOut && !hasCheckIn) {
        // Pure check-out day: available (just show normal capacity)
        if (typeof availabilityData.available_capacity === 'number') {
          return availabilityData.available_capacity;
        }
        return 'AVAILABLE';
      }
      
      if (hasCheckIn) {
        // Check-in day (with or without checkout): occupied
        if (typeof availabilityData.available_capacity === 'number') {
          // For capacity accommodations, just show the API's available capacity
          // (it already accounts for the booking)
          return availabilityData.available_capacity;
        }
        return 'BOOKED';
      }
    }
    
    // For regular days, show available capacity if it's a number
    if (typeof availabilityData.available_capacity === 'number') {
      return availabilityData.available_capacity;
    }
    
    // Fallback for accommodations without explicit capacity info
    if (!availabilityData.is_available) {
      return 'BOOKED';
    }
    
    return 'AVAILABLE';
  };

  const getCellContent = (accommodation: any, date: Date) => {
    const status = getDateStatus(date, accommodation.id);
    
    // Handle status-based display (symbols)
    if (typeof status === 'string') {
      switch (status) {
        case 'BOOKED':
          return '×';
        case 'PENDING':
          return '⌛';
        default: // 'AVAILABLE'
          return '✓';
      }
    }
    
    // For capacity numbers, show the number
    if (typeof status === 'number') {
      return status.toString();
    }
    
    return '✓';
  };

  const getCellStyle = (status: AvailabilityStatus | number | string) => {
    const baseStyle = 'h-8 px-2 text-center text-xs border-r cursor-pointer transition-colors';
    
    console.log('[InventoryCalendar] Getting cell style for status:', status);
    
    if (typeof status === 'number') {
      // For capacity-based accommodations (bell tents, dorms, etc.)
      if (status === 0) {
        return `${baseStyle} bg-black text-white`; // Fully booked - black
      }
      
      // Create a visual indicator using different shades of green
      if (status >= 10) {
        return `${baseStyle} bg-emerald-500 text-white`; // High availability - bright emerald
      } else if (status >= 5) {
        return `${baseStyle} bg-emerald-700 text-white`; // Medium availability - darker emerald
      } else if (status >= 3) {
        return `${baseStyle} bg-emerald-800 text-white`; // Low availability - very dark emerald
      } else if (status >= 1) {
        return `${baseStyle} bg-emerald-900 text-white`; // Very low availability - almost black emerald
      } else {
        return `${baseStyle} bg-black text-white`; // No availability - black
      }
    }

    switch (status) {
      case 'BOOKED':
        return `${baseStyle} bg-black text-white cursor-not-allowed`;
      case 'PENDING':
        return `${baseStyle} bg-yellow-400`;
      default:
        return `${baseStyle} bg-emerald-500 text-white`;
    }
  };

  const handleDateClick = (date: Date, accommodationId: string) => {
    // date is already in UTC from the table cell
    const status = getDateStatus(date, accommodationId);
    if (status === 'BOOKED') return;

    if (!selectedDates) {
      setSelectedDates({ start: date, end: date });
    } else if (selectedDates.start && !selectedDates.end) {
      if (date < selectedDates.start) {
        setSelectedDates({ start: date, end: selectedDates.start });
      } else {
        setSelectedDates({ ...selectedDates, end: date });
      }
    } else {
      setSelectedDates({ start: date, end: date });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-hidden"
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute inset-0 bg-[var(--color-bg-surface)]"
        >
          <div className="h-screen flex flex-col">
            <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-surface)]">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                  className="p-2 hover:bg-[var(--color-bg-surface-hover)] rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-display font-light text-[var(--color-text-primary)]">
                  {format(currentDate, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                  className="p-2 hover:bg-[var(--color-bg-surface-hover)] rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-3 bg-emerald-600 text-white text-xs flex items-center justify-center font-mono">25</div>
                    <span className="font-mono">Available Arrival Slots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-3 bg-emerald-500 text-white text-xs flex items-center justify-center font-mono">✓</div>
                    <span className="font-mono">Available to Check-in</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-3 bg-black text-white text-xs flex items-center justify-center font-mono">×</div>
                    <span className="font-mono">Occupied</span>
                  </div>
                  <div className="h-6 border-l border-[var(--color-border)] mx-2"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="font-mono">High Availability (10+)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-800"></div>
                    <span className="font-mono">Low Availability (1-2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-black"></div>
                    <span className="font-mono">No Availability (0)</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[var(--color-bg-surface-hover)] rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {error && (
                <div className="mb-4 p-4 bg-[var(--color-bg-error)] border-l-4 border-red-500 rounded">
                  <p className="text-[var(--color-text-error)]">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center items-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-[var(--color-border)]" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-[var(--color-bg-surface)]">
                      <tr>
                        <th className="sticky left-0 bg-[var(--color-bg-surface)] px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-[200px]">
                          Accommodation
                        </th>
                        {daysInMonth.map(day => {
                          // day is already a UTC date from daysInMonth generation
                          return (
                            <th key={day.toISOString()} className="px-2 py-2 text-center text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                              <div>{format(day, 'd')}</div>
                              <div>{format(day, 'EEE')}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)]">
                      {accommodations.map((accommodation) => (
                        <tr key={accommodation.id}>
                          <td className="sticky left-0 bg-[var(--color-bg-surface)] px-4 py-2 whitespace-nowrap border-r border-[var(--color-border)]">
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">
                              {accommodation.title} ({accommodation.inventory_count})
                            </div>
                          </td>
                          {daysInMonth.map(day => {
                            // day is already a UTC date from daysInMonth generation
                            const dateStr = formatDateForDisplay(day);
                            const availabilityData = dailyAvailability[dateStr]?.[accommodation.id];
                            const status = getDateStatus(day, accommodation.id);
                            return (
                              <td
                                key={day.toISOString()}
                                className={getCellStyle(status)}
                                onClick={() => handleDateClick(day, accommodation.id)}
                              >
                                {getCellContent(accommodation, day)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {showStatusModal && (
        <StatusModal
          onClose={() => {
            setShowStatusModal(false);
            setSelectedDates(null);
          }}
          onSave={async (status) => {
            if (!selectedDates) return;
            try {
              // Create a booking with the selected status
              // selectedDates.start and end are already in UTC
              const { error } = await supabase
                .from('bookings')
                .insert({
                  accommodation_id: selectedAccommodation,
                  check_in: selectedDates.start.toISOString(),
                  check_out: addDays(selectedDates.start, 1).toISOString(), // Default to 1 day booking
                  status: status,
                  total_price: 0, // This should be calculated based on your pricing logic
                  user_id: (await supabase.auth.getUser()).data.user?.id // Get current user's ID
                });

              if (error) throw error;
              await loadData();
              setShowStatusModal(false);
              setSelectedDates(null);
            } catch (err) {
              console.error('[InventoryCalendar] Error creating booking:', err);
              setError(err instanceof Error ? err.message : 'Failed to create booking');
            }
          }}
        />
      )}
    </AnimatePresence>
  );
}
