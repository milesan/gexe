import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, startOfWeek } from 'date-fns';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateWeeks } from '../../utils/dates';
import { convertToUTC1 } from '../../utils/timezone';

interface Props {
  onClose: () => void;
}

interface BookingInfo {
  id: string;
  check_in: string;
  check_out: string;
  accommodation_title: string;
  user_email: string;
  user_name: string;
}

export function Housekeeping({ onClose }: Props) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [bookings, setBookings] = useState<BookingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate weeks starting from the current week
  const currentDate = new Date();
  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
  const weeks = generateWeeks(convertToUTC1(currentWeekStart, 0), 52);
  const currentWeek = weeks[currentWeekIndex];
  
  const weekStart = currentWeek;
  const weekEnd = addDays(weekStart, 6);

  const handlePrevWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
    }
  };

  const handleNextWeek = () => {
    if (currentWeekIndex < weeks.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
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
  }, [currentWeekIndex]);

  useEffect(() => {
    loadData();

    const subscription = supabase
      .channel('bookings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentWeekIndex]);

  async function loadData() {
    try {
      if (bookings.length === 0) {
        setLoading(true);
      }
      setError(null);

      const { data, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          user_id,
          accommodations (
            title
          )
        `)
        .gte('check_in', weekStart.toISOString())
        .lte('check_out', weekEnd.toISOString())
        .eq('status', 'confirmed');

      if (bookingsError) throw bookingsError;

      // Get user emails in a separate query
      const userIds = [...new Set(data.map(booking => booking.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of user IDs to emails
      const userEmailMap = profiles ? Object.fromEntries(
        profiles.map(profile => [profile.id, profile.email])
      ) : {};

      // Create a map of user IDs to names
      const userNameMap = profiles ? Object.fromEntries(
        profiles.map(profile => [
          profile.id, 
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
        ])
      ) : {};

      const formattedBookings = data.map(booking => ({
        id: booking.id,
        check_in: booking.check_in,
        check_out: booking.check_out,
        accommodation_title: booking.accommodations.title,
        user_email: userEmailMap[booking.user_id] || booking.user_id,
        user_name: userNameMap[booking.user_id] || 'Unknown'
      }));

      setBookings(formattedBookings);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const getBookingsForDate = (date: Date, type: 'check_in' | 'check_out') => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(booking => {
      const relevantDate = type === 'check_in' ? booking.check_in : booking.check_out;
      return relevantDate.startsWith(dateStr);
    });
  };

  const hasBookingsForWeek = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const checkIns = getBookingsForDate(date, 'check_in');
    const checkOuts = getBookingsForDate(date, 'check_out');
    return checkIns.length > 0 || checkOuts.length > 0;
  }).some(Boolean);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold">Housekeeping</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrevWeek}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={currentWeekIndex === 0}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </span>
                <button
                  onClick={handleNextWeek}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={currentWeekIndex === weeks.length - 1}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">{error}</div>
            ) : !hasBookingsForWeek ? (
              <div className="text-center py-8 text-gray-500">
                No check-ins or check-outs scheduled for this week
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map(date => {
                  const checkIns = getBookingsForDate(date, 'check_in');
                  const checkOuts = getBookingsForDate(date, 'check_out');
                  
                  if (checkIns.length === 0 && checkOuts.length === 0) {
                    return null;
                  }

                  return (
                    <div key={date.toISOString()} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-4">{format(date, 'EEEE, MMMM d')}</h3>
                      
                      {checkIns.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-green-600 font-medium mb-2">Check-ins:</h4>
                          <ul className="space-y-2">
                            {checkIns.map(booking => (
                              <li key={`in-${booking.id}`} className="flex items-center text-sm">
                                <span className="font-medium">{booking.accommodation_title}</span>
                                <span className="mx-2">-</span>
                                <span className="text-gray-600">{booking.user_name}</span>
                                <span className="mx-1 text-gray-400">·</span>
                                <span className="text-gray-500">{booking.user_email}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {checkOuts.length > 0 && (
                        <div>
                          <h4 className="text-red-600 font-medium mb-2">Check-outs:</h4>
                          <ul className="space-y-2">
                            {checkOuts.map(booking => (
                              <li key={`out-${booking.id}`} className="flex items-center text-sm">
                                <span className="font-medium">{booking.accommodation_title}</span>
                                <span className="mx-2">-</span>
                                <span className="text-gray-600">{booking.user_name}</span>
                                <span className="mx-1 text-gray-400">·</span>
                                <span className="text-gray-500">{booking.user_email}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
