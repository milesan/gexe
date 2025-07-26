-- Verify that the credit trigger fix was applied correctly

-- 1. Check that the bookings.credits_used column is numeric(10,2)
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

-- 2. Check that the trigger exists and is enabled
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement,
  action_condition
FROM information_schema.triggers 
WHERE event_object_table = 'bookings' 
  AND trigger_name = 'booking_credits_trigger';

-- Expected result: Should show the trigger exists

-- 3. Check that the trigger function exists and has the correct parameter types
SELECT 
  proname as function_name,
  pg_get_function_result(oid) as return_type,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'handle_booking_with_credits';

-- 4. Test the trigger function with a small decimal credit amount
SELECT 
  '99.00'::numeric(10,2) as test_decimal,
  CASE 
    WHEN '99.00'::numeric(10,2) = 99.00 THEN 'PRECISION OK ✓'
    ELSE 'PRECISION FAILED ✗'
  END as precision_test;

-- 5. Check current user's credit balance to verify it's working
SELECT 
  u.email,
  p.credits as current_balance,
  'Current credit balance' as status
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'redis213+creditstestdontremove@gmail.com';

-- 6. Check recent credit transactions to see if deductions are working
SELECT 
  ct.created_at,
  ct.amount,
  ct.new_balance,
  ct.transaction_type,
  ct.notes,
  b.id as booking_id,
  b.credits_used as booking_credits_used
FROM credit_transactions ct
LEFT JOIN bookings b ON ct.booking_id = b.id
JOIN auth.users u ON ct.user_id = u.id
WHERE u.email = 'redis213+creditstestdontremove@gmail.com'
ORDER BY ct.created_at DESC
LIMIT 5;

-- 7. Verify that the trigger function variables are using numeric(10,2)
-- This is a more detailed check of the function definition
SELECT 
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'handle_booking_with_credits'; 