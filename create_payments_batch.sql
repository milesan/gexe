-- Payment 1: 5897056c-cd2d-45de-b138-09a8d63be250
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '5897056c-cd2d-45de-b138-09a8d63be250',
  null,
  '2025-05-06',
  '2025-06-02',
  1340.00,
  '{
    "accommodation": 456.00,
    "food_facilities": 884.00,
    "accommodation_original": 500.00,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1384.00,
    "total_after_discounts": 1340.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-04 03:53:52.998409+00',
  '2025-05-04 03:53:52.998409+00',
  'paid'
);

-- Payment 2: 9d1f8a6c-63dc-454f-8d2c-987234d7f020
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '9d1f8a6c-63dc-454f-8d2c-987234d7f020',
  null,
  '2025-05-06',
  '2025-05-12',
  600.00,
  '{
    "accommodation": 240.00,
    "food_facilities": 360.00,
    "accommodation_original": 400.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.40,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 760.00,
    "total_after_discounts": 600.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-04 03:49:31.752086+00',
  '2025-05-04 03:49:31.752086+00',
  'paid'
);

-- Payment 3: e6ea9587-b8b5-4df6-92b7-d7ef41263412
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'e6ea9587-b8b5-4df6-92b7-d7ef41263412',
  '220d561b-f548-4782-a428-e6e7ecdb3126',
  '2025-06-10',
  '2025-06-16',
  345.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 345.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 345.00,
    "total_after_discounts": 345.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-03 19:56:43.446+00',
  '2025-05-03 19:56:43.446+00',
  'paid'
);

-- Payment 4: c4b1550c-2bd7-45ca-bf40-8f911cf3b75e
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'c4b1550c-2bd7-45ca-bf40-8f911cf3b75e',
  '1ad78054-e71a-46f9-921d-8f8e33d66987',
  '2025-05-06',
  '2025-05-26',
  528.24,
  '{
    "accommodation": 297.00,
    "food_facilities": 648.00,
    "accommodation_original": 495.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.40,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.4228777,
    "discount_code_applies_to": "total",
    "discount_code_amount": 614.75,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1143.00,
    "total_after_discounts": 528.24
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-05-03 17:47:54.582+00',
  '2025-05-03 17:47:54.582+00',
  'paid'
);

-- Payment 5: 58834552-6ab7-4f53-abcf-d00678710abc
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '58834552-6ab7-4f53-abcf-d00678710abc',
  '4187d6fb-698c-43b9-b347-8d18dddf4ecc',
  '2025-05-13',
  '2025-05-26',
  950.00,
  '{
    "accommodation": 324.00,
    "food_facilities": 626.00,
    "accommodation_original": 540.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.40,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1166.00,
    "total_after_discounts": 950.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-02 04:50:46.061+00',
  '2025-05-02 04:50:46.061+00',
  'paid'
); 