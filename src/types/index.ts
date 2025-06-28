export interface AccommodationImage {
  id: string;
  accommodation_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface Accommodation {
  id: string;
  title: string;
  description: string | null;
  location: string;
  base_price: number;
  type: string;
  inventory: number;
  capacity: number | null;
  bathrooms: number;
  has_wifi: boolean;
  has_electricity: boolean;
  bed_size: string | null;
  image_url: string | null;
  is_fungible: boolean;
  is_unlimited: boolean;
  parent_accommodation_id: string | null;
  inventory_count: number;
  created_at: string;
  updated_at: string;
  images?: AccommodationImage[];
}

export interface Booking {
  id: string;
  accommodation_id: string;
  user_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  payment_intent_id: string | null;
  applied_discount_code: string | null;
  credits_used?: number;
  created_at: string;
  updated_at: string;
  accommodation?: {
    title: string;
    type: string;
    image_url: string | null;
  };
  // Price breakdown fields (added later, may be null for old bookings)
  accommodation_price?: number | null;
  food_contribution?: number | null;
  seasonal_adjustment?: number | null;
  seasonal_discount_percent?: number | null; // NEW: Seasonal discount as percentage
  duration_discount_percent?: number | null;
  discount_amount?: number | null;
  discount_code_percent?: number | null;
  discount_code_applies_to?: string | null;
  accommodation_price_paid?: number | null; // NEW: Actual accommodation amount paid after discounts
  accommodation_price_after_seasonal_duration?: number | null; // NEW: After seasonal/duration but before codes
  subtotal_after_discount_code?: number | null; // NEW: After discount code but before credits
}

export interface AvailabilityResult {
  accommodation_id: string;
  title: string;
  is_available: boolean;
  available_capacity: number | null;
}
