import { formatDateForDisplay } from '../../utils/dates';
import { Booking, AccommodationRow } from './types';

export const SINGLE_ROOMS = [
  'Microcabin Left', 'Microcabin Middle', 'Microcabin Right',
  'The Hearth', 'The Yurt', 'Valleyview Room', 'Writer\'s Room'
];

export const AUTO_ASSIGN_TYPES = ['Van Parking', 'Your Own Tent', 'Staying with somebody'];

// Color families for different accommodation types
export const ACCOMMODATION_COLOR_FAMILIES: Record<string, string[]> = {
  // Bell Tents - Greens
  'bell_tent': [
    'bg-green-400/70',
    'bg-green-500/70', 
    'bg-green-600/70',
    'bg-emerald-400/70',
    'bg-emerald-500/70',
    'bg-emerald-600/70',
    'bg-teal-500/70',
    'bg-teal-600/70',
  ],
  // Tipis - Blues
  'tipi': [
    'bg-blue-400/70',
    'bg-blue-500/70',
    'bg-blue-600/70',
    'bg-sky-400/70',
    'bg-sky-500/70',
    'bg-sky-600/70',
    'bg-cyan-500/70',
    'bg-cyan-600/70',
  ],
  // Single Rooms - Purples
  'single_room': [
    'bg-purple-400/70',
    'bg-purple-500/70',
    'bg-purple-600/70',
    'bg-violet-400/70',
    'bg-violet-500/70',
    'bg-violet-600/70',
    'bg-indigo-500/70',
    'bg-indigo-600/70',
  ],
  // Dorms - Oranges
  'dorm': [
    'bg-orange-400/70',
    'bg-orange-500/70',
    'bg-orange-600/70',
    'bg-amber-400/70',
    'bg-amber-500/70',
    'bg-amber-600/70',
    'bg-yellow-500/70',
    'bg-yellow-600/70',
  ],
  // Van Parking - Reds/Pinks
  'van_parking': [
    'bg-red-400/70',
    'bg-red-500/70',
    'bg-red-600/70',
    'bg-rose-400/70',
    'bg-rose-500/70',
    'bg-rose-600/70',
    'bg-pink-500/70',
    'bg-pink-600/70',
  ],
  // Your Own Tent - Browns/Grays
  'tent': [
    'bg-stone-400/70',
    'bg-stone-500/70',
    'bg-stone-600/70',
    'bg-zinc-400/70',
    'bg-zinc-500/70',
    'bg-zinc-600/70',
    'bg-gray-500/70',
    'bg-gray-600/70',
  ],
  // Staying with somebody - Light blues
  'staying': [
    'bg-slate-400/70',
    'bg-slate-500/70',
    'bg-slate-600/70',
    'bg-gray-400/70',
    'bg-gray-500/70',
    'bg-neutral-400/70',
    'bg-neutral-500/70',
    'bg-neutral-600/70',
  ],
  // Default/Other
  'default': [
    'bg-blue-500/70',
    'bg-green-500/70',
    'bg-yellow-500/70',
    'bg-purple-500/70',
    'bg-pink-500/70',
    'bg-indigo-500/70',
    'bg-red-500/70',
    'bg-orange-500/70',
  ]
};

function getAccommodationColorFamily(accommodationTitle: string): string[] {
  if (!accommodationTitle) return ACCOMMODATION_COLOR_FAMILIES.default;
  
  const titleLower = accommodationTitle.toLowerCase();
  
  if (titleLower.includes('bell tent')) return ACCOMMODATION_COLOR_FAMILIES.bell_tent;
  if (titleLower.includes('tipi')) return ACCOMMODATION_COLOR_FAMILIES.tipi;
  if (SINGLE_ROOMS.some(room => room.toLowerCase() === titleLower)) return ACCOMMODATION_COLOR_FAMILIES.single_room;
  if (titleLower.includes('dorm')) return ACCOMMODATION_COLOR_FAMILIES.dorm;
  if (titleLower.includes('van parking')) return ACCOMMODATION_COLOR_FAMILIES.van_parking;
  if (titleLower.includes('your own tent')) return ACCOMMODATION_COLOR_FAMILIES.tent;
  if (titleLower.includes('staying with somebody')) return ACCOMMODATION_COLOR_FAMILIES.staying;
  
  return ACCOMMODATION_COLOR_FAMILIES.default;
}

export function getBookingColor(booking: Booking): string {
  // Get the color family based on accommodation type
  const colorFamily = getAccommodationColorFamily(booking.accommodation_title || '');
  
  // Use guest name/email to pick a consistent shade within the family
  const name = booking.guest_name || booking.guest_email || 'Unknown';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colorFamily[Math.abs(hash) % colorFamily.length];
}

// Create a stable mapping of bookings to row indices based on check-in date
function createBookingRowMap(
  bookings: Booking[],
  accommodationRows: AccommodationRow[],
  accommodationId: string
): Map<string, number> {
  const bookingRowMap = new Map<string, number>();
  
  // Get all unassigned rows for this accommodation
  const unassignedRows = accommodationRows.filter(r => 
    r.accommodation_id === accommodationId && !r.item_id
  );
  
  // Sort unassigned bookings by check-in date
  const sortedBookings = bookings
    .filter(b => !b.accommodation_item_id)
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
    for (let i = 0; i < unassignedRows.length; i++) {
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
  // SIMPLIFIED LOGIC: Use accommodation_id and accommodation_item_id only
  
  // Step 1: Get all bookings active on this date
  const activeBookings = bookings.filter(b => 
    date >= b.check_in && date < b.check_out
  );
  
  // Step 2: Handle special case - dorm beds
  if (row.is_bed) {
    const dormBookings = activeBookings.filter(b => 
      b.accommodation_id === row.accommodation_id
    );
    const bedBooking = dormBookings[row.bed_number! - 1];
    return bedBooking ? [bedBooking] : [];
  }
  
  // Step 3: If this row has an item_id, it's a tagged row
  // Show ONLY bookings assigned to this specific tag
  if (row.item_id) {
    return activeBookings.filter(b => 
      b.accommodation_item_id === row.item_id
    );
  }
  
  // Step 4: For rows without item_id (single rooms or dynamic unassigned rows)
  // Single rooms: show any booking for this accommodation
  if (SINGLE_ROOMS.includes(row.accommodation_title)) {
    return activeBookings.filter(b => 
      b.accommodation_id === row.accommodation_id
    );
  }
  
  // Step 5: Dynamic/unassigned rows - show unassigned bookings for this accommodation
  // Get unassigned bookings for this accommodation
  const unassignedBookings = activeBookings.filter(b => 
    b.accommodation_id === row.accommodation_id &&
    !b.accommodation_item_id
  );
  
  // If multiple unassigned rows, distribute bookings among them
  if (unassignedBookings.length > 0 && bookingRowMaps) {
    const typeRows = accommodationRows.filter(r => 
      r.accommodation_id === row.accommodation_id &&
      !r.item_id
    );
    
    if (typeRows.length > 1) {
      const bookingRowMap = bookingRowMaps.get(row.accommodation_id) || 
                           createBookingRowMap(unassignedBookings, accommodationRows, row.accommodation_id);
      const rowIndex = typeRows.indexOf(row);
      
      return unassignedBookings.filter(b => {
        const mappedRow = bookingRowMap.get(b.id);
        return mappedRow === rowIndex;
      });
    }
  }
  
  return unassignedBookings;
}

export function shouldShowName(
  booking: Booking, 
  day: Date, 
  isFirstDay: boolean, 
  viewMode: 'week' | 'month',
  daysInView: Date[]
): boolean {
  // Always show name on the first visible day of the booking (leftmost)
  const firstVisibleDay = daysInView.find(d => 
    d >= booking.check_in && d < booking.check_out
  );
  return firstVisibleDay && formatDateForDisplay(firstVisibleDay) === formatDateForDisplay(day);
}