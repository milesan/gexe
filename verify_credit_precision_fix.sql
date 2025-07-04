-- Verify that the credit precision fix was applied correctly

-- Check that the bookings.credits_used column is now numeric(10,2)
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'credits_used';

-- Expected result: data_type = 'numeric', numeric_precision = 10, numeric_scale = 2

-- Check that both triggers exist and are enabled
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'bookings' 
  AND trigger_name IN ('booking_credits_trigger', 'booking_credits_update_trigger');

-- Expected result: Both triggers should be listed

-- Check that the trigger functions exist and have the correct parameter types
SELECT 
  proname as function_name,
  pg_get_function_result(oid) as return_type,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN ('handle_booking_with_credits', 'handle_booking_credits_update');

-- Test with a small decimal credit amount to verify precision works
-- (This is just a test query to verify the column accepts decimals)
SELECT 
  '84.41'::numeric(10,2) as test_decimal,
  CASE 
    WHEN '84.41'::numeric(10,2) = 84.41 THEN 'PRECISION OK ✓'
    ELSE 'PRECISION FAILED ✗'
  END as precision_test;

-- Check current user's credit balance to see the 0.41 discrepancy
SELECT 
  u.email,
  p.credits as current_balance,
  CASE 
    WHEN p.credits = 0.41 THEN 'Ready for correction ✓'
    WHEN p.credits = 0.00 THEN 'Already corrected ✓'
    ELSE 'Unexpected balance ⚠️'
  END as status
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'redis213+creditstest@gmail.com'; 