-- Payment 1: efa02ff1-90a7-412e-8e0c-c8ea1ff80e00 (free accommodation, just food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'efa02ff1-90a7-412e-8e0c-c8ea1ff80e00',
  'ddfabff3-1545-4f25-bc38-475ffe6ec84b',
  '2025-06-10',
  '2025-06-23',
  580.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 580.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 580.00,
    "total_after_discounts": 580.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-12 07:25:38.664+00',
  '2025-05-12 07:25:38.664+00',
  'paid'
);

-- Payment 2: c3580c60-6475-46db-91e6-d7fa214d0cc2 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'c3580c60-6475-46db-91e6-d7fa214d0cc2',
  '2b5f6dd3-491c-4c8b-964d-5a382e9b3193',
  '2025-09-02',
  '2025-09-15',
  770.00,
  '{
    "accommodation": 250.00,
    "food_facilities": 520.00,
    "accommodation_original": 250.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 770.00,
    "total_after_discounts": 770.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-09 19:55:45.755+00',
  '2025-05-09 19:55:45.755+00',
  'paid'
);

-- Payment 3: d5959229-0a6f-42ea-9b71-d8bb0170c1a6 (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'd5959229-0a6f-42ea-9b71-d8bb0170c1a6',
  'df526356-484d-4173-ac66-805250fcfa89',
  '2025-06-10',
  '2025-06-30',
  1041.00,
  '{
    "accommodation": 337.50,
    "food_facilities": 703.50,
    "accommodation_original": 375.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1078.50,
    "total_after_discounts": 1041.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-09 09:52:40.57+00',
  '2025-05-09 09:52:40.57+00',
  'paid'
);

-- Payment 4: b09d28be-0510-4006-ad77-a117c49f3880 (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'b09d28be-0510-4006-ad77-a117c49f3880',
  'c122a8ea-03d9-4ce6-a924-03160d5eac15',
  '2025-06-10',
  '2025-06-16',
  670.00,
  '{
    "accommodation": 310.25,
    "food_facilities": 359.75,
    "accommodation_original": 365.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 724.75,
    "total_after_discounts": 670.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-08 16:05:41.467+00',
  '2025-05-08 16:05:41.467+00',
  'paid'
);

-- Payment 5: 4f7df616-dc46-411b-88c4-2aa14982a7cc (100% discount code)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '4f7df616-dc46-411b-88c4-2aa14982a7cc',
  null,
  '2025-05-13',
  '2025-05-19',
  0.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 345.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 345.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 345.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-05-08 02:04:14.261878+00',
  '2025-05-08 02:04:14.261878+00',
  'paid'
);

-- Payment 6: 8f62cd1f-927a-4edb-8c4e-17abc3739cf4 (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '8f62cd1f-927a-4edb-8c4e-17abc3739cf4',
  'a6f0d33c-5b46-46c3-aa03-562371496a9c',
  '2025-06-24',
  '2025-07-14',
  660.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 660.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 660.00,
    "total_after_discounts": 660.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-07 08:41:30.739+00',
  '2025-05-07 08:41:30.739+00',
  'paid'
);

-- Payment 7: 6e2d74e4-e0ad-49b6-b2d9-ff846f068ad1 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '6e2d74e4-e0ad-49b6-b2d9-ff846f068ad1',
  'b8dab0c3-3cfb-4c8b-8275-81df21745409',
  '2025-05-13',
  '2025-05-26',
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
  '2025-05-07 07:42:22.402+00',
  '2025-05-07 07:42:22.402+00',
  'paid'
);

-- Payment 8: 6eed6457-e712-4f00-bc9b-4c0eb20c3054 (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '6eed6457-e712-4f00-bc9b-4c0eb20c3054',
  '493e3393-9cf9-48cb-b368-c4b98bde3bb5',
  '2025-06-24',
  '2025-07-14',
  648.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 648.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 648.00,
    "total_after_discounts": 648.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-06 20:47:56.253+00',
  '2025-05-06 20:47:56.253+00',
  'paid'
);

-- Payment 9: 37ab85f5-228d-480f-b368-bc04f5a98d36 (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '37ab85f5-228d-480f-b368-bc04f5a98d36',
  '3be7ecbe-3b29-4a58-a9ce-20532d5a9702',
  '2025-06-03',
  '2025-06-16',
  1388.00,
  '{
    "accommodation": 907.80,
    "food_facilities": 480.20,
    "accommodation_original": 1068.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1548.20,
    "total_after_discounts": 1388.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-05 08:56:58.762+00',
  '2025-05-05 08:56:58.762+00',
  'paid'
);

-- Payment 10: 375df650-09b3-4192-bc6f-71cdb56a2d16 (duration + discount code on food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '375df650-09b3-4192-bc6f-71cdb56a2d16',
  null,
  '2025-05-13',
  '2025-06-02',
  903.00,
  '{
    "accommodation": 337.50,
    "food_facilities": 565.50,
    "accommodation_original": 375.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.1273148,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 119.99,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1023.00,
    "total_after_discounts": 903.00
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-05-04 03:58:09.403335+00',
  '2025-05-04 03:58:09.403335+00',
  'paid'
);

-- Payment 11: 2ee06c77-b1bd-4530-8626-1ae1983f40a3 (duration discount only - cancelled)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '2ee06c77-b1bd-4530-8626-1ae1983f40a3',
  'a3d755f2-6633-4df0-9439-0eafb39f9d24',
  '2025-05-13',
  '2025-06-02',
  1041.00,
  '{
    "accommodation": 337.50,
    "food_facilities": 703.50,
    "accommodation_original": 375.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1078.50,
    "total_after_discounts": 1041.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-01 14:31:12.754+00',
  '2025-05-01 14:31:12.754+00',
  'refunded'
);

-- Payment 12: ddf80947-e364-4677-adf5-b3bcc112ae4d (complex discounts - cancelled)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'ddf80947-e364-4677-adf5-b3bcc112ae4d',
  'a3d755f2-6633-4df0-9439-0eafb39f9d24',
  '2025-05-06',
  '2025-06-02',
  0.00,
  '{
    "accommodation": 435.56,
    "food_facilities": 729.75,
    "accommodation_original": 500.00,
    "duration_discount_percent": 0.1278,
    "seasonal_discount_percent": 0.00,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.15208,
    "discount_code_applies_to": "total",
    "discount_code_amount": 1337.28,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1337.31,
    "total_after_discounts": 0.00
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-05-01 13:54:40.816+00',
  '2025-05-01 13:54:40.816+00',
  'refunded'
);

-- Payment 13: f6a510bf-caf6-4a94-b91b-e4baa6391451 (duration discount only - already created)
-- This one was already created in the first batch, so skipping 