INSERT INTO public.payments (
  id,
  booking_id,
  user_id,
  start_date,
  end_date,
  amount_paid,
  breakdown_json,
  discount_code,
  payment_type,
  stripe_payment_id,
  created_at,
  updated_at,
  status
) VALUES (
  gen_random_uuid(),
  'f6a510bf-caf6-4a94-b91b-e4baa6391451',
  '43bd303c-f57a-4be8-a202-3f21268a907f',
  '2025-05-06',
  '2025-05-26',
  648.00,
  '{
    "accommodation": 648.00,
    "food_facilities": 0.00,
    "accommodation_original": 720.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 720.00,
    "total_after_discounts": 648.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-04-25 14:19:02.862+00',
  '2025-04-25 14:19:02.862+00',
  'paid'
); 