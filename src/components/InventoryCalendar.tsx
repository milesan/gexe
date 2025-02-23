import React, { useState, useEffect } from 'react';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StatusModal } from './StatusModal';
import type { AvailabilityStatus } from '../types/availability';
import { motion, AnimatePresence } from 'framer-motion';
import { ManualBookingModal } from './ManualBookingModal';

interface Props {
  onClose: () => void;
}

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
}

interface AvailabilityData {
  availability_date: string;
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
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyAvailability, setDailyAvailability] = useState<DailyAvailability>({});

  const daysInMonth = Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, 
    (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1));

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
      setAccommodations(accommodationsData);

      // Get availability data for the current month
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const { data: availabilityData, error: availabilityError } = await supabase
        .rpc('get_accommodation_availability_range', {
          start_date: startDate,
          end_date: endDate
        });

      if (availabilityError) throw availabilityError;

      // Transform availability data into a more usable format
      const availability: DailyAvailability = {};
      availabilityData.forEach((data: AvailabilityData) => {
        if (!availability[data.availability_date]) {
          availability[data.availability_date] = {};
        }
        availability[data.availability_date][data.accommodation_id] = data;
      });

      setDailyAvailability(availability);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const getDateStatus = (date: Date, accommodationId: string): AvailabilityStatus | number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const availabilityData = dailyAvailability[dateStr]?.[accommodationId];
    
    if (!availabilityData) return 'AVAILABLE';
    
    // If it's a dorm, return the available capacity
    const accommodation = accommodations.find(a => a.id === accommodationId);
    if (accommodation?.title.includes('Dorm')) {
      return availabilityData.available_capacity ?? accommodation.capacity ?? 0;
    }
    
    // For regular accommodations
    if (!availabilityData.is_available) return 'BOOKED';
    
    // Check for check-in/out dates
    const hasCheckIn = availabilityData.bookings?.some(b => format(new Date(b.check_in), 'yyyy-MM-dd') === dateStr);
    const hasCheckOut = availabilityData.bookings?.some(b => format(new Date(b.check_out), 'yyyy-MM-dd') === dateStr);
    
    if (hasCheckIn) return 'CHECK_IN';
    if (hasCheckOut) return 'CHECK_OUT';
    
    return availabilityData.is_available ? 'AVAILABLE' : 'BOOKED';
  };

  const handleDateClick = (date: Date, accommodationId: string) => {
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

  const getCellContent = (accommodation: any, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const availabilityData = dailyAvailability[dateStr]?.[accommodation.id];

    // Handle dorms
    if (accommodation.title.includes('Dorm') && availabilityData) {
      return availabilityData.available_capacity.toString();
    }

    // Regular accommodation handling
    const status = getDateStatus(date, accommodation.id);
    switch (status) {
      case 'CHECK_IN':
        return '→';
      case 'CHECK_OUT':
        return '←';
      case 'BOOKED':
        return '×';
      case 'PENDING':
        return '⌛';
      default:
        return '✓';
    }
  };

  const getCellStyle = (status: AvailabilityStatus | number) => {
    const baseStyle = 'h-8 px-2 text-center text-xs border-r cursor-pointer transition-colors';
    
    if (typeof status === 'number') {
      // For dorm occupancy numbers
      if (status === 0) {
        return `${baseStyle} bg-black text-white`; // Fully booked - black
      }
      // Get the accommodation to determine max capacity
      const dorm = accommodations.find(a => a.title.includes('Dorm'));
      const maxCapacity = dorm?.capacity || 8; // Default to 8 if not found
      const availablePercentage = Math.min((status / maxCapacity) * 100, 100);
      
      // Create a gradient from emerald (available) to black (booked)
      if (availablePercentage >= 75) {
        return `${baseStyle} bg-emerald-500 text-white`; // Mostly available - emerald
      } else if (availablePercentage >= 50) {
        return `${baseStyle} bg-emerald-900 text-white`; // Half available - dark emerald
      } else if (availablePercentage >= 25) {
        return `${baseStyle} bg-stone-800 text-white`; // Getting full - very dark gray
      } else {
        return `${baseStyle} bg-stone-950 text-white`; // Almost full - nearly black
      }
    }

    switch (status) {
      case 'CHECK_IN':
        return `${baseStyle} bg-gradient-to-r from-emerald-500 to-black text-white`;
      case 'CHECK_OUT':
        return `${baseStyle} bg-gradient-to-l from-emerald-500 to-black text-white`;
      case 'BOOKED':
        return `${baseStyle} bg-black text-white cursor-not-allowed`;
      case 'PENDING':
        return `${baseStyle} bg-yellow-400`;
      default:
        return `${baseStyle} bg-emerald-500 text-white`;
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
          className="absolute inset-0 bg-white"
        >
          <div className="h-screen flex flex-col">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-white">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold">
                  {format(currentDate, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowManualBooking(true)}
                  className="bg-emerald-900 text-white px-4 py-2 rounded-lg hover:bg-emerald-800"
                >
                  Add Manual Booking
                </button>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <span>Hold</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-black"></div>
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-black"></div>
                    <span>Check-in/out</span>
                  </div>
                  <div className="h-6 border-l border-stone-200 mx-2"></div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-3 h-3 bg-emerald-500"></div>
                      <div className="w-3 h-3 bg-emerald-900"></div>
                      <div className="w-3 h-3 bg-stone-800"></div>
                      <div className="w-3 h-3 bg-stone-950"></div>
                      <div className="w-3 h-3 bg-black"></div>
                    </div>
                    <span>Dorm Occupancy (Available → Full)</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-stone-100 rounded-full text-stone-600 hover:text-stone-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center items-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">
                          Accommodation
                        </th>
                        {daysInMonth.map(day => (
                          <th key={day.toISOString()} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div>{format(day, 'd')}</div>
                            <div>{format(day, 'EEE')}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {accommodations.map((accommodation) => (
                        <tr key={accommodation.id}>
                          <td className="sticky left-0 bg-white px-4 py-2 whitespace-nowrap border-r">
                            <div className="text-sm font-medium text-gray-900">
                              {accommodation.title} ({accommodation.inventory_count})
                            </div>
                          </td>
                          {daysInMonth.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
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

            <div className="p-4 border-t border-stone-200 text-sm text-stone-500 text-center">
              Note: All dates shown are accurate
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
              console.error('Error creating booking:', err);
              setError(err instanceof Error ? err.message : 'Failed to create booking');
            }
          }}
        />
      )}

      {showManualBooking && (
        <ManualBookingModal
          onClose={() => setShowManualBooking(false)}
          onSuccess={() => {
            setShowManualBooking(false);
            loadData();
          }}
          accommodations={accommodations}
        />
      )}
    </AnimatePresence>
  );
}