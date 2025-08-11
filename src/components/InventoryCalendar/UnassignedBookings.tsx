import React from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Booking } from './types';

interface Props {
  bookings: Booking[];
  onBookingClick: (booking: Booking, event: React.MouseEvent) => void;
}

export function UnassignedBookings({ bookings, onBookingClick }: Props) {
  // Show unassigned bell tent and tipi bookings
  const unassignedBookings = bookings.filter(b => 
    !b.accommodation_item_id && 
    (b.accommodation_title?.includes('Bell Tent') || b.accommodation_title?.includes('Tipi'))
  );

  if (unassignedBookings.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-yellow-500 mb-2">⚠️ Unassigned Bookings</h3>
      <div className="space-y-2">
        {unassignedBookings.map(booking => (
          <div 
            key={booking.id} 
            className="p-2 bg-yellow-900/20 border border-yellow-500/50 rounded cursor-pointer hover:bg-yellow-900/30"
            onClick={(e) => onBookingClick(booking, e)}
          >
            <span className="text-sm text-yellow-400">
              {booking.guest_name || booking.guest_email} - {booking.accommodation_title} - 
              {formatInTimeZone(booking.check_in, 'UTC', 'MMM d')} to {formatInTimeZone(booking.check_out, 'UTC', 'MMM d')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}