import { Booking, AccommodationRow } from './types';
import { ACCOMMODATION_IDS, SINGLE_ROOMS, UNLIMITED_ACCOMMODATION_TYPES, REASSIGNABLE_ACCOMMODATION_TYPES } from './constants';

// Check if accommodation is a dorm
export const isDormAccommodation = (accommodationId: string): boolean => {
  return accommodationId === ACCOMMODATION_IDS.DORM_3_BED || 
         accommodationId === ACCOMMODATION_IDS.DORM_6_BED;
};

// Check if accommodation is unlimited capacity
export const isUnlimitedAccommodation = (title: string): boolean => {
  return UNLIMITED_ACCOMMODATION_TYPES.includes(title as any);
};

// Check if accommodation is a single room
export const isSingleRoom = (title: string): boolean => {
  return SINGLE_ROOMS.includes(title as any);
};

// Check if booking can be reassigned
export const isReassignableBooking = (booking: Booking): boolean => {
  // Check by ID for dorms
  if (isDormAccommodation(booking.accommodation_id)) return true;
  
  // Check by title for other types
  const title = booking.accommodation_title || '';
  return REASSIGNABLE_ACCOMMODATION_TYPES.some(type => title.includes(type));
};

// Check if booking is in date range
export const isBookingInRange = (booking: Booking, startDate: Date, endDate: Date): boolean => {
  return booking.check_in < endDate && booking.check_out > startDate;
};

// Get unassigned bookings for an accommodation
export const getUnassignedBookings = (
  bookings: Booking[], 
  accommodationId: string,
  startDate?: Date,
  endDate?: Date
): Booking[] => {
  return bookings.filter(b => {
    const matchesAccommodation = b.accommodation_id === accommodationId;
    const isUnassigned = !b.accommodation_item_id;
    const inRange = startDate && endDate ? isBookingInRange(b, startDate, endDate) : true;
    return matchesAccommodation && isUnassigned && inRange;
  });
};

// Calculate overlapping bookings to determine needed rows
export const calculateNeededRows = (bookings: Booking[]): number => {
  if (bookings.length === 0) return 0;
  
  const sortedBookings = [...bookings].sort((a, b) => 
    a.check_in.getTime() - b.check_in.getTime()
  );
  
  const rowEndDates: Date[] = [];
  
  for (const booking of sortedBookings) {
    // Find first available row
    let assignedRow = rowEndDates.findIndex(endDate => booking.check_in >= endDate);
    
    if (assignedRow === -1) {
      // Need a new row
      rowEndDates.push(booking.check_out);
    } else {
      // Update existing row
      rowEndDates[assignedRow] = booking.check_out;
    }
  }
  
  return rowEndDates.length;
};

// Get view period bounds
export const getViewBounds = (
  viewMode: 'week' | 'month',
  currentWeekStart: Date,
  currentMonth: Date
): { start: Date; end: Date } => {
  if (viewMode === 'week') {
    const start = currentWeekStart;
    const end = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  } else {
    const start = currentMonth;
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return { start, end };
  }
};

// Group rows by accommodation type
export const groupRowsByType = (rows: AccommodationRow[]): {
  singleRooms: AccommodationRow[];
  dorms: AccommodationRow[];
  vanParking: AccommodationRow[];
  stayingWith: AccommodationRow[];
  others: AccommodationRow[];
} => {
  const singleRooms: AccommodationRow[] = [];
  const dorms: AccommodationRow[] = [];
  const vanParking: AccommodationRow[] = [];
  const stayingWith: AccommodationRow[] = [];
  const others: AccommodationRow[] = [];
  
  rows.forEach(row => {
    if (isSingleRoom(row.accommodation_title)) {
      singleRooms.push(row);
    } else if (row.accommodation_title.includes('Dorm')) {
      dorms.push(row);
    } else if (row.accommodation_title === 'Van Parking') {
      vanParking.push(row);
    } else if (row.accommodation_title === 'Staying with somebody') {
      stayingWith.push(row);
    } else {
      others.push(row);
    }
  });
  
  return { singleRooms, dorms, vanParking, stayingWith, others };
};

// Create dynamic row for unassigned bookings
export const createUnassignedRow = (
  accommodationId: string,
  accommodationTitle: string,
  index: number
): AccommodationRow => ({
  id: `${accommodationId}-unassigned-${index}`,
  label: `${accommodationTitle} (Unassigned ${index + 1})`,
  accommodation_title: accommodationTitle,
  accommodation_id: accommodationId,
  is_assigned: false
});