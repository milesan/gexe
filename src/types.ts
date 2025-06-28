export type AccommodationType = 'room' | 'dorm' | 'cabin' | 'tent' | 'parking' | 'addon' | 'test';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Accommodation {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  base_price: number;
  type: string;
  inventory: number | null;
  capacity: number | null;
  has_wifi: boolean;
  has_electricity: boolean;
  is_unlimited: boolean;
  bed_size: string | null;
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
  // Price breakdown fields (added later, may be null for old bookings)
  accommodation_price?: number | null;
  food_contribution?: number | null;
  seasonal_adjustment?: number | null;
  seasonal_discount_percent?: number | null;
  duration_discount_percent?: number | null;
  discount_amount?: number | null;
  applied_discount_code?: string | null;
  discount_code_percent?: number | null;
  discount_code_applies_to?: string | null;
  credits_used?: number | null;
  accommodation_price_paid?: number | null;
  accommodation_price_after_seasonal_duration?: number | null;
  subtotal_after_discount_code?: number | null;
}

export interface AccommodationAvailability {
  accommodation_id: string;
  title: string;
  is_unlimited: boolean;
  check_in: string | null;
  check_out: string | null;
  availability_status: number | null;
}