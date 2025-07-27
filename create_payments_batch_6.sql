-- Payment 1: 1e978be4-738e-4ffd-8246-935a2d038305 (no discounts, credits used)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '1e978be4-738e-4ffd-8246-935a2d038305',
  'a6831ef3-7aa7-4920-8ea9-1fae3777f805',
  '2025-07-08',
  '2025-07-14',
  493.00,
  '{
    "accommodation": 125.00,
    "food_facilities": 368.00,
    "accommodation_original": 125.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 493.00,
    "total_after_discounts": 493.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 06:44:08.273+00',
  '2025-06-23 06:44:08.273+00',
  'paid'
);

-- Payment 2: bb21b360-eed7-4c37-b183-99b79d730bf5 (discount code on food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'bb21b360-eed7-4c37-b183-99b79d730bf5',
  '79fd2e15-d4e1-42d0-a827-da9f926fefa9',
  '2025-06-24',
  '2025-06-30',
  520.32,
  '{
    "accommodation": 400.00,
    "food_facilities": 120.32,
    "accommodation_original": 400.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "LEILALALA",
    "discount_code_percent": 0.51,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 247.68,
    "credits_used": 0.00,
    "subtotal_before_discounts": 768.00,
    "total_after_discounts": 520.32
  }'::jsonb,
  'LEILALALA',
  'initial',
  null,
  '2025-06-23 02:33:00.924+00',
  '2025-06-23 02:33:00.924+00',
  'paid'
);

-- Payment 3: 99c11b39-1713-43eb-8084-a6ef5721ba30 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '99c11b39-1713-43eb-8084-a6ef5721ba30',
  '4fdd42eb-906d-47ec-bc95-2475f3f7886d',
  '2025-08-26',
  '2025-09-01',
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
  '2025-06-22 13:17:03.235+00',
  '2025-06-22 13:17:03.235+00',
  'paid'
);

-- Payment 4: 847f83a3-6691-4141-a711-91138190c0b5 (discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '847f83a3-6691-4141-a711-91138190c0b5',
  '93cbcae7-7a9a-439a-99fe-47d671fa975b',
  '2025-09-02',
  '2025-09-29',
  752.40,
  '{
    "accommodation": 0.00,
    "food_facilities": 752.40,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": "ECHONITZSCHE",
    "discount_code_percent": 0.10,
    "discount_code_applies_to": "total",
    "discount_code_amount": 83.60,
    "credits_used": 0.00,
    "subtotal_before_discounts": 836.00,
    "total_after_discounts": 752.40
  }'::jsonb,
  'ECHONITZSCHE',
  'initial',
  null,
  '2025-06-19 21:48:12.319+00',
  '2025-06-19 21:48:12.319+00',
  'paid'
);

-- Payment 5: 218190c2-ed1d-43a9-b609-c8f940d5bb5f (seasonal discount)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '218190c2-ed1d-43a9-b609-c8f940d5bb5f',
  'e4a43ca6-0e6b-415a-943c-af9ae76ee5e3',
  '2025-06-27',
  '2025-06-30',
  595.80,
  '{
    "accommodation": 219.00,
    "food_facilities": 376.80,
    "accommodation_original": 219.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 700.94,
    "total_after_discounts": 595.80
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-19 20:10:02.512+00',
  '2025-06-19 20:10:02.512+00',
  'paid'
);

-- Payment 6: 1cb4d232-8bb4-4a96-8415-cdfdd8fceae2 (100% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '1cb4d232-8bb4-4a96-8415-cdfdd8fceae2',
  'd545f3a1-9f43-459b-b7df-8e3e2ca79289',
  '2025-07-08',
  '2025-07-21',
  0.00,
  '{
    "accommodation": 540.00,
    "food_facilities": 0.00,
    "accommodation_original": 540.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 480.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 480.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-06-18 08:36:34.955+00',
  '2025-06-18 08:36:34.955+00',
  'paid'
);

-- Payment 7: 32c44772-fbdf-455d-8bca-944341a37eea (duration discount)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '32c44772-fbdf-455d-8bca-944341a37eea',
  '089bcee4-9492-4521-937b-7df7e56f6f27',
  '2025-08-12',
  '2025-09-01',
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
  '2025-06-16 12:51:31.86+00',
  '2025-06-16 12:51:31.86+00',
  'paid'
);

-- Payment 8: 9a1c87a2-0310-4902-ad10-0c88c491c440 (duration discount)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '9a1c87a2-0310-4902-ad10-0c88c491c440',
  '0096e3b7-9b08-459f-98f8-e332b48b45b8',
  '2025-09-02',
  '2025-09-29',
  836.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 836.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 836.00,
    "total_after_discounts": 836.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-16 05:24:33.004+00',
  '2025-06-16 05:24:33.004+00',
  'paid'
);

-- Payment 9: bf5c9b4e-a6e2-48e9-8580-8f78bc754d10 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'bf5c9b4e-a6e2-48e9-8580-8f78bc754d10',
  'ddfabff3-1545-4f25-bc38-475ffe6ec84b',
  '2025-06-24',
  '2025-06-30',
  368.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 368.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 368.00,
    "total_after_discounts": 368.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-15 08:39:37.932+00',
  '2025-06-15 08:39:37.932+00',
  'paid'
);

-- Payment 10: e0619352-fc57-4762-a636-8d52d2f0cfbb (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'e0619352-fc57-4762-a636-8d52d2f0cfbb',
  '5b10bf58-a75b-4912-a17e-b258e308437a',
  '2025-07-29',
  '2025-08-04',
  810.00,
  '{
    "accommodation": 465.00,
    "food_facilities": 345.00,
    "accommodation_original": 465.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 810.00,
    "total_after_discounts": 810.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-13 22:55:17.252+00',
  '2025-06-13 22:55:17.252+00',
  'paid'
);

-- Payment 11: 31640814-b1ea-4207-a7dc-92031372d584 (100% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '31640814-b1ea-4207-a7dc-92031372d584',
  null,
  '2025-06-24',
  '2025-06-29',
  0.00,
  '{
    "accommodation": 191.60,
    "food_facilities": 405.00,
    "accommodation_original": 191.60,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 405.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 405.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-06-23 14:01:28.862972+00',
  '2025-06-23 14:01:28.862972+00',
  'paid'
);

-- Payment 12: 1d90c8aa-a018-4008-a030-52ec0fd48236 (100% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '1d90c8aa-a018-4008-a030-52ec0fd48236',
  '72ee8e3f-f560-4cb7-b51e-d29fa2151f91',
  '2025-06-23',
  '2025-06-29',
  0.00,
  '{
    "accommodation": 230.00,
    "food_facilities": 405.00,
    "accommodation_original": 230.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 405.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 405.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-06-23 14:01:11.420904+00',
  '2025-06-23 14:01:11.420904+00',
  'paid'
);

-- Payment 13: dc4dfe6b-40af-4ee9-8f57-a804a39ca871 (unknown discount code)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'dc4dfe6b-40af-4ee9-8f57-a804a39ca871',
  null,
  '2025-06-24',
  '2025-06-29',
  130.00,
  '{
    "accommodation": 243.00,
    "food_facilities": 351.00,
    "accommodation_original": 243.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.767,
    "discount_code_applies_to": "total",
    "discount_code_amount": 305.22,
    "credits_used": 0.00,
    "subtotal_before_discounts": 435.22,
    "total_after_discounts": 130.00
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-06-23 14:00:06.440937+00',
  '2025-06-23 14:00:06.440937+00',
  'paid'
);

-- Payment 14: 86aaa8d0-bdad-4ee2-ad2a-cb4a73855e38 (seasonal discount)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '86aaa8d0-bdad-4ee2-ad2a-cb4a73855e38',
  '4c07d6a6-6f13-42fa-86e8-e071410b5031',
  '2025-06-24',
  '2025-06-30',
  544.00,
  '{
    "accommodation": 165.00,
    "food_facilities": 404.00,
    "accommodation_original": 194.12,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 569.00,
    "total_after_discounts": 544.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 12:46:12.484+00',
  '2025-06-23 12:46:12.484+00',
  'paid'
);

-- Payment 15: ba2ca8c3-4235-418e-abfe-df34ab48d777 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'ba2ca8c3-4235-418e-abfe-df34ab48d777',
  'a3d755f2-6633-4df0-9439-0eafb39f9d24',
  '2025-06-24',
  '2025-06-30',
  493.00,
  '{
    "accommodation": 125.00,
    "food_facilities": 368.00,
    "accommodation_original": 125.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 493.00,
    "total_after_discounts": 493.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 11:31:19.657+00',
  '2025-06-23 11:31:19.657+00',
  'paid'
);

-- Payment 16: af130255-9182-491e-895a-6c1f93e428e7 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'af130255-9182-491e-895a-6c1f93e428e7',
  'a3d755f2-6633-4df0-9439-0eafb39f9d24',
  '2025-06-24',
  '2025-06-30',
  493.00,
  '{
    "accommodation": 125.00,
    "food_facilities": 368.00,
    "accommodation_original": 125.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 493.00,
    "total_after_discounts": 493.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 11:30:04.555+00',
  '2025-06-23 11:30:04.555+00',
  'paid'
);

-- Payment 17: 6a37330a-9f6c-421d-8fd3-6d96c301a15e (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '6a37330a-9f6c-421d-8fd3-6d96c301a15e',
  'a3d755f2-6633-4df0-9439-0eafb39f9d24',
  '2025-06-24',
  '2025-06-30',
  493.00,
  '{
    "accommodation": 125.00,
    "food_facilities": 368.00,
    "accommodation_original": 125.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 493.00,
    "total_after_discounts": 493.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 11:29:34.668+00',
  '2025-06-23 11:29:34.668+00',
  'paid'
);

-- Payment 18: ec7c76be-1a28-4911-91f7-230b83f9ca35 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'ec7c76be-1a28-4911-91f7-230b83f9ca35',
  'd5f1f5d6-bb23-4ae1-af69-a2ee36bc8037',
  '2025-06-24',
  '2025-06-30',
  493.00,
  '{
    "accommodation": 125.00,
    "food_facilities": 368.00,
    "accommodation_original": 125.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 493.00,
    "total_after_discounts": 493.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 11:22:27.451+00',
  '2025-06-23 11:22:27.451+00',
  'paid'
);

-- Payment 19: 89e25198-0d3d-4ea3-8ada-fbf2850d2e15 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '89e25198-0d3d-4ea3-8ada-fbf2850d2e15',
  'ed27d129-ab2f-448d-848c-3f26cd9a6dd1',
  '2025-07-01',
  '2025-07-14',
  900.00,
  '{
    "accommodation": 290.00,
    "food_facilities": 610.00,
    "accommodation_original": 290.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 900.00,
    "total_after_discounts": 900.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 07:03:43.927+00',
  '2025-06-23 07:03:43.927+00',
  'paid'
);

-- Payment 20: 17b88118-1ba1-481c-9fef-0c226367ef41 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '17b88118-1ba1-481c-9fef-0c226367ef41',
  '1cab7ff9-fbaa-4c33-a871-cdfd1d8bf930',
  '2025-07-08',
  '2025-07-14',
  638.00,
  '{
    "accommodation": 270.00,
    "food_facilities": 368.00,
    "accommodation_original": 270.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 638.00,
    "total_after_discounts": 638.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-29 20:23:37.761+00',
  '2025-06-29 20:23:37.761+00',
  'paid'
);

-- Payment 21: 08b67fb4-78a6-4280-bb51-fe7b6c6eda7d (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '08b67fb4-78a6-4280-bb51-fe7b6c6eda7d',
  '38bc66ce-bfd6-46b0-9e44-69a67dc58338',
  '2025-07-15',
  '2025-07-21',
  810.00,
  '{
    "accommodation": 465.00,
    "food_facilities": 345.00,
    "accommodation_original": 465.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 810.00,
    "total_after_discounts": 810.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-28 14:54:18.988+00',
  '2025-06-28 14:54:18.988+00',
  'paid'
);

-- Payment 22: fa330518-4bce-4091-8f92-dae671b0f577 (50% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'fa330518-4bce-4091-8f92-dae671b0f577',
  'a2c20d93-1719-4d17-ae9f-b74333a0861f',
  '2025-07-08',
  '2025-07-14',
  255.00,
  '{
    "accommodation": 165.00,
    "food_facilities": 345.00,
    "accommodation_original": 165.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "GRETATERG",
    "discount_code_percent": 0.50,
    "discount_code_applies_to": "total",
    "discount_code_amount": 255.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 510.00,
    "total_after_discounts": 255.00
  }'::jsonb,
  'GRETATERG',
  'initial',
  null,
  '2025-06-27 11:10:32.441+00',
  '2025-06-27 11:10:32.441+00',
  'paid'
);

-- Payment 23: 052f438c-9ba3-4966-8012-5f4f8f438c83 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '052f438c-9ba3-4966-8012-5f4f8f438c83',
  'af05cd7e-0f6c-4afe-945c-836339ea0f3b',
  '2025-08-05',
  '2025-08-11',
  490.00,
  '{
    "accommodation": 145.00,
    "food_facilities": 345.00,
    "accommodation_original": 145.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 490.00,
    "total_after_discounts": 490.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-26 16:03:36.123+00',
  '2025-06-26 16:03:36.123+00',
  'paid'
);

-- Payment 24: 2c1aff89-9669-4287-a2ad-b161d25aaffd (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '2c1aff89-9669-4287-a2ad-b161d25aaffd',
  'd7869d94-1e38-4e7e-b105-6fa288c04f23',
  '2025-08-05',
  '2025-08-11',
  368.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 368.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 368.00,
    "total_after_discounts": 368.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-24 15:03:57.503+00',
  '2025-06-24 15:03:57.503+00',
  'paid'
);

-- Payment 25: c8d619b1-b78a-4e34-962a-4c426623bee5 (25% discount code on food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'c8d619b1-b78a-4e34-962a-4c426623bee5',
  'df4a65a8-ace4-448e-956f-e729b006ef7c',
  '2025-07-01',
  '2025-07-07',
  258.75,
  '{
    "accommodation": 0.00,
    "food_facilities": 258.75,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "RIAIR",
    "discount_code_percent": 0.25,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 86.25,
    "credits_used": 0.00,
    "subtotal_before_discounts": 345.00,
    "total_after_discounts": 258.75
  }'::jsonb,
  'RIAIR',
  'initial',
  null,
  '2025-06-24 14:44:48.178+00',
  '2025-06-24 14:44:48.178+00',
  'paid'
);

-- Payment 26: d56edc41-8b2f-40b6-a48f-2bb135baba4e (51.08% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'd56edc41-8b2f-40b6-a48f-2bb135baba4e',
  'ce8fa7eb-eaf8-484a-86fe-74daedc63521',
  '2025-06-24',
  '2025-06-30',
  180.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 180.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "EUGENIOYO",
    "discount_code_percent": 0.5108,
    "discount_code_applies_to": "total",
    "discount_code_amount": 188.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 368.00,
    "total_after_discounts": 180.00
  }'::jsonb,
  'EUGENIOYO',
  'initial',
  null,
  '2025-06-24 07:31:43.158492+00',
  '2025-06-24 07:31:43.158492+00',
  'paid'
);

-- Payment 27: d7e961d3-3325-4658-91c6-638f79d9b903 (seasonal discount)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'd7e961d3-3325-4658-91c6-638f79d9b903',
  '4bf73f57-69d2-4c3a-a4cc-68c72a55b95c',
  '2025-06-24',
  '2025-06-30',
  508.00,
  '{
    "accommodation": 165.00,
    "food_facilities": 368.00,
    "accommodation_original": 194.12,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.15,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 533.00,
    "total_after_discounts": 508.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-06-23 15:15:04.852+00',
  '2025-06-23 15:15:04.852+00',
  'paid'
);

-- Payment 28: d6f94eb0-faef-4b0a-8d2b-7128228ed654 (100% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'd6f94eb0-faef-4b0a-8d2b-7128228ed654',
  null,
  '2025-06-24',
  '2025-06-29',
  0.00,
  '{
    "accommodation": 191.60,
    "food_facilities": 405.00,
    "accommodation_original": 191.60,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 405.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 405.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-06-23 14:03:08.181072+00',
  '2025-06-23 14:03:08.181072+00',
  'paid'
);

-- Payment 29: 2e84fba4-a718-43b6-aac6-8c6ee42ff752 (100% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '2e84fba4-a718-43b6-aac6-8c6ee42ff752',
  null,
  '2025-06-24',
  '2025-06-29',
  0.00,
  '{
    "accommodation": 191.60,
    "food_facilities": 405.00,
    "accommodation_original": 191.60,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 405.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 405.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-06-23 14:02:28.572047+00',
  '2025-06-23 14:02:28.572047+00',
  'paid'
);

-- Payment 30: 5ddfaa91-4689-4822-8a57-787e8f9265da (duration discount, credits used)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '5ddfaa91-4689-4822-8a57-787e8f9265da',
  '51ae550e-560f-4ff8-be92-e2814533292c',
  '2025-08-05',
  '2025-08-25',
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
    "credits_used": 72.00,
    "subtotal_before_discounts": 720.00,
    "total_after_discounts": 648.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-10 09:13:19.029+00',
  '2025-07-10 09:13:19.029+00',
  'paid'
);

-- Payment 31: e692817b-e10d-4638-9818-6738907c486c (seasonal discount)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'e692817b-e10d-4638-9818-6738907c486c',
  'a1cc2c1f-3b7f-483e-aaf3-7246a09f7669',
  '2025-07-15',
  '2025-07-28',
  770.00,
  '{
    "accommodation": 290.00,
    "food_facilities": 480.00,
    "accommodation_original": 290.00,
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
  '2025-07-09 19:10:54.753+00',
  '2025-07-09 19:10:54.753+00',
  'paid'
);

-- Payment 32: 0290daa5-c8d7-4e84-9af7-e05bca1ec8d3 (100% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '0290daa5-c8d7-4e84-9af7-e05bca1ec8d3',
  '939b834c-5109-453d-8551-19179ddafa1d',
  '2025-07-28',
  '2025-08-06',
  0.00,
  '{
    "accommodation": 270.00,
    "food_facilities": 345.00,
    "accommodation_original": 270.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 615.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 615.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-07-08 22:47:16.505+00',
  '2025-07-08 22:47:16.505+00',
  'paid'
);

-- Payment 33: b0987596-b813-4396-8a5b-f408a288c53f (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'b0987596-b813-4396-8a5b-f408a288c53f',
  '2e500e2f-f230-4c2a-a86d-17a94a4033c1',
  '2025-09-16',
  '2025-09-29',
  736.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 736.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 736.00,
    "total_after_discounts": 736.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-08 16:06:12.193+00',
  '2025-07-08 16:06:12.193+00',
  'paid'
);

-- Payment 34: 8d507f53-cd1c-41e9-9193-c3c765d180af (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '8d507f53-cd1c-41e9-9193-c3c765d180af',
  'a3d755f2-6633-4df0-9439-0eafb39f9d24',
  '2025-07-08',
  '2025-07-14',
  513.00,
  '{
    "accommodation": 145.00,
    "food_facilities": 368.00,
    "accommodation_original": 145.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 513.00,
    "total_after_discounts": 513.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-07 17:41:56.074+00',
  '2025-07-07 17:41:56.074+00',
  'paid'
);

-- Payment 35: 3ad0df76-0241-48ab-851d-7dccf5ef6bcb (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '3ad0df76-0241-48ab-851d-7dccf5ef6bcb',
  'a3d755f2-6633-4df0-9439-0e4f-862d874f20a8',
  '2025-07-08',
  '2025-07-14',
  513.00,
  '{
    "accommodation": 145.00,
    "food_facilities": 368.00,
    "accommodation_original": 145.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 513.00,
    "total_after_discounts": 513.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-07 17:41:34.16+00',
  '2025-07-07 17:41:34.16+00',
  'paid'
);

-- Payment 36: 39ce1675-fd31-49a5-9827-81e8666db25d (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '39ce1675-fd31-49a5-9827-81e8666db25d',
  '43de1a3e-70c2-44e1-9fe3-61cbec8e3e1f',
  '2025-07-08',
  '2025-07-14',
  533.00,
  '{
    "accommodation": 165.00,
    "food_facilities": 368.00,
    "accommodation_original": 165.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 533.00,
    "total_after_discounts": 533.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-04 17:45:26.696+00',
  '2025-07-04 17:45:26.696+00',
  'paid'
);

-- Payment 37: c97f9681-ee5c-48be-90b8-a5e1fdd181ed (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'c97f9681-ee5c-48be-90b8-a5e1fdd181ed',
  'ed27d129-ab2f-448d-848c-3f26cd9a6dd1',
  '2025-07-15',
  '2025-07-21',
  490.00,
  '{
    "accommodation": 145.00,
    "food_facilities": 345.00,
    "accommodation_original": 145.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 490.00,
    "total_after_discounts": 490.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-02 21:59:05.612+00',
  '2025-07-02 21:59:05.612+00',
  'paid'
);

-- Payment 38: 394fa0dc-75f5-4264-9cac-23c5aa043659 (duration discount, credits used)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '394fa0dc-75f5-4264-9cac-23c5aa043659',
  '67c12754-fb2c-4c20-a223-ebf8c45c8c6e',
  '2025-08-05',
  '2025-08-25',
  750.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 750.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 84.00,
    "subtotal_before_discounts": 834.00,
    "total_after_discounts": 750.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-01 20:59:16.65+00',
  '2025-07-01 20:59:16.65+00',
  'paid'
);

-- Payment 39: 49b8bd06-56f2-4e97-9bd0-add547142d5c (100% discount code on food_facilities)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '49b8bd06-56f2-4e97-9bd0-add547142d5c',
  '74c45d80-5417-41d1-8dc6-17f8407fee69',
  '2025-09-09',
  '2025-09-22',
  730.00,
  '{
    "accommodation": 730.00,
    "food_facilities": 0.00,
    "accommodation_original": 730.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "NEILSGOTWHEELS",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 614.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1344.00,
    "total_after_discounts": 730.00
  }'::jsonb,
  'NEILSGOTWHEELS',
  'initial',
  null,
  '2025-07-01 06:10:16.894+00',
  '2025-07-01 06:10:16.894+00',
  'paid'
);

-- Payment 40: 6dfa9dab-f415-47e1-a040-4c2fc8eb0cbe (no discounts, accommodation only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '6dfa9dab-f415-47e1-a040-4c2fc8eb0cbe',
  '1ca0ac59-1e2b-4b07-88df-a034e131ca1f',
  '2025-08-26',
  '2025-09-01',
  345.00,
  '{
    "accommodation": 345.00,
    "food_facilities": 0.00,
    "accommodation_original": 345.00,
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
  '2025-07-27 11:59:47.829+00',
  '2025-07-27 11:59:47.829+00',
  'paid'
);

-- Payment 41: ff14d88b-1f9b-4c9c-9327-e373a9cf84fe (no discounts, accommodation + food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'ff14d88b-1f9b-4c9c-9327-e373a9cf84fe',
  '7d691631-731f-4552-b908-d48bbfdf8557',
  '2025-08-05',
  '2025-08-11',
  468.00,
  '{
    "accommodation": 345.00,
    "food_facilities": 123.00,
    "accommodation_original": 345.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 468.00,
    "total_after_discounts": 468.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-26 14:17:38.177+00',
  '2025-07-26 14:17:38.177+00',
  'paid'
);

-- Payment 42: 62e873fd-124d-4d93-b198-5bbbe923d1e9 (duration discount 13%, accommodation + food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '62e873fd-124d-4d93-b198-5bbbe923d1e9',
  'd1e83974-02dc-4620-a4c7-720df6112019',
  '2025-08-19',
  '2025-09-15',
  1524.00,
  '{
    "accommodation": 1096.00,
    "food_facilities": 428.00,
    "accommodation_original": 1260.92,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1688.92,
    "total_after_discounts": 1524.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-23 18:18:02.47+00',
  '2025-07-23 18:18:02.47+00',
  'paid'
);

-- Payment 43: 11c7252f-d2f1-448a-a9e5-8837ba61b1f9 (no discounts, accommodation only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '11c7252f-d2f1-448a-a9e5-8837ba61b1f9',
  'd375ec89-0423-4561-9704-30e322e8cd90',
  '2025-08-19',
  '2025-08-25',
  345.00,
  '{
    "accommodation": 345.00,
    "food_facilities": 0.00,
    "accommodation_original": 345.00,
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
  '2025-07-23 17:07:51.067+00',
  '2025-07-23 17:07:51.067+00',
  'paid'
);

-- Payment 44: 7a7a3e0f-598a-4851-bc26-8802b90db3c2 (44% discount code on food_facilities)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '7a7a3e0f-598a-4851-bc26-8802b90db3c2',
  '4f426fd8-fde1-4cd1-8919-a6cda25cd377',
  '2025-07-22',
  '2025-07-28',
  193.20,
  '{
    "accommodation": 345.00,
    "food_facilities": 0.00,
    "accommodation_original": 345.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "ISABELLNECESSARY",
    "discount_code_percent": 0.44,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 151.80,
    "credits_used": 0.00,
    "subtotal_before_discounts": 345.00,
    "total_after_discounts": 193.20
  }'::jsonb,
  'ISABELLNECESSARY',
  'initial',
  null,
  '2025-07-21 21:42:27.186+00',
  '2025-07-21 21:42:27.186+00',
  'paid'
);

-- Payment 45: 7d3f58df-5372-4099-bca7-cc99a71e6d66 (no discounts, accommodation + food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '7d3f58df-5372-4099-bca7-cc99a71e6d66',
  '0d798b4b-c954-4a02-adbf-add5614107ae',
  '2025-07-22',
  '2025-07-28',
  451.00,
  '{
    "accommodation": 345.00,
    "food_facilities": 106.00,
    "accommodation_original": 345.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 451.00,
    "total_after_discounts": 451.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-20 16:24:23.031+00',
  '2025-07-20 16:24:23.031+00',
  'paid'
);

-- Payment 46: a3e6d2f1-dd5e-4392-8b37-b800ed7c54f4 (duration discount 13%, accommodation + food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'a3e6d2f1-dd5e-4392-8b37-b800ed7c54f4',
  'e5686d63-86aa-4f60-8970-545683199cf3',
  '2025-08-12',
  '2025-09-08',
  1264.00,
  '{
    "accommodation": 836.00,
    "food_facilities": 428.00,
    "accommodation_original": 960.92,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1388.92,
    "total_after_discounts": 1264.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-19 17:41:44.737+00',
  '2025-07-19 17:41:44.737+00',
  'paid'
);

-- Payment 47: 56285fe2-d10e-4ce6-9007-8c13af0dfaec (no discounts, accommodation + food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '56285fe2-d10e-4ce6-9007-8c13af0dfaec',
  '6ceb4ce6-bd50-46b1-9b3a-881d20cb0ed6',
  '2025-07-22',
  '2025-08-04',
  1090.00,
  '{
    "accommodation": 630.00,
    "food_facilities": 460.00,
    "accommodation_original": 630.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1090.00,
    "total_after_discounts": 1090.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-19 11:02:28.849+00',
  '2025-07-19 11:02:28.849+00',
  'paid'
);

-- Payment 48: c0edd411-4440-472f-8b21-cceca1ed2a5f (no data available, 0.00 total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'c0edd411-4440-472f-8b21-cceca1ed2a5f',
  'e7d4d8c0-e692-40ff-9cf9-1f6ed523c9be',
  '2025-08-05',
  '2025-08-11',
  0.00,
  '{
    "accommodation": 0.00,
    "food_facilities": 0.00,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 0.00,
    "total_after_discounts": 0.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-18 13:53:31.007073+00',
  '2025-07-18 13:53:31.007073+00',
  'paid'
);

-- Payment 49: 7bd69eed-d34e-4b9b-bda4-a25ec9fb814c (44% discount code on food_facilities)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '7bd69eed-d34e-4b9b-bda4-a25ec9fb814c',
  '7ebf31b1-1126-4345-b824-7021df727d06',
  '2025-07-22',
  '2025-07-28',
  193.20,
  '{
    "accommodation": 345.00,
    "food_facilities": 0.00,
    "accommodation_original": 345.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "GETMOSSY",
    "discount_code_percent": 0.44,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 151.80,
    "credits_used": 0.00,
    "subtotal_before_discounts": 345.00,
    "total_after_discounts": 193.20
  }'::jsonb,
  'GETMOSSY',
  'initial',
  null,
  '2025-07-16 14:23:10.608+00',
  '2025-07-16 14:23:10.608+00',
  'paid'
);

-- Payment 50: 9d285711-70bb-4dcb-a442-ef6a949d2e84 (44% discount code on food_facilities)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '9d285711-70bb-4dcb-a442-ef6a949d2e84',
  'b0e8b8a4-cc37-4a7c-bdd7-ef1596f2fd8a',
  '2025-07-22',
  '2025-07-28',
  193.20,
  '{
    "accommodation": 345.00,
    "food_facilities": 0.00,
    "accommodation_original": 345.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "GETMOSSY",
    "discount_code_percent": 0.44,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 151.80,
    "credits_used": 0.00,
    "subtotal_before_discounts": 345.00,
    "total_after_discounts": 193.20
  }'::jsonb,
  'GETMOSSY',
  'initial',
  null,
  '2025-07-16 14:17:36.833+00',
  '2025-07-16 14:17:36.833+00',
  'paid'
);

-- Payment 51: a7fddde0-f290-43b0-a147-fee6369badc2 (no discounts, accommodation only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'a7fddde0-f290-43b0-a147-fee6369badc2',
  '27cfb64a-f4f8-47f2-a401-fb4aee36ad9f',
  '2025-07-22',
  '2025-08-04',
  700.00,
  '{
    "accommodation": 700.00,
    "food_facilities": 0.00,
    "accommodation_original": 700.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 700.00,
    "total_after_discounts": 700.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-07-14 20:09:31.508+00',
  '2025-07-14 20:09:31.508+00',
  'paid'
);

-- Payment 52: 90c58654-d66b-4c3e-81fd-1626b0b87601 (44% discount code on food_facilities)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '90c58654-d66b-4c3e-81fd-1626b0b87601',
  '4f426fd8-fde1-4cd1-8919-a6cda25cd377',
  '2025-07-15',
  '2025-07-21',
  193.20,
  '{
    "accommodation": 345.00,
    "food_facilities": 0.00,
    "accommodation_original": 345.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "ISABELLNECESSARY",
    "discount_code_percent": 0.44,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 151.80,
    "credits_used": 0.00,
    "subtotal_before_discounts": 345.00,
    "total_after_discounts": 193.20
  }'::jsonb,
  'ISABELLNECESSARY',
  'initial',
  null,
  '2025-07-14 18:56:08.985+00',
  '2025-07-14 18:56:08.985+00',
  'paid'
);

-- Payment 53: e6e6bfbe-b9b9-4588-875a-65d6fc1ba613 (no discounts, accommodation only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'e6e6bfbe-b9b9-4588-875a-65d6fc1ba613',
  '8bdeadfb-4ec9-4355-a74b-3bfcace8fcb7',
  '2025-07-15',
  '2025-07-21',
  345.00,
  '{
    "accommodation": 345.00,
    "food_facilities": 0.00,
    "accommodation_original": 345.00,
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
  '2025-07-14 09:40:09.463+00',
  '2025-07-14 09:40:09.463+00',
  'paid'
);

-- Payment 54: 69002c8b-6cf3-403c-973c-20e2c1863115 (8% discount code on food_facilities)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '69002c8b-6cf3-403c-973c-20e2c1863115',
  '743f1ebc-674d-4b21-9b8f-8ae3ab6fbdd1',
  '2025-08-26',
  '2025-09-08',
  687.60,
  '{
    "accommodation": 480.00,
    "food_facilities": 246.00,
    "accommodation_original": 480.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "DUANOFUS",
    "discount_code_percent": 0.08,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 38.40,
    "credits_used": 0.00,
    "subtotal_before_discounts": 726.00,
    "total_after_discounts": 687.60
  }'::jsonb,
  'DUANOFUS',
  'initial',
  null,
  '2025-07-13 04:29:51.47+00',
  '2025-07-13 04:29:51.47+00',
  'paid'
);

-- Payment 55: 3fd6fae3-ab16-47bc-9e40-3df86d095b1a (10% discount code on total)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '3fd6fae3-ab16-47bc-9e40-3df86d095b1a',
  'd6e1d6e9-7cff-4f87-a33d-8a0e7592ff4b',
  '2025-07-15',
  '2025-09-15',
  3013.20,
  '{
    "accommodation": 1575.00,
    "food_facilities": 1773.00,
    "accommodation_original": 1575.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "ROBERTSTEPHAN10",
    "discount_code_percent": 0.10,
    "discount_code_applies_to": "total",
    "discount_code_amount": 1575.90,
    "credits_used": 0.00,
    "subtotal_before_discounts": 4589.10,
    "total_after_discounts": 3013.20
  }'::jsonb,
  'ROBERTSTEPHAN10',
  'initial',
  null,
  '2025-07-11 17:06:04.744+00',
  '2025-07-11 17:06:04.744+00',
  'paid'
);

-- Payment 56: 3b9b3aaa-79a2-4038-8e0a-1c14273281d7 (21% discount code on food_facilities)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '3b9b3aaa-79a2-4038-8e0a-1c14273281d7',
  '7f6cb4d6-00af-4625-91e9-28b7577e5e30',
  '2025-07-15',
  '2025-07-28',
  725.00,
  '{
    "accommodation": 500.00,
    "food_facilities": 330.00,
    "accommodation_original": 500.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "ELIASUNLOCKED",
    "discount_code_percent": 0.21,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 105.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 830.00,
    "total_after_discounts": 725.00
  }'::jsonb,
  'ELIASUNLOCKED',
  'initial',
  null,
  '2025-07-11 12:02:15.488+00',
  '2025-07-11 12:02:15.488+00',
  'paid'
); 