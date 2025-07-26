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
      setAvailabilityMap(prev => {
        const existingData = prev[accommodation.id];
        
        console.log('[useWeeklyAccommodations] 🔄 setAvailabilityMap called for unlimited accommodation:', {
          accommodationId: accommodation.id,
          existingData,
          needsUpdate: !existingData || 
            existingData.isAvailable !== true ||
            existingData.availableCapacity !== null
        });
        
        // Only update if data actually changed
        if (!existingData || 
            existingData.isAvailable !== true ||
            existingData.availableCapacity !== null) {
          console.log('[useWeeklyAccommodations] 🔄 UPDATING availability map for unlimited accommodation');
          return {
            ...prev,
            [accommodation.id]: {
              isAvailable: true,
              availableCapacity: null
            }
          };
        }
        
        console.log('[useWeeklyAccommodations] ✅ No changes needed for unlimited accommodation, returning existing reference');
        // No changes needed, return existing reference
        return prev;
      });
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
        // Check if we actually need to update the availability map
        let hasChanges = false;
        const updated = { ...prev };
        
        console.log('[useWeeklyAccommodations] 🔄 Processing availability map updates:', {
          previousMapKeys: Object.keys(prev),
          newResultsCount: Object.keys(newAvailabilityMap).length
        });
        
        // Only update properties that have actually changed
        Object.entries(newAvailabilityMap).forEach(([accommodationId, newData]) => {
          const existingData = prev[accommodationId];
          
          console.log('[useWeeklyAccommodations] 🔍 Checking accommodation:', {
            accommodationId,
            existingData,
            newData,
            needsUpdate: !existingData || 
              existingData.isAvailable !== newData.isAvailable ||
              existingData.availableCapacity !== newData.availableCapacity
          });
          
          // Check if data actually changed
          if (!existingData || 
              existingData.isAvailable !== newData.isAvailable ||
              existingData.availableCapacity !== newData.availableCapacity) {
            console.log('[useWeeklyAccommodations] 🔄 UPDATING data for accommodation:', accommodationId);
            updated[accommodationId] = newData;
            hasChanges = true;
          } else {
            console.log('[useWeeklyAccommodations] ✅ No changes for accommodation:', accommodationId);
          }
        });
        
        // Only return new object if there were actual changes
        if (hasChanges) {
          console.log('[useWeeklyAccommodations] 🔄 RETURNING UPDATED availability map with changes:', updated);
          return updated;
        } else {
          console.log('[useWeeklyAccommodations] ✅ NO CHANGES detected, keeping existing availability map reference');
          return prev; // Return existing reference to prevent unnecessary re-renders
        }
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
      
      const rootAccommodations = data.filter(acc => !(acc as any).parent_accommodation_id);
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