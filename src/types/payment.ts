/**
 * Payment breakdown JSON format - Single Source of Truth
 * 
 * This type defines the exact structure for the breakdown_json field in the payments table.
 * All payment creation and display logic should use this format.
 */
export interface PaymentBreakdown {
  // Base costs (before any discounts)
  accommodation: number;           // Accommodation cost for this payment period
  food_facilities: number;         // Food & facilities cost for this payment period
  
  // Original accommodation price (before all discounts)
  accommodation_original: number;  // Original accommodation price before seasonal/duration discounts
  
  // Discount percentages
  duration_discount_percent: number;    // Duration discount % (applies to both accommodation and food)
  seasonal_discount_percent: number;    // Seasonal discount % (applies to accommodation only)
  
  // Discount code details
  discount_code: string | null;         // The discount code applied (if any)
  discount_code_percent: number | null; // Discount code percentage
  discount_code_applies_to: 'accommodation' | 'food_facilities' | 'total' | null; // What the code applies to
  discount_code_amount: number;         // Exact discount code amount to avoid rounding issues
  
  // Credits (for credits-only or partial credits bookings)
  credits_used: number;                 // Credits applied to this payment (0 if no credits)
  
  // Totals
  subtotal_before_discounts: number;    // accommodation + food_facilities
  total_after_discounts: number;        // Final amount after all discounts but before credits
}

/**
 * Payment type enum - matches the database enum
 */
export type PaymentType = 'initial' | 'extension' | 'refund';

/**
 * Payment status enum - matches the database enum
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * Payment record from the database
 */
export interface Payment {
  id: string;
  booking_id: string | null;  // null for pending payments
  user_id: string;
  start_date: string;         // ISO date string
  end_date: string;           // ISO date string
  amount_paid: number;        // Can be negative for refunds
  breakdown_json: PaymentBreakdown | null;
  discount_code: string | null;
  payment_type: PaymentType;
  stripe_payment_id: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a pending payment
 */
export interface CreatePendingPaymentInput {
  bookingId: string | null;  // null for initial bookings, real ID for extensions
  userId: string;
  startDate: Date | string;
  endDate: Date | string;
  amountPaid: number;
  breakdownJson?: PaymentBreakdown;
  discountCode?: string;
  paymentType: PaymentType;
}

/**
 * Input for updating a payment after booking creation
 */
export interface UpdatePaymentAfterBookingInput {
  paymentRowId: string;
  bookingId: string;
  stripePaymentId: string;
} 