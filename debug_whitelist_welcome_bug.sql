-- WHITELIST WELCOME MODAL BUG INVESTIGATION
-- Run this query in Supabase SQL Editor to confirm the hypothesis

-- 1. First, check if the problematic trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created_set_metadata'
  AND event_object_table = 'users'
  AND event_object_schema = 'auth';

-- 2. Check the function definition that's causing the issue
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'set_user_metadata'
  AND routine_schema = 'public';

-- 3. MAIN INVESTIGATION: Check whitelisted users and their metadata
WITH whitelist_users AS (
  SELECT 
    w.email,
    w.has_seen_welcome as whitelist_table_has_seen_welcome,
    w.has_created_account,
    w.last_login,
    w.created_at as whitelist_created_at
  FROM whitelist w
),
auth_users AS (
  SELECT 
    u.email,
    u.id as user_id,
    u.created_at as auth_user_created_at,
    u.last_sign_in_at,
    u.raw_user_meta_data,
    (u.raw_user_meta_data->>'has_seen_welcome')::boolean as metadata_has_seen_welcome,
    (u.raw_user_meta_data->>'is_whitelisted')::boolean as metadata_is_whitelisted,
    (u.raw_user_meta_data->>'has_completed_whitelist_signup')::boolean as metadata_has_completed_signup,
    u.raw_user_meta_data->>'application_status' as metadata_application_status
  FROM auth.users u
),
application_records AS (
  SELECT 
    u.email,
    COUNT(a.id) as application_count,
    MAX(a.created_at) as latest_application_date,
    MAX(a.status) as latest_application_status
  FROM auth.users u
  LEFT JOIN applications a ON u.id = a.user_id
  GROUP BY u.email
)
SELECT 
  w.email,
  -- Whitelist table info
  w.whitelist_table_has_seen_welcome,
  w.has_created_account,
  w.last_login,
  w.whitelist_created_at,
  
  -- Auth user metadata info  
  au.metadata_has_seen_welcome,
  au.metadata_is_whitelisted,
  au.metadata_has_completed_signup,
  au.metadata_application_status,
  au.auth_user_created_at,
  au.last_sign_in_at,
  
  -- Application records
  ar.application_count,
  ar.latest_application_date,
  ar.latest_application_status,
  
  -- BUG INDICATORS
  CASE 
    WHEN au.metadata_has_seen_welcome = false 
         AND ar.application_count > 0 
         AND au.last_sign_in_at > ar.latest_application_date 
    THEN '🚨 POTENTIAL BUG: User completed signup but has_seen_welcome is false after login'
    WHEN au.metadata_has_seen_welcome = false 
         AND ar.application_count > 0 
    THEN '⚠️  SUSPICIOUS: User has application but has_seen_welcome is false'
    WHEN au.metadata_has_seen_welcome = true 
         AND ar.application_count > 0 
    THEN '✅ NORMAL: User has application and has_seen_welcome is true'
    WHEN ar.application_count = 0
    THEN '📝 EXPECTED: User hasn\'t completed signup yet'
    ELSE '❓ OTHER'
  END as bug_analysis,
  
  -- Show the full metadata for debugging
  au.raw_user_meta_data as full_metadata

FROM whitelist_users w
LEFT JOIN auth_users au ON w.email = au.email  
LEFT JOIN application_records ar ON w.email = ar.email
ORDER BY 
  -- Show potential bugs first
  CASE 
    WHEN au.metadata_has_seen_welcome = false AND ar.application_count > 0 AND au.last_sign_in_at > ar.latest_application_date THEN 1
    WHEN au.metadata_has_seen_welcome = false AND ar.application_count > 0 THEN 2  
    ELSE 3
  END,
  au.last_sign_in_at DESC NULLS LAST;

-- 4. Summary statistics
SELECT 
  'SUMMARY STATS' as analysis_type,
  COUNT(*) as total_whitelisted_users,
  COUNT(CASE WHEN au.metadata_has_seen_welcome = false AND ar.application_count > 0 THEN 1 END) as users_with_potential_bug,
  COUNT(CASE WHEN au.metadata_has_seen_welcome = true AND ar.application_count > 0 THEN 1 END) as users_working_correctly,
  COUNT(CASE WHEN ar.application_count = 0 THEN 1 END) as users_not_completed_signup
FROM whitelist w
LEFT JOIN auth.users au ON w.email = au.email
LEFT JOIN (
  SELECT u.email, COUNT(a.id) as application_count
  FROM auth.users u 
  LEFT JOIN applications a ON u.id = a.user_id 
  GROUP BY u.email
) ar ON w.email = ar.email;

-- 5. Check if the get_user_app_entry_status_v2 function exists and works correctly
SELECT 
  'FUNCTION TEST' as test_type,
  email,
  get_user_app_entry_status_v2(u.id, u.email) as rpc_result
FROM auth.users u 
WHERE EXISTS (SELECT 1 FROM whitelist w WHERE w.email = u.email)
  AND EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id)
LIMIT 3; 