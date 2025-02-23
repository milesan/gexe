import { useState, useCallback } from 'react';
import { bookingService } from '../services/BookingService';
import type { AvailabilityResult } from '../types/availability';

export interface AvailabilityMap {
  [accommodationId: string]: {
    isAvailable: boolean;
    availableCapacity: number | null;
  };
}

export function useAvailability() {
  const [availabilityMap, setAvailabilityMap] = useState<AvailabilityMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkAvailability = useCallback(async (startDate: Date, endDate: Date) => {
    console.log('[useAvailability] checkAvailability called with:', { startDate, endDate });
    if (!startDate || !endDate) return;
    if (endDate <= startDate) {
      setError(new Error('Check-out date must be after check-in date'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[useAvailability] Calling bookingService.getAvailability');
      const availability = await bookingService.getAvailability(startDate, endDate);
      console.log('[useAvailability] Got availability result:', availability);
      const newAvailabilityMap: AvailabilityMap = {};

      availability.forEach(result => {
        newAvailabilityMap[result.accommodation_id] = {
          isAvailable: result.is_available,
          availableCapacity: result.available_capacity
        };
      });

      setAvailabilityMap(newAvailabilityMap);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check availability'));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    availabilityMap,
    loading,
    error,
    checkAvailability
  };
}