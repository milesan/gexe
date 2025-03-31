import { useState, useCallback, useEffect } from 'react';
import { bookingService } from '../services/BookingService';
import type { Accommodation, AccommodationType } from '../types';
import type { AvailabilityResult } from '../types/availability';
import { addDays } from 'date-fns';

interface WeeklyAvailabilityMap {
  [accommodationId: string]: {
    isAvailable: boolean;
    availableCapacity: number | null;
  };
}

export function useWeeklyAccommodations() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<WeeklyAvailabilityMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const checkWeekAvailability = useCallback(async (
    accommodation: Accommodation,
    checkInDate: Date | null | undefined,
    checkOutDate: Date | null | undefined
  ): Promise<boolean> => {
    console.log('[useWeeklyAccommodations] Checking availability for:', {
      accommodationId: accommodation.id,
      accommodationTitle: accommodation.title,
      checkInDate: checkInDate instanceof Date ? checkInDate.toISOString() : checkInDate,
      checkOutDate: checkOutDate instanceof Date ? checkOutDate.toISOString() : checkOutDate,
      isUnlimited: accommodation.is_unlimited
    });

    if (accommodation.is_unlimited) {
      console.log('[useWeeklyAccommodations] Accommodation is unlimited, returning true');
      setAvailabilityMap(prev => ({
        ...prev,
        [accommodation.id]: {
          isAvailable: true,
          availableCapacity: null
        }
      }));
      return true;
    }
    
    if (!checkInDate || !checkOutDate) {
      console.log('[useWeeklyAccommodations] No valid date range selected, returning true');
      return true;
    }
    
    try {
      const startDate = checkInDate;
      const endDate = checkOutDate;
      
      console.log('[useWeeklyAccommodations] Fetching availability:', {
        startDate: startDate instanceof Date ? startDate.toISOString() : 'Invalid start date',
        endDate: endDate instanceof Date ? endDate.toISOString() : 'Invalid end date'
      });
      
      const availability = await bookingService.getAvailability(startDate, endDate);
      console.log('[useWeeklyAccommodations] Received availability:', availability);
      
      const newAvailabilityMap: WeeklyAvailabilityMap = {};
      availability.forEach(result => {
        newAvailabilityMap[result.accommodation_id] = {
          isAvailable: result.is_available,
          availableCapacity: result.available_capacity
        };
        console.log(`[useWeeklyAccommodations] Setting availability for ${result.accommodation_id}:`, {
          isAvailable: result.is_available,
          availableCapacity: result.available_capacity
        });
      });
      
      setAvailabilityMap(prev => {
        const updated = { ...prev, ...newAvailabilityMap };
        console.log('[useWeeklyAccommodations] Updated availability map:', updated);
        return updated;
      });
      
      const result = availability.find(a => a.accommodation_id === accommodation.id);
      console.log('[useWeeklyAccommodations] Availability result for accommodation:', {
        accommodationId: accommodation.id,
        result
      });
      
      return result?.is_available ?? false;
    } catch (err) {
      console.error('[useWeeklyAccommodations] Error checking weekly availability:', err);
      return false;
    }
  }, []);

  const fetchAccommodations = useCallback(async () => {
    console.log('[useWeeklyAccommodations] Fetching accommodations');
    try {
      setLoading(true);
      const data = await bookingService.getAccommodations();
      console.log('[useWeeklyAccommodations] Received accommodations:', data);
      
      const rootAccommodations = data.filter(acc => !acc.parent_accommodation_id);
      console.log('[useWeeklyAccommodations] Filtered root accommodations:', rootAccommodations);
      
      setAccommodations(rootAccommodations as Accommodation[]);
    } catch (err) {
      console.error('[useWeeklyAccommodations] Error fetching accommodations:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch accommodations'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[useWeeklyAccommodations] Initial mount, fetching accommodations');
    fetchAccommodations();
  }, [fetchAccommodations]);

  return {
    accommodations,
    availabilityMap,
    loading,
    error,
    checkWeekAvailability,
    refresh: fetchAccommodations
  };
}