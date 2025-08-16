import { Booking, AccommodationRow } from './types';
import { isSingleRoom, isUnlimitedAccommodation } from './helpers';

/**
 * Get bookings for a specific cell in the calendar
 * Simplified logic based on accommodation_id as source of truth
 */
export function getBookingsForCellSimplified(
  row: AccommodationRow,
  date: Date,
  bookings: Booking[]
): Booking[] {
  // Get all bookings active on this date (including checkout day)
  const activeBookings = bookings.filter(b => 
    date >= b.check_in && date <= b.check_out
  );
  
  if (activeBookings.length === 0) return [];
  
  // Case 1: Row has a specific item_id (tagged row)
  if (row.item_id) {
    return activeBookings.filter(b => b.accommodation_item_id === row.item_id);
  }
  
  // Case 2: Row is for unassigned bookings
  // Return unassigned bookings for this accommodation type
  return activeBookings.filter(b => 
    b.accommodation_id === row.accommodation_id && 
    !b.accommodation_item_id
  );
}

/**
 * Distribute unassigned bookings across multiple rows to prevent overlaps
 */
export function distributeBookingsAcrossRows(
  unassignedBookings: Booking[],
  rows: AccommodationRow[],
  currentRow: AccommodationRow
): Booking[] {
  if (unassignedBookings.length === 0 || rows.length <= 1) {
    return unassignedBookings;
  }
  
  // Sort bookings by check-in date for consistent distribution
  const sortedBookings = [...unassignedBookings].sort((a, b) => 
    a.check_in.getTime() - b.check_in.getTime()
  );
  
  // Create a map of booking to row index
  const bookingToRow = new Map<string, number>();
  const rowEndDates: (Date | null)[] = new Array(rows.length).fill(null);
  
  sortedBookings.forEach(booking => {
    // Find first available row
    const availableRowIndex = rowEndDates.findIndex(endDate => 
      !endDate || booking.check_in >= endDate
    );
    
    if (availableRowIndex !== -1) {
      bookingToRow.set(booking.id, availableRowIndex);
      rowEndDates[availableRowIndex] = booking.check_out;
    }
  });
  
  // Find current row index
  const currentRowIndex = rows.findIndex(r => r.id === currentRow.id);
  
  // Return bookings assigned to current row
  return unassignedBookings.filter(b => 
    bookingToRow.get(b.id) === currentRowIndex
  );
}

/**
 * Check if a booking should show its name on a given day
 */
export function shouldShowBookingName(
  booking: Booking,
  day: Date,
  daysInView: Date[]
): boolean {
  // Show name on the first visible day of the booking
  const firstVisibleDay = daysInView.find(d => 
    d >= booking.check_in && d < booking.check_out
  );
  
  return firstVisibleDay && 
    day.toISOString().split('T')[0] === firstVisibleDay.toISOString().split('T')[0];
}