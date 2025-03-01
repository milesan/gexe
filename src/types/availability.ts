export type AvailabilityStatus = 'AVAILABLE' | 'BOOKED' | 'HOLD' | 'CHECK_IN' | 'CHECK_OUT' | 'PENDING';

export interface AvailabilityResult {
  accommodation_id: string;
  title: string;
  is_available: boolean;
  available_capacity: number | null;
}

export interface Event {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  classNames: string[];
  extendedProps: {
    type: 'availability';
    status: AvailabilityStatus;
    accommodationId: string;
  };
}