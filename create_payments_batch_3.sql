-- Payment 1: 61a59c46-c940-4b7c-bb14-ac6fa1df9ca1 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '61a59c46-c940-4b7c-bb14-ac6fa1df9ca1',
  'b6a001fa-d1c9-4116-a47b-e1ed1c69170e',
  '2025-07-29',
  '2025-08-11',
  1280.00,
  '{
    "accommodation": 800.00,
    "food_facilities": 480.00,
    "accommodation_original": 800.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1280.00,
    "total_after_discounts": 1280.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-22 13:11:45.753+00',
  '2025-05-22 13:11:45.753+00',
  'paid'
);

-- Payment 2: 2f69377a-059e-4ea9-8c75-f387c8745799 (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '2f69377a-059e-4ea9-8c75-f387c8745799',
  'e931bbb6-9175-44ee-9e32-f5f755426886',
  '2025-09-02',
  '2025-09-22',
  2115.00,
  '{
    "accommodation": 986.00,
    "food_facilities": 1129.50,
    "accommodation_original": 1095.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 2224.50,
    "total_after_discounts": 2115.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-20 09:05:22.017866+00',
  '2025-05-20 09:05:22.017866+00',
  'paid'
);

-- Payment 3: 625ca556-906a-47d5-91b7-975b9a736ea3 (duration discount only - cancelled)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '625ca556-906a-47d5-91b7-975b9a736ea3',
  'e931bbb6-9175-44ee-9e32-f5f755426886',
  '2025-09-02',
  '2025-09-22',
  2115.00,
  '{
    "accommodation": 986.00,
    "food_facilities": 1129.50,
    "accommodation_original": 1095.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 2224.50,
    "total_after_discounts": 2115.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-20 09:03:27.883499+00',
  '2025-05-20 09:03:27.883499+00',
  'refunded'
);

-- Payment 4: 5c587337-7334-4f2a-8bf5-69bab8ce54f5 (100% discount code)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '5c587337-7334-4f2a-8bf5-69bab8ce54f5',
  '675f94f0-9b06-49d5-88d9-a302aa4d66e4',
  '2025-06-10',
  '2025-06-30',
  0.00,
  '{
    "accommodation": 729.00,
    "food_facilities": 648.00,
    "accommodation_original": 810.00,
    "duration_discount_percent": 0.10,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 838.35,
    "credits_used": 0.00,
    "subtotal_before_discounts": 838.35,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-05-19 18:27:37.376848+00',
  '2025-05-19 18:27:37.376848+00',
  'paid'
);

-- Payment 5: 029195c3-5bb8-471b-9892-2a6800efb084 (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '029195c3-5bb8-471b-9892-2a6800efb084',
  '0d1d469b-4bec-4fc8-a45e-6f7b3dec6c60',
  '2025-06-03',
  '2025-06-30',
  1340.76,
  '{
    "accommodation": 505.00,
    "food_facilities": 836.76,
    "accommodation_original": 580.00,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1416.76,
    "total_after_discounts": 1340.76
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-19 16:30:06.216+00',
  '2025-05-19 16:30:06.216+00',
  'paid'
);

-- Payment 6: 0072c633-06bb-445b-a43a-d412028271e8 (discount code only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '0072c633-06bb-445b-a43a-d412028271e8',
  'b5f1717e-dbec-41e3-b16d-eecdc245575d',
  '2025-07-29',
  '2025-08-11',
  730.00,
  '{
    "accommodation": 330.00,
    "food_facilities": 400.00,
    "accommodation_original": 330.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.1667,
    "discount_code_applies_to": "total",
    "discount_code_amount": 80.02,
    "credits_used": 0.00,
    "subtotal_before_discounts": 810.02,
    "total_after_discounts": 730.00
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-05-19 13:52:32.446907+00',
  '2025-05-19 13:52:32.446907+00',
  'paid'
);

-- Payment 7: dcac5f48-8df3-4b85-bd5a-f118210b0631 (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'dcac5f48-8df3-4b85-bd5a-f118210b0631',
  'e797c996-de83-4880-b7c9-4a687c6332ab',
  '2025-05-20',
  '2025-05-26',
  614.65,
  '{
    "accommodation": 279.00,
    "food_facilities": 345.00,
    "accommodation_original": 465.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.40,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 810.00,
    "total_after_discounts": 614.65
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-19 10:47:30.872+00',
  '2025-05-19 10:47:30.872+00',
  'paid'
);

-- Payment 8: d67f2d84-92cb-4080-a344-6ce693e18a9f (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'd67f2d84-92cb-4080-a344-6ce693e18a9f',
  '8bdeadfb-4ec9-4355-a74b-3bfcace8fcb7',
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
  '2025-05-17 08:28:17.921+00',
  '2025-05-17 08:28:17.921+00',
  'paid'
);

-- Payment 9: c2a4fa6b-6fd9-45ce-829f-c92b85f95d63 (seasonal + discount code on food)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'c2a4fa6b-6fd9-45ce-829f-c92b85f95d63',
  'b8dab0c3-3cfb-4c8b-8275-81df21745409',
  '2025-05-13',
  '2025-05-26',
  372.00,
  '{
    "accommodation": 324.00,
    "food_facilities": 48.00,
    "accommodation_original": 540.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.40,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.90,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 648.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1020.00,
    "total_after_discounts": 372.00
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-05-15 16:41:36.441127+00',
  '2025-05-15 16:41:36.441127+00',
  'paid'
);

-- Payment 10: 9080849b-8fcf-4946-a72b-4fa26986ea80 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '9080849b-8fcf-4946-a72b-4fa26986ea80',
  'dc9ee399-9da2-4c49-99bb-6a195a154b40',
  '2025-06-10',
  '2025-06-16',
  535.00,
  '{
    "accommodation": 145.00,
    "food_facilities": 390.00,
    "accommodation_original": 145.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 535.00,
    "total_after_discounts": 535.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-14 13:15:34.054+00',
  '2025-05-14 13:15:34.054+00',
  'paid'
);

-- Payment 11: 5fd0d49b-ead4-4291-9929-e4b848ba3b93 (seasonal discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '5fd0d49b-ead4-4291-9929-e4b848ba3b93',
  'e797c996-de83-4880-b7c9-4a687c6332ab',
  '2025-05-13',
  '2025-05-19',
  647.00,
  '{
    "accommodation": 279.00,
    "food_facilities": 368.00,
    "accommodation_original": 465.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.40,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 833.00,
    "total_after_discounts": 647.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-12 19:08:54.419+00',
  '2025-05-12 19:08:54.419+00',
  'paid'
); 