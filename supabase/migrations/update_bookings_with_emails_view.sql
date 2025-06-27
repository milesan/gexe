-- Drop the existing view and recreate it with the new column
DROP VIEW IF EXISTS public.bookings_with_emails;

CREATE VIEW public.bookings_with_emails AS
SELECT
  b.id,
  b.user_id,
  b.accommodation_id,
  b.check_in,
  b.check_out,
  b.total_price,
  b.status,
  b.payment_intent_id,
  b.created_at,
  b.updated_at,
  b.applied_discount_code,
  b.accommodation_price,
  b.accommodation_price_paid,
  b.food_contribution,
  b.seasonal_adjustment,
  b.duration_discount_percent,
  b.discount_amount,
  b.credits_used,
  b.confirmation_email_sent,
  b.discount_code_percent,
  u.email as user_email,
  b.guest_email
FROM
  bookings b
  LEFT JOIN auth.users u ON b.user_id = u.id; 