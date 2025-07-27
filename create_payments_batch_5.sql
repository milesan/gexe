-- Payment 1: 544d6a8a-8c26-4c80-8770-2c3224401728 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '544d6a8a-8c26-4c80-8770-2c3224401728',
  '6b155315-f49f-4054-9a93-bd0ae44b495c',
  '2025-06-24',
  '2025-06-30',
  480.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 480.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 480.00,
    "total_after_discounts": 480.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-08 14:20:29.494+00',
  '2025-06-08 14:20:29.494+00',
  'paid'
);

-- Payment 2: 616df540-cb2e-40be-9ecd-c8cbcc4abf0b (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '616df540-cb2e-40be-9ecd-c8cbcc4abf0b',
  'de60d696-8ef8-445f-8817-b3127f323a4a',
  '2025-06-24',
  '2025-06-30',
  1202.00,
  '{
    "accommodation": 425.00,
    "food_facilities": 777.00,
    "accommodation_original": 500.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1277.00,
    "total_after_discounts": 1202.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-07 09:08:19.122+00',
  '2025-06-07 09:08:19.122+00',
  'paid'
);

-- Payment 3: 7dedd34e-aa23-44af-9bee-edceb8e5f67b (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '7dedd34e-aa23-44af-9bee-edceb8e5f67b',
  '892fbb14-8df8-4c05-892c-292dede01cd1',
  '2025-07-01',
  '2025-07-21',
  699.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 699.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 699.00,
    "total_after_discounts": 699.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-06 19:43:21.25+00',
  '2025-06-06 19:43:21.25+00',
  'paid'
);

-- Payment 4: 54fa7fa8-8006-4540-b006-f033769997d6 (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '54fa7fa8-8006-4540-b006-f033769997d6',
  '069713a9-86dd-455a-8e56-32717cbb4a70',
  '2025-06-24',
  '2025-06-30',
  785.00,
  '{
    "accommodation": 395.00,
    "food_facilities": 390.00,
    "accommodation_original": 465.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 854.75,
    "total_after_discounts": 785.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-04 21:20:15.077+00',
  '2025-06-04 21:20:15.077+00',
  'paid'
);

-- Payment 5: 18dee98e-43c7-48dd-8dd2-5616d98e95ba (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '18dee98e-43c7-48dd-8dd2-5616d98e95ba',
  '9f721638-68c4-4fa9-9536-7dbe9b53a548',
  '2025-06-27',
  '2025-06-30',
  309.00,
  '{
    "accommodation": 71.00,
    "food_facilities": 238.00,
    "accommodation_original": 71.43,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 309.00,
    "total_after_discounts": 309.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-03 13:42:59.686+00',
  '2025-06-03 13:42:59.686+00',
  'paid'
);

-- Payment 6: d950fd9b-b85a-4d83-ac3f-f29caeb86761 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'd950fd9b-b85a-4d83-ac3f-f29caeb86761',
  'bc1fd14f-c9d5-4d6c-89a6-6c5d696d2373',
  '2025-06-24',
  '2025-07-07',
  480.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 480.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 480.00,
    "total_after_discounts": 480.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-03 10:48:08.923+00',
  '2025-06-03 10:48:08.923+00',
  'paid'
);

-- Payment 7: c4675f71-ea65-45ff-9637-6c7d8d2238fc (duration + calculated discount code)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'c4675f71-ea65-45ff-9637-6c7d8d2238fc',
  '8eb092bb-46f0-4833-9c9d-d7cfc67a40a0',
  '2025-06-03',
  '2025-06-23',
  981.00,
  '{
    "accommodation": 446.00,
    "food_facilities": 535.00,
    "accommodation_original": 495.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.0445,
    "discount_code_applies_to": "total",
    "discount_code_amount": 162.01,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1143.00,
    "total_after_discounts": 981.00
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-06-02 16:25:42.139468+00',
  '2025-06-02 16:25:42.139468+00',
  'paid'
);

-- Payment 8: 28e311df-b6ef-451b-83a8-3af74d80e9ef (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '28e311df-b6ef-451b-83a8-3af74d80e9ef',
  '006eeb32-a29f-48d8-bccc-59ce64ec98e4',
  '2025-06-03',
  '2025-06-09',
  470.00,
  '{
    "accommodation": 125.00,
    "food_facilities": 345.00,
    "accommodation_original": 125.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 470.00,
    "total_after_discounts": 470.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-01 10:06:43.123+00',
  '2025-06-01 10:06:43.123+00',
  'paid'
);

-- Payment 9: 56f186b0-ad36-4d0c-b770-0bd0b1762971 (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '56f186b0-ad36-4d0c-b770-0bd0b1762971',
  '5ee1e2a4-7b63-4519-9b45-4444e69c097e',
  '2025-06-10',
  '2025-06-23',
  1480.00,
  '{
    "accommodation": 850.00,
    "food_facilities": 630.00,
    "accommodation_original": 1000.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1630.00,
    "total_after_discounts": 1480.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-01 00:59:33.739+00',
  '2025-06-01 00:59:33.739+00',
  'paid'
);

-- Payment 10: 91c11e60-25d4-4456-ba23-3b3e1b229779 (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '91c11e60-25d4-4456-ba23-3b3e1b229779',
  '053fb75a-a846-4a0b-8395-27e5b869040d',
  '2025-06-24',
  '2025-06-30',
  844.00,
  '{
    "accommodation": 454.00,
    "food_facilities": 390.00,
    "accommodation_original": 534.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 924.10,
    "total_after_discounts": 844.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-30 12:49:53.741+00',
  '2025-05-30 12:49:53.741+00',
  'paid'
); 