import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { X, ChevronLeft, ChevronRight, Users, Calendar, BedDouble } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateWeeks } from '../../utils/dates';
import { convertToUTC1 } from '../../utils/timezone';

interface Props {
  onClose: () => void;
}

interface AvailabilityData {
  accommodation_id: string;
  title: string;
  is_available: boolean;
  available_capacity: number | null;
  bookings: any[];
}

export function Weekly({ onClose }: Props) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [availabilityData, setAvailabilityData] = useState<AvailabilityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate weeks starting from Dec 16, 2024
  const weeks = generateWeeks(convertToUTC1(new Date('2024-12-16'), 0), 52);
  const currentWeek = weeks[currentWeekIndex];
  
  // For each week, we want to show Mon-Sun
  // The currentWeek date from generateWeeks is already the start of the week (Monday)
  const weekStart = currentWeek;
  const weekEnd = addDays(weekStart, 6); // Add 6 days to get to Sunday

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
      // Don't show loading state if we already have data
      if (availabilityData.length === 0) {
        setLoading(true);
      }
      setError(null);

      const { data, error: availabilityError } = await supabase
        .rpc('get_accommodation_availability_range', {
          start_date: weekStart.toISOString(),
          end_date: weekEnd.toISOString()
        });

      if (availabilityError) throw availabilityError;

      // Group by accommodation_id to get the latest status for each accommodation
      const groupedData = data.reduce((acc: { [key: string]: AvailabilityData }, curr: any) => {
        if (!acc[curr.accommodation_id]) {
          acc[curr.accommodation_id] = {
            accommodation_id: curr.accommodation_id,
            title: curr.title,
            is_available: curr.is_available,
            available_capacity: curr.available_capacity,
            bookings: curr.bookings || []
          };
        }
        return acc;
      }, {});

      setAvailabilityData(Object.values(groupedData));
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (data: AvailabilityData) => {
    if (!data.is_available) {
      return 'bg-black text-white border-stone-300';
    }
    return 'bg-emerald-500 text-white border-emerald-600';
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentWeekIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentWeekIndex === 0}
                  className="p-2 hover:bg-stone-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center">
                  <h2 className="text-xl font-display">
                    {format(weekStart, 'MMM d')} → {format(weekEnd, 'MMM d, yyyy')}
                  </h2>
                  <p className="text-sm text-stone-500">
                    Week {currentWeekIndex + 1} of {weeks.length}
                  </p>
                </div>

                <button
                  onClick={() => setCurrentWeekIndex(prev => Math.min(weeks.length - 1, prev + 1))}
                  disabled={currentWeekIndex === weeks.length - 1}
                  className="p-2 hover:bg-stone-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-black"></div>
                    <span>Fully Booked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Available</span>
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

            <div className="flex-1 overflow-auto p-4">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {loading && availabilityData.length === 0 ? (
                <div className="flex justify-center items-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <div className="grid gap-2">
                  {availabilityData.map((data) => (
                    <div
                      key={data.accommodation_id}
                      className={`p-4 rounded-lg border ${getStatusColor(data)} transition-colors`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-display mb-1">
                            {data.title}
                          </h3>
                          <div className="flex items-center gap-4 text-sm opacity-90">
                            <div className="flex items-center gap-1">
                              <BedDouble className="w-4 h-4" />
                              {data.is_available ? (
                                data.available_capacity === null ? (
                                  <span>Unlimited</span>
                                ) : (
                                  <span>{data.available_capacity} available</span>
                                )
                              ) : (
                                <span>Fully booked</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}</span>
                            </div>
                          </div>
                        </div>

                        {data.bookings && data.bookings.length > 0 && (
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span>{data.bookings.length} booking{data.bookings.length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}