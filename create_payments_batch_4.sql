-- Payment 1: 3044a501-9fde-4115-a9bd-ddf9b16ad5bc (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '3044a501-9fde-4115-a9bd-ddf9b16ad5bc',
  '90f5f4de-499f-4fd3-bbce-f2f827883536',
  '2025-07-29',
  '2025-08-04',
  902.00,
  '{
    "accommodation": 534.00,
    "food_facilities": 368.00,
    "accommodation_original": 534.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 902.00,
    "total_after_discounts": 902.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-30 07:01:50.843+00',
  '2025-05-30 07:01:50.843+00',
  'paid'
);

-- Payment 2: a650f15b-0ff0-45cc-b8c3-cff9a9b22217 (100% discount code)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'a650f15b-0ff0-45cc-b8c3-cff9a9b22217',
  '4de2b1a3-9bb2-4166-b49e-36a44069deec',
  '2025-06-03',
  '2025-08-04',
  0.00,
  '{
    "accommodation": 1781.00,
    "food_facilities": 1583.71,
    "accommodation_original": 2430.00,
    "duration_discount_percent": 0.2668,
    "seasonal_discount_percent": 0.00,
    "discount_code": "BOOKITOUT77",
    "discount_code_percent": 1.00,
    "discount_code_applies_to": "total",
    "discount_code_amount": 2352.73,
    "credits_used": 0.00,
    "subtotal_before_discounts": 2352.73,
    "total_after_discounts": 0.00
  }'::jsonb,
  'BOOKITOUT77',
  'initial',
  null,
  '2025-05-27 18:46:53.992218+00',
  '2025-05-27 18:46:53.992218+00',
  'paid'
);

-- Payment 3: 9be61ffa-4b4d-4ef2-83f6-30e2390c3f5e (discount code on food only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '9be61ffa-4b4d-4ef2-83f6-30e2390c3f5e',
  '138eb552-77b4-4f0a-8dad-75e543585a00',
  '2025-05-27',
  '2025-06-23',
  493.24,
  '{
    "accommodation": 0.00,
    "food_facilities": 493.24,
    "accommodation_original": 0.00,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": "HUWRU",
    "discount_code_percent": 0.41,
    "discount_code_applies_to": "food_facilities",
    "discount_code_amount": 342.76,
    "credits_used": 0.00,
    "subtotal_before_discounts": 836.00,
    "total_after_discounts": 493.24
  }'::jsonb,
  'HUWRU',
  'initial',
  null,
  '2025-05-27 12:16:44.609+00',
  '2025-05-27 12:16:44.609+00',
  'paid'
);

-- Payment 4: 81a23dbe-138f-4dd3-99ff-03de4a5f7e8c (seasonal + calculated discount code)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '81a23dbe-138f-4dd3-99ff-03de4a5f7e8c',
  '4187d6fb-698c-43b9-b347-8d18dddf4ecc',
  '2025-05-27',
  '2025-06-02',
  392.70,
  '{
    "accommodation": 173.25,
    "food_facilities": 220.80,
    "accommodation_original": 270.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.36,
    "discount_code": "UNKNOWN",
    "discount_code_percent": 0.241892,
    "discount_code_applies_to": "total",
    "discount_code_amount": 222.30,
    "credits_used": 0.00,
    "subtotal_before_discounts": 615.00,
    "total_after_discounts": 392.70
  }'::jsonb,
  'UNKNOWN',
  'initial',
  null,
  '2025-05-26 14:21:36.592+00',
  '2025-05-26 14:21:36.592+00',
  'paid'
);

-- Payment 5: 683e6a5a-cb02-4f9b-b867-881755c17414 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '683e6a5a-cb02-4f9b-b867-881755c17414',
  'b8dab0c3-3cfb-4c8b-8275-81df21745409',
  '2025-05-27',
  '2025-06-02',
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
  '2025-05-25 20:33:40.574+00',
  '2025-05-25 20:33:40.574+00',
  'paid'
);

-- Payment 6: fbb49223-d53f-4fde-a60a-cc8b7449ce09 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'fbb49223-d53f-4fde-a60a-cc8b7449ce09',
  '4e4b226a-1b31-4508-911f-732fa5aa1280',
  '2025-07-29',
  '2025-08-11',
  1080.00,
  '{
    "accommodation": 540.00,
    "food_facilities": 540.00,
    "accommodation_original": 540.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1080.00,
    "total_after_discounts": 1080.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-24 12:17:48.311+00',
  '2025-05-24 12:17:48.311+00',
  'paid'
);

-- Payment 7: 6dc17a1b-b781-4b11-ab1d-1168ef5ef09f (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '6dc17a1b-b781-4b11-ab1d-1168ef5ef09f',
  'b1ddf0c5-202c-4ba0-9234-f3558e791923',
  '2025-05-27',
  '2025-06-09',
  814.00,
  '{
    "accommodation": 290.00,
    "food_facilities": 524.00,
    "accommodation_original": 290.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 814.00,
    "total_after_discounts": 814.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-23 09:32:07.865+00',
  '2025-05-23 09:32:07.865+00',
  'paid'
);

-- Payment 8: dd3e3f8c-8148-4643-8d47-0a0b4bd2b38b (duration discount only)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  'dd3e3f8c-8148-4643-8d47-0a0b4bd2b38b',
  '43de1a3e-70c2-44e1-9fe3-61cbec8e3e1f',
  '2025-06-10',
  '2025-07-07',
  1760.00,
  '{
    "accommodation": 950.40,
    "food_facilities": 809.60,
    "accommodation_original": 1080.00,
    "duration_discount_percent": 0.13,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 2012.00,
    "total_after_discounts": 1760.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-23 01:38:16.923+00',
  '2025-05-23 01:38:16.923+00',
  'paid'
);

-- Payment 9: 499a7e1b-98a6-48ed-9429-c6c19b12be19 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '499a7e1b-98a6-48ed-9429-c6c19b12be19',
  '14b3b107-af57-49c4-8287-7a17fe52edd8',
  '2025-07-29',
  '2025-08-11',
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
  '2025-05-22 20:40:30.416+00',
  '2025-05-22 20:40:30.416+00',
  'paid'
);

-- Payment 10: 9681bd47-b118-4b2b-a63b-f82f22750ea5 (no discounts)
INSERT INTO public.payments (
  id, booking_id, user_id, start_date, end_date, amount_paid, breakdown_json, discount_code, payment_type, stripe_payment_id, created_at, updated_at, status
) VALUES (
  gen_random_uuid(),
  '9681bd47-b118-4b2b-a63b-f82f22750ea5',
  '52108acc-0f00-438a-b714-bc363f752082',
  '2025-07-29',
  '2025-08-11',
  1210.00,
  '{
    "accommodation": 730.00,
    "food_facilities": 480.00,
    "accommodation_original": 730.00,
    "duration_discount_percent": 0.00,
    "seasonal_discount_percent": 0.00,
    "discount_code": null,
    "discount_code_percent": null,
    "discount_code_applies_to": null,
    "discount_code_amount": 0.00,
    "credits_used": 0.00,
    "subtotal_before_discounts": 1210.00,
    "total_after_discounts": 1210.00
  }'::jsonb,
  null,
  'initial',
  null,
  '2025-05-22 16:27:11.198+00',
  '2025-05-22 16:27:11.198+00',
  'paid'
); 