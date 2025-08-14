import React from 'react';
import { Booking, AccommodationRow } from './types';
import { SINGLE_ROOMS } from './utils';

interface Props {
  bookings: Booking[];
  accommodationRows: AccommodationRow[];
  daysToShow: Date[];
  viewMode: 'week' | 'month';
}

interface OccupancyData {
  type: string;
  occupied: number;
  total: number;
}

export function OccupancySummary({ bookings, accommodationRows, daysToShow, viewMode }: Props) {
  // Calculate occupancy for each accommodation type
  const occupancyData = React.useMemo(() => {
    const data = new Map<string, OccupancyData>();
    
    // Group accommodation rows by type (excluding single rooms)
    const accommodationGroups = new Map<string, AccommodationRow[]>();
    
    accommodationRows.forEach(row => {
      // Skip single rooms
      if (SINGLE_ROOMS.includes(row.accommodation_title)) return;
      
      const type = row.accommodation_title;
      if (!accommodationGroups.has(type)) {
        accommodationGroups.set(type, []);
      }
      accommodationGroups.get(type)!.push(row);
    });
    
    // Calculate occupancy for each type
    accommodationGroups.forEach((rows, type) => {
      // For dorms, count beds
      if (type.includes('Dorm')) {
        const totalBeds = rows.length; // Each row represents a bed
        
        // Count occupied beds for the current period
        const occupiedBeds = new Set<string>();
        
        bookings.forEach(booking => {
          if (booking.accommodation_title === type) {
            // Check if booking overlaps with current view
            const bookingStart = booking.check_in;
            const bookingEnd = booking.check_out;
            const viewStart = daysToShow[0];
            const viewEnd = new Date(daysToShow[daysToShow.length - 1]);
            viewEnd.setDate(viewEnd.getDate() + 1); // Include the last day
            
            if (bookingStart < viewEnd && bookingEnd > viewStart) {
              // This booking is active in the current view
              // For simplicity, count it as one occupied bed
              occupiedBeds.add(booking.id);
            }
          }
        });
        
        data.set(type, {
          type,
          occupied: Math.min(occupiedBeds.size, totalBeds),
          total: totalBeds
        });
      } 
      // For Bell Tents, Tipis, etc. - count units
      else if (type.includes('Bell Tent') || type.includes('Tipi')) {
        const totalUnits = rows.filter(r => r.item_id || r.is_assigned === false).length;
        
        // Count occupied units
        const occupiedUnits = new Set<string>();
        
        bookings.forEach(booking => {
          if (booking.accommodation_title === type) {
            // Check if booking overlaps with current view
            const bookingStart = booking.check_in;
            const bookingEnd = booking.check_out;
            const viewStart = daysToShow[0];
            const viewEnd = new Date(daysToShow[daysToShow.length - 1]);
            viewEnd.setDate(viewEnd.getDate() + 1);
            
            if (bookingStart < viewEnd && bookingEnd > viewStart) {
              // Count unique accommodation items or unassigned bookings
              if (booking.accommodation_item_id) {
                occupiedUnits.add(booking.accommodation_item_id);
              } else {
                // Unassigned booking
                occupiedUnits.add(`unassigned-${booking.id}`);
              }
            }
          }
        });
        
        data.set(type, {
          type,
          occupied: Math.min(occupiedUnits.size, totalUnits),
          total: totalUnits
        });
      }
      // For Van Parking, Your Own Tent - count by bookings
      else if (type === 'Van Parking' || type === 'Your Own Tent') {
        // These are unlimited, so just count active bookings
        const activeBookings = bookings.filter(booking => {
          if (booking.accommodation_title !== type) return false;
          
          const bookingStart = booking.check_in;
          const bookingEnd = booking.check_out;
          const viewStart = daysToShow[0];
          const viewEnd = new Date(daysToShow[daysToShow.length - 1]);
          viewEnd.setDate(viewEnd.getDate() + 1);
          
          return bookingStart < viewEnd && bookingEnd > viewStart;
        });
        
        if (activeBookings.length > 0) {
          data.set(type, {
            type,
            occupied: activeBookings.length,
            total: activeBookings.length // For unlimited, show as n/n
          });
        }
      }
    });
    
    return Array.from(data.values()).filter(d => d.total > 0);
  }, [bookings, accommodationRows, daysToShow]);
  
  if (occupancyData.length === 0) return null;
  
  return (
    <div className="px-6 py-2 bg-[var(--color-bg-surface-hover)] border-b border-[var(--color-border)] flex items-center gap-4 text-sm">
      <span className="text-[var(--color-text-secondary)] font-medium">Occupancy:</span>
      {occupancyData.map((data, index) => (
        <React.Fragment key={data.type}>
          {index > 0 && <span className="text-[var(--color-text-tertiary)]">|</span>}
          <span className={`${data.occupied === data.total ? 'text-orange-500' : 'text-[var(--color-text-primary)]'}`}>
            {data.type}: {data.occupied}/{data.total}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}