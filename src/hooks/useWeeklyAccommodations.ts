import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Accommodation } from '../types';

function getDatesInRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate < endDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

export function useWeeklyAccommodations() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, number>>({});
  const [lastCheckedDates, setLastCheckedDates] = useState<{start: Date | null, end: Date | null}>({
    start: null,
    end: null
  });

  const loadAccommodations = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('accommodations')
        .select(`
          *,
          parent:parent_accommodation_id (
            id,
            title,
            inventory_count,
            is_unlimited
          )
        `)
        .order('price', { ascending: true });

      if (queryError) throw queryError;
      setAccommodations(data || []);
    } catch (err) {
      console.error('Error loading accommodations:', err);
      setError(err instanceof Error ? err : new Error('Failed to load accommodations'));
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAvailability = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      // If we've already checked these dates, don't check again
      if (lastCheckedDates.start?.getTime() === startDate.getTime() && 
          lastCheckedDates.end?.getTime() === endDate.getTime()) {
        return;
      }

      // Get all bookings for the date range
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          accommodation_id,
          check_in,
          check_out,
          accommodations!inner (
            id,
            title,
            parent_accommodation_id,
            is_unlimited,
            parent:parent_accommodation_id (
              id,
              title,
              inventory_count,
              is_unlimited
            )
          )
        `)
        .eq('status', 'confirmed')
        .or(`check_in.lte.${endDate.toISOString()},check_out.gt.${startDate.toISOString()}`);

      if (error) throw error;

      const newAvailabilityMap: Record<string, number> = {};
      const dateRange = getDatesInRange(startDate, endDate);

      // Process each accommodation
      accommodations.forEach(acc => {
        if (acc.parent_accommodation_id) {
          // Skip individual units
          return;
        }

        // Handle unlimited accommodations
        if (acc.is_unlimited) {
          newAvailabilityMap[acc.id] = 999; // Always available
          return;
        }

        if (acc.title.includes('Dorm') || acc.is_fungible) {
          // For dorms and fungible accommodations, count available units per day
          const totalUnits = acc.inventory_count;
          const unitsPerDay = new Map<string, number>();
          
          // Initialize all dates with 0 bookings
          dateRange.forEach(date => unitsPerDay.set(date, 0));

          // Count bookings for each day
          bookings?.forEach(booking => {
            if (booking.accommodations?.parent?.id === acc.id) {
              const bookingStart = new Date(booking.check_in);
              const bookingEnd = new Date(booking.check_out);
              const bookingDates = getDatesInRange(
                bookingStart > startDate ? bookingStart : startDate,
                bookingEnd < endDate ? bookingEnd : endDate
              );

              bookingDates.forEach(date => {
                const currentCount = unitsPerDay.get(date) || 0;
                unitsPerDay.set(date, currentCount + 1);
              });
            }
          });

          // Find minimum available units across all days
          let minAvailableUnits = totalUnits;
          unitsPerDay.forEach(unitsUsed => {
            const availableUnitsForDay = totalUnits - unitsUsed;
            minAvailableUnits = Math.min(minAvailableUnits, availableUnitsForDay);
          });

          newAvailabilityMap[acc.id] = Math.max(0, minAvailableUnits);
        } else {
          // For regular accommodations
          const isBooked = bookings?.some(booking => 
            booking.accommodation_id === acc.id &&
            new Date(booking.check_in) < endDate &&
            new Date(booking.check_out) > startDate
          );

          newAvailabilityMap[acc.id] = isBooked ? -1 : 1;
        }
      });

      setAvailabilityMap(newAvailabilityMap);
      setLastCheckedDates({ start: startDate, end: endDate });
    } catch (err) {
      console.error('Error checking availability:', err);
      setError(err instanceof Error ? err : new Error('Failed to check availability'));
    }
  }, [accommodations, lastCheckedDates]);

  useEffect(() => {
    loadAccommodations();

    const subscription = supabase
      .channel('bookings_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings' 
        }, 
        () => {
          if (lastCheckedDates.start && lastCheckedDates.end) {
            checkAvailability(lastCheckedDates.start, lastCheckedDates.end);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadAccommodations, checkAvailability, lastCheckedDates]);

  return { 
    accommodations, 
    loading, 
    error,
    checkAvailability,
    availabilityMap
  };
}