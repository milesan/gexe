import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, parseISO, addWeeks, subWeeks, startOfWeek, Day } from 'date-fns';
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CalendarService } from '../../services/CalendarService';
import { formatDateForDisplay, normalizeToUTCDate } from '../../utils/dates';

interface Props {
  onClose: () => void;
}

interface BookingWithUser {
  id: string;
  check_in: string;
  check_out: string;
  accommodation_title: string;
  user_email: string;
  user_name: string;
}

interface Week {
  start_date: string;
  end_date: string;
  id?: string;
  status?: string;
}

export function Housekeeping({ onClose }: Props) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [weekEnd, setWeekEnd] = useState<Date | null>(null);
  const [checkInDay, setCheckInDay] = useState<number>(1); // Default to Monday
  const [copiedId, setCopiedId] = useState<{id: string, type: 'in' | 'out'} | null>(null);

  useEffect(() => {
    async function fetchCalendarConfig() {
      try {
        console.log('[Housekeeping] Fetching calendar configuration');
        const config = await CalendarService.getConfig();
        
        if (config && config.checkInDay !== undefined) {
          const configCheckInDay = config.checkInDay;
          console.log(`[Housekeeping] Retrieved check-in day from config: ${configCheckInDay}`);
          setCheckInDay(configCheckInDay);
        } else {
          console.log('[Housekeeping] No check-in day found in config, using default (Monday)');
          setCheckInDay(1); // Default to Monday
        }
      } catch (err) {
        console.error('[Housekeeping] Error fetching calendar config:', err);
        setCheckInDay(1); // Default to Monday on error
      }
    }

    fetchCalendarConfig();
  }, []);

  useEffect(() => {
    async function generateWeeks() {
      try {
        if (checkInDay === undefined) {
          console.log('[Housekeeping] Check-in day not yet available, waiting...');
          return;
        }
        
        console.log(`[Housekeeping] Generating weeks with check-in day: ${checkInDay}`);
        
        // Normalize the current date to UTC midnight to prevent timezone issues
        const normalizedDate = normalizeToUTCDate(currentDate);
        
        // Adjust current date to start of week with the configured check-in day
        const adjustedDate = startOfWeek(normalizedDate, { weekStartsOn: checkInDay as Day });
        
        // Generate 52 weeks (1 year) of data - 26 weeks before and 26 weeks after
        const startDate = subWeeks(adjustedDate, 26);
        const endDate = addWeeks(adjustedDate, 26);
        
        console.log(`[Housekeeping] Date range: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
        
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
          console.log(`[Housekeeping] Generated ${generatedWeeks.length} weeks`);
          console.log(`[Housekeeping] First week: ${formatDateForDisplay(new Date(generatedWeeks[0].start_date))} - ${formatDateForDisplay(new Date(generatedWeeks[0].end_date))}`);
          console.log(`[Housekeeping] Last week: ${formatDateForDisplay(new Date(generatedWeeks[generatedWeeks.length - 1].start_date))} - ${formatDateForDisplay(new Date(generatedWeeks[generatedWeeks.length - 1].end_date))}`);
          
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
          console.error('[Housekeeping] No weeks generated');
          setError('Failed to generate weeks');
          setLoading(false);
        }
      } catch (err) {
        console.error('[Housekeeping] Error generating weeks:', err);
        setError('Failed to generate weeks');
        setLoading(false);
      }
    }

    generateWeeks();
  }, [checkInDay, currentDate]);

  useEffect(() => {
    if (weekStart && weekEnd) {
      console.log('[Housekeeping] Week dates updated:', {
        start: formatDateForDisplay(weekStart),
        end: formatDateForDisplay(weekEnd)
      });
      loadData();
    }

    const subscription = supabase
      .channel('bookings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
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

  async function loadData() {
    try {
      if (bookings.length === 0) {
        setLoading(true);
      }
      setError(null);

      if (!weekStart || !weekEnd) {
        console.error('[Housekeeping] Week dates not available');
        setError('Week dates not available');
        setLoading(false);
        return;
      }

      // Extend the date range to capture bookings that might span across multiple weeks
      const extendedStartDate = subWeeks(weekStart, 2);
      const extendedEndDate = addWeeks(weekEnd, 2);

      console.log(`[Housekeeping] Loading bookings for extended range: ${formatDateForDisplay(extendedStartDate)} - ${formatDateForDisplay(extendedEndDate)}`);

      const { data, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          user_id,
          accommodation_id
        `)
        .lte('check_in', extendedEndDate.toISOString())  // check-in is on or before extended week end
        .gte('check_out', extendedStartDate.toISOString()) // check-out is on or after extended week start
        .eq('status', 'confirmed');

      if (bookingsError) throw bookingsError;

      console.log(`[Housekeeping] Found ${data.length} bookings that overlap with extended date range`);
      
      // Get all accommodation IDs from the bookings
      const accommodationIds = [...new Set(data.map(booking => booking.accommodation_id))];
      
      // Fetch accommodation details
      const { data: accommodations, error: accommodationsError } = await supabase
        .from('accommodations')
        .select('id, title')
        .in('id', accommodationIds);
      
      if (accommodationsError) {
        console.error('[Housekeeping] Error fetching accommodations:', accommodationsError);
        throw accommodationsError;
      }
      
      // Create a map of accommodation IDs to titles
      const accommodationMap = Object.fromEntries(
        accommodations.map(acc => [acc.id, acc.title])
      );

      // Get all user IDs from the bookings
      const userIds = [...new Set(data.map(booking => booking.user_id))];
      
      // Fetch all user details using our enhanced function that includes both profiles and applications data
      console.log('[Housekeeping] Fetching user details for:', userIds);
      let allUserData = [];
      try {
        const { data: userData, error: userError } = await supabase
          .rpc('get_profiles_by_ids', { 
            user_ids: userIds 
          });

        if (userError) {
          console.error('[Housekeeping] Error fetching user data:', userError);
          // Create basic placeholders for missing user data
          allUserData = userIds.map(id => ({
            id,
            email: `${id.substring(0, 8)}@placeholder.com`,
            first_name: 'Guest',
            last_name: `#${id.substring(0, 6)}`
          }));
        } else {
          allUserData = userData || [];
          
          // Add placeholders for any missing users
          if (allUserData.length < userIds.length) {
            const foundIds = new Set(allUserData.map(user => user.id));
            const missingIds = userIds.filter(id => !foundIds.has(id));
            
            if (missingIds.length > 0) {
              console.log('[Housekeeping] Creating placeholders for missing users:', missingIds);
              
              missingIds.forEach(id => {
                allUserData.push({
                  id,
                  email: `${id.substring(0, 8)}@placeholder.com`,
                  first_name: 'Guest',
                  last_name: `#${id.substring(0, 6)}`
                });
              });
            }
          }
        }
      } catch (err) {
        console.error('[Housekeeping] Unexpected error fetching user data:', err);
        // Create basic placeholders for all users on error
        allUserData = userIds.map(id => ({
          id,
          email: `${id.substring(0, 8)}@placeholder.com`,
          first_name: 'Guest',
          last_name: `#${id.substring(0, 6)}`
        }));
      }

      console.log(`[Housekeeping] Retrieved data for ${allUserData.length} users`);

      // Create maps for user emails and names
      const userEmailMap = Object.fromEntries(
        allUserData.map(user => [user.id, user.email])
      );

      const userNameMap = Object.fromEntries(
        allUserData.map(user => [
          user.id, 
          `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown'
        ])
      );

      // Format bookings with all necessary information
      const formattedBookings = data.map(booking => ({
        id: booking.id,
        check_in: booking.check_in,
        check_out: booking.check_out,
        accommodation_title: accommodationMap[booking.accommodation_id] || 'Unknown Accommodation',
        user_email: userEmailMap[booking.user_id] || booking.user_id,
        user_name: userNameMap[booking.user_id] || 'Unknown'
      }));

      console.log(`[Housekeeping] Processed ${formattedBookings.length} bookings with user and accommodation info`);
      setBookings(formattedBookings);
    } catch (err) {
      console.error('[Housekeeping] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const getBookingsForDate = (date: Date, type: 'check_in' | 'check_out') => {
    if (!date) return [];
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      return bookings.filter(booking => {
        const relevantDate = type === 'check_in' ? booking.check_in : booking.check_out;
        return relevantDate && relevantDate.startsWith(dateStr);
      });
    } catch (err) {
      console.error(`[Housekeeping] Error filtering bookings for ${type}:`, err);
      return [];
    }
  };

  // Only calculate hasBookingsForWeek if weekStart is defined
  const hasBookingsForWeek = weekStart ? Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const checkIns = getBookingsForDate(day, 'check_in');
    const checkOuts = getBookingsForDate(day, 'check_out');
    return checkIns.length > 0 || checkOuts.length > 0;
  }).some(Boolean) : false;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Housekeeping</h2>
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
              <span className="text-sm font-mono w-[140px] text-center">
                {weekStart && weekEnd ? (
                  `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
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
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-6">
          {loading ? (
            <div className="text-center py-10">
              <p>Loading housekeeping data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              <p>{error}</p>
            </div>
          ) : !hasBookingsForWeek ? (
            <div className="text-center py-10 text-gray-500">
              <p>No check-ins or check-outs this week</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-4">
              {/* Days of the week */}
              {weekStart && Array.from({ length: 7 }).map((_, i) => {
                const day = addDays(weekStart, i);
                const checkIns = getBookingsForDate(day, 'check_in');
                const checkOuts = getBookingsForDate(day, 'check_out');
                
                return (
                  <div key={i} className="border rounded p-4">
                    <h3 className="font-medium text-center mb-2">
                      {format(day, 'EEE, MMM d')}
                    </h3>
                    
                    {/* Check-ins */}
                    {checkIns.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-green-600 mb-1">Check-ins</h4>
                        <ul className="space-y-2">
                          {checkIns.map(booking => (
                            <li key={`in-${booking.id}`} className="text-xs p-2 bg-green-50 border border-green-100 rounded relative">
                              <div className="font-semibold truncate">{booking.accommodation_title}</div>
                              <div className="break-words min-h-[1.25rem]">{booking.user_name}</div>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(booking.user_email);
                                  setCopiedId({ id: booking.id, type: 'in' });
                                  setTimeout(() => setCopiedId(null), 1000);
                                  console.log('[Housekeeping] Copied check-in email to clipboard:', booking.user_email);
                                }}
                                className="truncate block w-full text-left cursor-pointer text-gray-500 hover:text-blue-600"
                                title="Click to copy email address"
                              >
                                {copiedId?.id === booking.id && copiedId?.type === 'in' ? 'Copied!' : booking.user_email}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Check-outs */}
                    {checkOuts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-600 mb-1">Check-outs</h4>
                        <ul className="space-y-2">
                          {checkOuts.map(booking => (
                            <li key={`out-${booking.id}`} className="text-xs p-2 bg-red-50 border border-red-100 rounded relative">
                              <div className="font-semibold truncate">{booking.accommodation_title}</div>
                              <div className="break-words min-h-[1.25rem]">{booking.user_name}</div>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(booking.user_email);
                                  setCopiedId({ id: booking.id, type: 'out' });
                                  setTimeout(() => setCopiedId(null), 1000);
                                  console.log('[Housekeeping] Copied check-out email to clipboard:', booking.user_email);
                                }}
                                className="truncate block w-full text-left cursor-pointer text-gray-500 hover:text-blue-600"
                                title="Click to copy email address"
                              >
                                {copiedId?.id === booking.id && copiedId?.type === 'out' ? 'Copied!' : booking.user_email}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {checkIns.length === 0 && checkOuts.length === 0 && (
                      <div className="text-xs text-gray-500 text-center">
                        No activity
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
