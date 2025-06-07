-- Check if the trigger exists and what it does
SELECT trigger_name, event_manipulation, action_timing, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check the current function definition
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- Alternative way to see the function source
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Check all triggers on auth.users table
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';

-- Check recent profiles and their credit amounts
SELECT id, email, credits, created_at 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if there are any other functions that might be adding credits
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_definition ILIKE '%credits%' 
AND routine_definition ILIKE '%1000%';

-- Check for any other triggers that might be affecting profiles
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'profiles'; 