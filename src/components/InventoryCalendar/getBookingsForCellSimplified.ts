import { Booking, AccommodationRow } from './types';

export function getBookingsForCellSimplified(
  row: AccommodationRow,
  date: Date,
  bookings: Booking[]
): Booking[] {
  // Simple logic based on accommodation_id and accommodation_item_id
  
  // Filter bookings that are active on this date
  const activeBookings = bookings.filter(b => 
    date >= b.check_in && date < b.check_out
  );
  
  if (row.is_bed) {
    // Special case: Dorm beds
    // Get all bookings for this dorm accommodation
    const dormBookings = activeBookings.filter(b => 
      b.accommodation_id === row.accommodation_id
    );
    // Return the nth booking for the nth bed
    const bedBooking = dormBookings[row.bed_number! - 1];
    return bedBooking ? [bedBooking] : [];
  }
  
  if (row.item_id) {
    // This row represents a specific tag/item
    // Show bookings assigned to this specific tag
    return activeBookings.filter(b => 
      b.accommodation_item_id === row.item_id
    );
  }
  
  // This is either:
  // 1. A single room (no item_id needed)
  // 2. A dynamic/unassigned row
  
  // For single rooms, show any booking for this accommodation
  // For dynamic rows, show unassigned bookings for this accommodation
  return activeBookings.filter(b => 
    b.accommodation_id === row.accommodation_id &&
    !b.accommodation_item_id // Only unassigned bookings
  );
}

export function getBookingDisplayInfo(booking: Booking, hasTag: boolean) {
  return {
    name: booking.first_name || booking.guest_name || booking.guest_email || 'Guest',
    color: hasTag ? getBookingColor(booking) : getBookingColor(booking) + ' opacity-60',
    isAssigned: !!booking.accommodation_item_id
  };
}

function getBookingColor(booking: Booking): string {
  // Use a consistent color based on guest name
  const name = booking.guest_name || booking.guest_email || 'Unknown';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'bg-blue-500/70',
    'bg-green-500/70',
    'bg-yellow-500/70',
    'bg-purple-500/70',
    'bg-pink-500/70',
    'bg-indigo-500/70',
    'bg-red-500/70',
    'bg-orange-500/70',
  ];
  
  return colors[Math.abs(hash) % colors.length];
}