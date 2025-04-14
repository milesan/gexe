export type AccommodationType = 'room' | 'dorm' | 'cabin' | 'tent' | 'parking' | 'addon' | 'test';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Accommodation {
  id: string;
  title: string;
  base_price: number;
  type: AccommodationType;
  capacity: number | null;
  has_wifi: boolean;
  has_electricity: boolean;
  image_url: string | null;
  is_unlimited: boolean;
}

export interface Booking {
  id: string;
  user_id: string;
  accommodation_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: BookingStatus;
  payment_intent_id?: string;
  created_at: string;
  updated_at: string;
  accommodation?: Accommodation;
}

export interface AccommodationAvailability {
  accommodation_id: string;
  title: string;
  is_unlimited: boolean;
  check_in: string | null;
  check_out: string | null;
  availability_status: number | null;
}