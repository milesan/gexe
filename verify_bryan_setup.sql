-- Verification script to check Bryan's setup
-- Run this after the main script to verify everything is working

-- Check user creation
SELECT 'USER CHECK' as check_type, id, email, email_confirmed_at, raw_user_meta_data 
FROM auth.users 
WHERE email = 'redis213+bryanjeffsart@gmail.com';

-- Check application creation  
SELECT 'APPLICATION CHECK' as check_type, a.id, a.status, a.created_at, u.email
FROM applications a
JOIN auth.users u ON a.user_id = u.id
WHERE u.email = 'redis213+bryanjeffsart@gmail.com';

-- Check acceptance token
SELECT 'TOKEN CHECK' as check_type, token, application_id, expires_at, used_at
FROM acceptance_tokens
WHERE token = '..';

-- Test the RPC function
SELECT 'RPC TEST' as test_type, *
FROM get_application_token_data('..');

-- Check profile
SELECT 'PROFILE CHECK' as check_type, id, email, first_name, last_name
FROM profiles
WHERE email = 'redis213+bryanjeffsart@gmail.com'; 