import { useState, useEffect, useCallback } from 'react';
import { bookingService } from '../services/BookingService';
import type { Accommodation } from '../types';
import type { AvailabilityResult } from '../types/availability';

interface AvailabilityMapEntry {
  isAvailable: boolean;
  availableCapacity: number | null;
}

interface AccommodationWithAvailability extends Accommodation {
  availability?: AvailabilityMapEntry;
}

export function useAccommodations() {
  const [accommodations, setAccommodations] = useState<AccommodationWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, AvailabilityMapEntry>>({});

  const loadAccommodations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await bookingService.getAccommodations();
      
      // Only show root-level accommodations (those without parents)
      const rootAccommodations = data.filter(acc => !acc.parent_accommodation_id);
      
      // Add availability information if it exists
      const accommodationsWithAvailability = rootAccommodations.map(acc => ({
        ...acc,
        availability: availabilityMap[acc.id]
      }));
      
      setAccommodations(accommodationsWithAvailability);
    } catch (err) {
      console.error('Error loading accommodations:', err);
      setError(err instanceof Error ? err : new Error('Failed to load accommodations'));
    } finally {
      setLoading(false);
    }
  }, [availabilityMap]);

  const checkAvailability = useCallback(async (startDate: Date, endDate: Date) => {
    console.log('[useAccommodations] checkAvailability called with:', { startDate, endDate });
    try {
      const availability = await bookingService.getAvailability(startDate, endDate);
      console.log('[useAccommodations] Got availability from service:', availability);

      // Create availability map with capacity information
      const newAvailabilityMap = availability.reduce((acc, avail) => {
        acc[avail.accommodation_id] = {
          isAvailable: avail.is_available,
          availableCapacity: avail.available_capacity
        };
        return acc;
      }, {} as Record<string, AvailabilityMapEntry>);

      setAvailabilityMap(newAvailabilityMap);

      // Update accommodations with new availability information
      setAccommodations(prev => 
        prev.map(acc => ({
          ...acc,
          availability: newAvailabilityMap[acc.id]
        }))
      );
    } catch (err) {
      console.error('Error checking availability:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    loadAccommodations();
  }, [loadAccommodations]);

  console.log("useAccommodations", availabilityMap);

  return {
    accommodations,
    loading,
    error,
    availabilityMap,
    checkAvailability,
    refresh: loadAccommodations
  };
}