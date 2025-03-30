import React, { useEffect, useState, useCallback } from 'react';
import { format, addDays, addWeeks, subWeeks, startOfWeek, endOfWeek, isWithinInterval, parseISO, Day } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { CalendarService } from '../../services/CalendarService';
import { formatDateForDisplay } from '../../utils/dates';
import { bookingService } from '../../services/BookingService';
import { Booking } from '../../types';

interface Props {
  onClose: () => void;
}

interface Week {
  start_date: string;
  end_date: string;
  id?: string;
  status?: string;
}

// Define a type that matches the data structure returned by the Supabase query
// Note: supabase joins often return related tables as arrays, even if it's a one-to-one relationship
interface AccommodationInfo {
  title: string;
  type: string;
  image_url: string;
}

// Update BookingWithColor to match fetched data structure
interface FetchedBooking {
  id: string;
  accommodation_id: string;
  check_in: string;
  check_out: string;
  status: string;
  total_price: number;
  user_id: string;
  accommodations: AccommodationInfo | null; // Changed from AccommodationInfo[] | null
}

interface BookingWithColor extends FetchedBooking {
  color: string;
}

export function Weekly({ onClose }: Props) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [weekEnd, setWeekEnd] = useState<Date | null>(null);
  const [checkInDay, setCheckInDay] = useState<number>(1); // Default to Monday
  const [bookings, setBookings] = useState<BookingWithColor[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Color palette for bookings
  const colors = [
    'bg-blue-100 border-blue-300 text-blue-800',
    'bg-green-100 border-green-300 text-green-800',
    'bg-purple-100 border-purple-300 text-purple-800',
    'bg-yellow-100 border-yellow-300 text-yellow-800',
    'bg-pink-100 border-pink-300 text-pink-800',
    'bg-indigo-100 border-indigo-300 text-indigo-800',
    'bg-red-100 border-red-300 text-red-800',
    'bg-teal-100 border-teal-300 text-teal-800'
  ];

  const fetchCalendarConfig = useCallback(async () => {
    try {
      console.log('[Weekly] Fetching calendar configuration');
      const config = await CalendarService.getConfig();
      
      if (config && config.checkInDay !== undefined) {
        const configCheckInDay = config.checkInDay;
        console.log(`[Weekly] Retrieved check-in day from config: ${configCheckInDay}`);
        setCheckInDay(configCheckInDay);
      } else {
        console.log('[Weekly] No check-in day found in config, using default (Monday)');
        setCheckInDay(1); // Default to Monday
      }
    } catch (err) {
      console.error('[Weekly] Error fetching calendar config:', err);
      setCheckInDay(1); // Default to Monday on error
    }
  }, []);

  useEffect(() => {
    fetchCalendarConfig();
  }, [fetchCalendarConfig]);

  // Generate weeks based on the current date
  useEffect(() => {
    async function generateWeeks() {
      try {
        if (checkInDay === undefined) {
          console.log('[Weekly] Check-in day not yet available, waiting...');
          return;
        }
        
        console.log(`[Weekly] Generating weeks with check-in day: ${checkInDay}`);
        
        // Adjust current date to start of week with the configured check-in day
        const adjustedDate = startOfWeek(currentDate, { weekStartsOn: checkInDay as Day });
        
        // Generate 52 weeks (1 year) of data - 26 weeks before and 26 weeks after
        const startDate = subWeeks(adjustedDate, 26);
        const endDate = addWeeks(adjustedDate, 26);
        
        console.log(`[Weekly] Date range: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
        
        // Get week customizations in this range
        const customizations = await CalendarService.getCustomizations(startDate, endDate);
        
        // Map of dates to customizations
        const customizationMap = new Map();
        customizations.forEach(customization => {
          const key = customization.startDate.toISOString().split('T')[0];
          customizationMap.set(key, customization);
        });
        
        // Generate all weeks in the range
        const generatedWeeks: Week[] = [];
        let currentWeekStart = new Date(startDate);
        
        while (currentWeekStart <= endDate) {
          const weekEnd = addDays(currentWeekStart, 6);
          const weekStartStr = currentWeekStart.toISOString().split('T')[0];
          
          // Check if we have a customization for this week
          const customization = customizationMap.get(weekStartStr);
          
          if (customization) {
            // Use the customization data
            generatedWeeks.push({
              id: customization.id,
              start_date: customization.startDate.toISOString(),
              end_date: customization.endDate.toISOString(),
              status: customization.status
            });
          } else {
            // Create a default week
            generatedWeeks.push({
              start_date: currentWeekStart.toISOString(),
              end_date: weekEnd.toISOString(),
              status: 'visible'
            });
          }
          
          // Move to next week
          currentWeekStart = addDays(currentWeekStart, 7);
        }
        
        if (generatedWeeks.length > 0) {
          console.log(`[Weekly] Generated ${generatedWeeks.length} weeks`);
          console.log(`[Weekly] First week: ${formatDateForDisplay(new Date(generatedWeeks[0].start_date))} - ${formatDateForDisplay(new Date(generatedWeeks[0].end_date))}`);
          console.log(`[Weekly] Last week: ${formatDateForDisplay(new Date(generatedWeeks[generatedWeeks.length - 1].start_date))} - ${formatDateForDisplay(new Date(generatedWeeks[generatedWeeks.length - 1].end_date))}`);
          
          setWeeks(generatedWeeks);
          
          // Find the week that contains the current date
          const currentWeek = generatedWeeks.find(week => {
            const weekStartDate = new Date(week.start_date);
            const weekEndDate = new Date(week.end_date);
            return currentDate >= weekStartDate && currentDate <= weekEndDate;
          });
          
          if (currentWeek) {
            setWeekStart(new Date(currentWeek.start_date));
            setWeekEnd(new Date(currentWeek.end_date));
          } else if (generatedWeeks.length > 0) {
            // Default to the middle week if current date not found
            const middleIndex = Math.floor(generatedWeeks.length / 2);
            setWeekStart(new Date(generatedWeeks[middleIndex].start_date));
            setWeekEnd(new Date(generatedWeeks[middleIndex].end_date));
          }
          
          setLoading(false);
        } else {
          console.error('[Weekly] No weeks generated');
          setError('Failed to generate weeks');
          setLoading(false);
        }
      } catch (err) {
        console.error('[Weekly] Error generating weeks:', err);
        setError('Failed to generate weeks');
        setLoading(false);
      }
    }

    generateWeeks();
  }, [checkInDay, currentDate]);

  // Fetch bookings when week changes
  useEffect(() => {
    async function fetchBookings() {
      if (!weekStart || !weekEnd) return;
      
      try {
        setLoadingBookings(true);
        console.log(`[Weekly] Fetching bookings for week: ${formatDateForDisplay(weekStart)} - ${formatDateForDisplay(weekEnd)}`);
        
        // Extend the date range to include bookings that overlap with our week
        const extendedStart = subWeeks(weekStart, 2);
        const extendedEnd = addWeeks(weekEnd, 2);
        
        // Fetch bookings with accommodation titles directly from the database
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            accommodation_id,
            check_in,
            check_out,
            status,
            total_price,
            user_id,
            accommodations (
              title,
              type,
              image_url
            )
          `)
          .lte('check_in', extendedEnd.toISOString())
          .gte('check_out', extendedStart.toISOString())
          .returns<FetchedBooking[]>();
        
        if (error) {
          throw error;
        }
        
        if (!data) {
          console.warn('[Weekly] No booking data returned from Supabase');
          setBookings([]);
          setLoadingBookings(false);
          return;
        }
        
        console.log(`[Weekly] Found ${data.length} bookings`);
        
        // Assign colors to bookings for visual distinction
        const coloredBookings: BookingWithColor[] = data.map((booking, index) => ({
          ...booking,
          color: colors[index % colors.length]
        }));
        
        setBookings(coloredBookings);
        setLoadingBookings(false);
      } catch (err) {
        console.error('[Weekly] Error fetching bookings:', err);
        setLoadingBookings(false);
      }
    }
    
    fetchBookings();
  }, [weekStart, weekEnd]);

  const handlePrevWeek = () => {
    if (weekStart) {
      const newWeekStart = subWeeks(weekStart, 1);
      setCurrentDate(newWeekStart);
    }
  };

  const handleNextWeek = () => {
    if (weekStart) {
      const newWeekStart = addWeeks(weekStart, 1);
      setCurrentDate(newWeekStart);
    }
  };

  const handleJumpBackward = () => {
    if (weekStart) {
      const newWeekStart = subWeeks(weekStart, 4);
      setCurrentDate(newWeekStart);
    }
  };

  const handleJumpForward = () => {
    if (weekStart) {
      const newWeekStart = addWeeks(weekStart, 4);
      setCurrentDate(newWeekStart);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevWeek();
      } else if (e.key === 'ArrowRight') {
        handleNextWeek();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [weekStart]);

  // Get bookings for a specific day and sort them
  const getBookingsForDay = (day: Date) => {
    const dayBookings = bookings.filter(booking => {
      const checkIn = parseISO(booking.check_in);
      const checkOut = parseISO(booking.check_out);
      
      // A booking should be displayed on a day if:
      // 1. The check-in date is exactly on this day, OR
      // 2. The check-out date is exactly on this day, OR
      // 3. The day is between check-in and check-out (for multi-day bookings)
      
      // Format dates to compare just the date part (ignoring time)
      const dayStr = format(day, 'yyyy-MM-dd');
      const checkInStr = format(checkIn, 'yyyy-MM-dd');
      const checkOutStr = format(checkOut, 'yyyy-MM-dd');
      
      // Check if the day is the check-in day
      if (dayStr === checkInStr) {
        return true;
      }
      
      // Check if the day is the check-out day
      if (dayStr === checkOutStr) {
        return true;
      }
      
      // Check if the day is between check-in and check-out
      return day > checkIn && day < checkOut;
    });

    // Sort the bookings for the day by accommodation title
    dayBookings.sort((a, b) => {
      const titleA = a.accommodations?.title || '';
      const titleB = b.accommodations?.title || '';
      return titleA.localeCompare(titleB);
    });

    return dayBookings;
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Weekly View</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleJumpBackward}
                className="p-1 hover:bg-gray-100 rounded"
                title="Jump back 4 weeks"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handlePrevWeek}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm w-40 text-center">
                {weekStart && weekEnd ? (
                  `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
                ) : (
                  'Loading...'
                )}
              </span>
              <button
                onClick={handleNextWeek}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleJumpForward}
                className="p-1 hover:bg-gray-100 rounded"
                title="Jump forward 4 weeks"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Add the Calendar Config Button here */}
          <div className="flex items-center space-x-3">

            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="py-6">
          {loading ? (
            <div className="text-center py-10">
              <p>Loading weekly view...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              <p>{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-4">
              {/* Days of the week */}
              {weekStart && Array.from({ length: 7 }).map((_, i) => {
                const day = addDays(weekStart, i);
                const dayBookings = getBookingsForDay(day);
                
                return (
                  <div key={i} className="border rounded p-4 min-h-[200px]">
                    <h3 className="font-medium text-center mb-2">
                      {format(day, 'EEE, MMM d')}
                    </h3>
                    
                    {loadingBookings ? (
                      <div className="text-sm text-gray-500 text-center">
                        Loading bookings...
                      </div>
                    ) : dayBookings.length > 0 ? (
                      <div className="space-y-2">
                        {dayBookings.map((booking) => {
                          return (
                            <div 
                              key={booking.id} 
                              className={`text-xs p-2 rounded border ${booking.color} overflow-hidden`}
                              title={`${booking.accommodations?.title || 'Accommodation'} (${format(parseISO(booking.check_in), 'MMM d')} - ${format(parseISO(booking.check_out), 'MMM d')})`}
                            >
                              <div className="font-semibold truncate">
                                {booking.accommodations?.title || 'Unknown Room'}
                              </div>
                              <div className="truncate">
                                {format(parseISO(booking.check_in), 'MMM d')} - {format(parseISO(booking.check_out), 'MMM d')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 text-center">
                        No bookings
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}