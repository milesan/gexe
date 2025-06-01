export interface Accommodation {
  id: string;
  title: string;
  base_price: number;
  type: string;
  capacity: number;
  has_wifi: boolean;
  has_electricity: boolean;
  image_url: string | null;
  is_unlimited: boolean;
  is_fungible: boolean;
  parent_accommodation_id: string | null;
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
  created_at: string;
  updated_at: string;
  accommodation?: {
    title: string;
    type: string;
    image_url: string | null;
  };
}

export interface AvailabilityResult {
  accommodation_id: string;
  title: string;
  is_available: boolean;
  available_capacity: number | null;
}
