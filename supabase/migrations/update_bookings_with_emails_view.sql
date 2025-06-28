-- Update bookings view to include user emails and all price breakdown fields
CREATE OR REPLACE VIEW bookings_with_emails AS
SELECT 
  b.*,
  b.accommodation_price_paid,
  b.food_contribution,
  b.seasonal_adjustment,
  b.seasonal_discount_percent,
  b.duration_discount_percent,
  b.discount_amount,
  b.credits_used,
  b.confirmation_email_sent,
  b.discount_code_percent,
  b.discount_code_applies_to,
  b.accommodation_price_after_seasonal_duration,
  b.subtotal_after_discount_code,
  u.email as user_email,
  b.guest_email
FROM
  bookings b
  LEFT JOIN auth.users u ON b.user_id = u.id; 