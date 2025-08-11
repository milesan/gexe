import { formatDateForDisplay } from '../../utils/dates';
import { Booking, AccommodationRow } from './types';

export const SINGLE_ROOMS = [
  'Microcabin Left', 'Microcabin Middle', 'Microcabin Right',
  'The Hearth', 'The Yurt', 'Valleyview Room', 'Writer\'s Room'
];

export const AUTO_ASSIGN_TYPES = ['Van Parking', 'Your Own Tent', 'Staying with somebody'];

export const BOOKING_COLORS = [
  'bg-blue-500/70',
  'bg-green-500/70',
  'bg-yellow-500/70',
  'bg-purple-500/70',
  'bg-pink-500/70',
  'bg-indigo-500/70',
  'bg-red-500/70',
  'bg-orange-500/70',
  'bg-teal-500/70',
  'bg-cyan-500/70',
  'bg-emerald-500/70',
  'bg-violet-500/70',
];

export function getBookingColor(booking: Booking): string {
  const name = booking.guest_name || booking.guest_email || 'Unknown';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BOOKING_COLORS[Math.abs(hash) % BOOKING_COLORS.length];
}

// Create a stable mapping of bookings to row indices based on check-in date
function createBookingRowMap(
  bookings: Booking[],
  accommodationRows: AccommodationRow[],
  accommodationType: string
): Map<string, number> {
  const bookingRowMap = new Map<string, number>();
  
  // Get all rows for this accommodation type
  const typeRows = accommodationRows.filter(r => 
    r.accommodation_title === accommodationType
  );
  
  // Sort bookings by check-in date
  const sortedBookings = bookings
    .filter(b => b.accommodation_title === accommodationType && !b.accommodation_item_id)
    .sort((a, b) => a.check_in.getTime() - b.check_in.getTime());
  
  // For each booking, find an available row based on bookings active at its check-in time
  sortedBookings.forEach(booking => {
    // Find which rows are occupied at this booking's check-in date
    const occupiedRows = new Set<number>();
    
    // Check all previously assigned bookings
    bookingRowMap.forEach((rowIndex, bookingId) => {
      const otherBooking = bookings.find(b => b.id === bookingId);
      if (otherBooking && 
          booking.check_in >= otherBooking.check_in && 
          booking.check_in < otherBooking.check_out) {
        occupiedRows.add(rowIndex);
      }
    });
    
    // Find the first available row
    let assignedRow = -1;
    for (let i = 0; i < typeRows.length; i++) {
      if (!occupiedRows.has(i)) {
        assignedRow = i;
        break;
      }
    }
    
    // If we found an available row, assign it
    if (assignedRow !== -1) {
      bookingRowMap.set(booking.id, assignedRow);
    }
  });
  
  return bookingRowMap;
}

export function getBookingsForCell(
  row: AccommodationRow,
  date: Date,
  bookings: Booking[],
  accommodationRows: AccommodationRow[],
  bookingRowMaps?: Map<string, Map<string, number>>
): Booking[] {
  const dateStr = formatDateForDisplay(date);
  
  // For dorm beds, we need special handling
  if (row.is_bed) {
    // Get all bookings for this dorm on this date
    const dormBookings = bookings.filter(b => 
      b.accommodation_id === row.accommodation_id &&
      date >= b.check_in && date < b.check_out
    );
    
    // Return the nth booking for the nth bed
    const bedBooking = dormBookings[row.bed_number! - 1];
    return bedBooking ? [bedBooking] : [];
  }
  
  // For accommodations with items (Bell Tents, Tipis, etc.)
  // Get all bookings for this specific item
  if (row.item_id) {
    const itemBookings = bookings.filter(b => 
      b.accommodation_item_id === row.item_id &&
      date >= b.check_in && date < b.check_out
    );
    
    // Debug logging for cells with multiple bookings
    if (itemBookings.length > 2 && row.accommodation_title?.includes('Bell Tent')) {
      console.log('Bell Tent with 3+ bookings:', {
        row_label: row.label,
        row_item_id: row.item_id,
        date: date.toISOString(),
        bookings_found: itemBookings.length,
        bookings: itemBookings.map(b => ({
          id: b.id,
          name: b.first_name || b.guest_name || b.guest_email,
          accommodation_item_id: b.accommodation_item_id,
          accommodation_title: b.accommodation_title
        }))
      });
    }
    
    if (itemBookings.length > 0) return itemBookings;
    
    // If no assigned booking for this item, check for unassigned bookings
    // For Bell Tents, Tipis, Van Parking, and Your Own Tent which support reassignment
    if (row.accommodation_title?.includes('Bell Tent') || 
        row.accommodation_title?.includes('Tipi') ||
        row.accommodation_title === 'Van Parking' ||
        row.accommodation_title === 'Your Own Tent') {
      // Use pre-calculated booking row map or create one
      const bookingRowMap = bookingRowMaps?.get(row.accommodation_title) || 
                           createBookingRowMap(bookings, accommodationRows, row.accommodation_title);
      
      // Find unassigned rows for this accommodation type
      const unassignedRows = accommodationRows.filter(r => 
        r.accommodation_title === row.accommodation_title && 
        r.is_assigned === false
      );
      
      // Find the index of this row among unassigned rows
      const unassignedRowIndex = unassignedRows.indexOf(row);
      
      // Find bookings mapped to this row index
      const bookingForThisRow = bookings.find(b => {
        const mappedRow = bookingRowMap.get(b.id);
        return b.accommodation_title === row.accommodation_title &&
               !b.accommodation_item_id &&
               date >= b.check_in && 
               date < b.check_out &&
               mappedRow === unassignedRowIndex;
      });
      
      return bookingForThisRow ? [bookingForThisRow] : [];
    }
    
    return [];
  }
  
  // For single rooms (already assigned or single accommodations)
  if (SINGLE_ROOMS.includes(row.accommodation_title)) {
    const roomBooking = bookings.find(b => 
      b.accommodation_id === row.accommodation_id &&
      date >= b.check_in && date < b.check_out
    );
    return roomBooking ? [roomBooking] : [];
  }
  
  // For all other accommodations with multiple slots (Van Parking, Your Own Tent, etc.)
  // Use stable row mapping
  const accommodationTypeRows = accommodationRows.filter(r => 
    r.accommodation_title === row.accommodation_title
  );
  
  if (accommodationTypeRows.length > 1) {
    // Use pre-calculated booking row map or create one
    const bookingRowMap = bookingRowMaps?.get(row.accommodation_title) || 
                         createBookingRowMap(bookings, accommodationRows, row.accommodation_title);
    
    // Find which "slot" this row is
    const rowIndex = accommodationTypeRows.indexOf(row);
    
    // Find if any booking is assigned to this slot on this date
    const bookingForThisSlot = bookings.find(b => {
      const mappedRow = bookingRowMap.get(b.id);
      return b.accommodation_title === row.accommodation_title &&
             date >= b.check_in && 
             date < b.check_out &&
             mappedRow === rowIndex;
    });
    
    return bookingForThisSlot ? [bookingForThisSlot] : [];
  }
  
  // Fallback for single accommodations without items
  const fallbackBooking = bookings.find(b => 
    b.accommodation_id === row.accommodation_id &&
    !b.accommodation_item_id &&
    date >= b.check_in && date < b.check_out
  );
  return fallbackBooking ? [fallbackBooking] : [];
}

export function shouldShowName(
  booking: Booking, 
  day: Date, 
  isFirstDay: boolean, 
  viewMode: 'week' | 'month',
  daysInView: Date[]
): boolean {
  if (viewMode === 'month') {
    // In month view, show name on the first visible day of the booking
    const firstVisibleDay = daysInView.find(d => 
      d >= booking.check_in && d < booking.check_out
    );
    return firstVisibleDay && formatDateForDisplay(firstVisibleDay) === formatDateForDisplay(day);
  } else {
    // In week view, show name in the middle of the visible portion
    const visibleBookingDays = daysInView.filter(d => 
      d >= booking.check_in && d < booking.check_out
    );
    if (visibleBookingDays.length === 0) return false;
    
    const middleIndex = Math.floor(visibleBookingDays.length / 2);
    const middleDay = visibleBookingDays[middleIndex];
    return formatDateForDisplay(middleDay) === formatDateForDisplay(day);
  }
}