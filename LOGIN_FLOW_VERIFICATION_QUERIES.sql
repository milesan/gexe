-- Login Flow Verification Queries
-- Run these to verify the current state and test hypotheses

-- ================================================
-- 1. VERIFY CURRENT DATA STRUCTURE
-- ================================================

-- Check if all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('whitelist', 'applications', 'profiles');

-- Check whitelist table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'whitelist' 
ORDER BY ordinal_position;

-- Check applications table structure  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'applications'
ORDER BY ordinal_position;

-- ================================================
-- 2. TEST WHITELISTED USER SCENARIOS
-- ================================================

-- Find whitelisted users without accounts
SELECT 
  w.email,
  w.has_created_account,
  w.has_seen_welcome,
  u.id as user_id,
  u.created_at as account_created_at
FROM whitelist w
LEFT JOIN auth.users u ON u.email = w.email
WHERE u.id IS NULL;

-- Find whitelisted users without application records (THE PROBLEM CASE)
SELECT 
  w.email,
  u.id as user_id,
  w.has_created_account,
  w.has_seen_welcome,
  a.id as application_id
FROM whitelist w
JOIN auth.users u ON u.email = w.email
LEFT JOIN applications a ON a.user_id = u.id
WHERE a.id IS NULL;

-- Test the RPC for a specific whitelisted user
-- Replace 'test@example.com' with an actual whitelisted email
WITH test_user AS (
  SELECT u.id, u.email, u.raw_user_meta_data
  FROM auth.users u
  WHERE u.email = 'test@example.com'
)
SELECT 
  tu.email,
  tu.raw_user_meta_data,
  get_user_app_entry_status_v2(tu.id, tu.email) as rpc_result,
  EXISTS(SELECT 1 FROM whitelist WHERE email = tu.email) as in_whitelist,
  EXISTS(SELECT 1 FROM applications WHERE user_id = tu.id) as has_application
FROM test_user tu;

-- ================================================
-- 3. TEST NEW USER SCENARIOS
-- ================================================

-- Find users who signed up but haven't applied
SELECT 
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'has_applied' as metadata_has_applied,
  u.raw_user_meta_data->>'application_status' as metadata_status,
  a.id as application_id
FROM auth.users u
LEFT JOIN applications a ON a.user_id = u.id
LEFT JOIN whitelist w ON w.email = u.email
WHERE a.id IS NULL 
  AND w.email IS NULL
  AND u.created_at > NOW() - INTERVAL '30 days'
LIMIT 10;

-- ================================================
-- 4. TEST EXISTING USER SCENARIOS  
-- ================================================

-- Check for metadata/table inconsistencies
SELECT 
  u.email,
  u.raw_user_meta_data->>'approved' as metadata_approved,
  u.raw_user_meta_data->>'application_status' as metadata_app_status,
  a.status as table_status,
  CASE 
    WHEN u.raw_user_meta_data->>'approved' = 'true' AND a.status != 'approved' THEN 'MISMATCH: metadata approved but table not'
    WHEN u.raw_user_meta_data->>'approved' != 'true' AND a.status = 'approved' THEN 'MISMATCH: table approved but metadata not'
    WHEN (u.raw_user_meta_data->>'application_status')::text != a.status THEN 'MISMATCH: status values differ'
    ELSE 'OK'
  END as consistency_check
FROM auth.users u
JOIN applications a ON a.user_id = u.id
WHERE (u.raw_user_meta_data->>'approved' = 'true' AND a.status != 'approved')
   OR (u.raw_user_meta_data->>'approved' != 'true' AND a.status = 'approved')
   OR ((u.raw_user_meta_data->>'application_status')::text != a.status);

-- ================================================
-- 5. EDGE CASES AND PROBLEMS
-- ================================================

-- Users in both whitelist AND applications (weird state)
SELECT 
  w.email,
  u.id as user_id,
  w.has_created_account as whitelist_has_account,
  w.has_seen_welcome as whitelist_has_seen_welcome,
  u.raw_user_meta_data->>'has_seen_welcome' as metadata_has_seen_welcome,
  a.status as application_status,
  u.raw_user_meta_data->>'approved' as metadata_approved
FROM whitelist w
JOIN auth.users u ON u.email = w.email
JOIN applications a ON a.user_id = u.id;

-- Check has_seen_welcome discrepancies
SELECT 
  w.email,
  w.has_seen_welcome as whitelist_value,
  u.raw_user_meta_data->>'has_seen_welcome' as metadata_value,
  CASE 
    WHEN w.has_seen_welcome::text != COALESCE(u.raw_user_meta_data->>'has_seen_welcome', 'false') 
    THEN 'MISMATCH'
    ELSE 'OK'
  END as consistency
FROM whitelist w
JOIN auth.users u ON u.email = w.email
WHERE w.has_seen_welcome::text != COALESCE(u.raw_user_meta_data->>'has_seen_welcome', 'false');

-- ================================================
-- 6. ROUTING DECISION SIMULATION
-- ================================================

-- Simulate what route each user would take
WITH user_routing AS (
  SELECT 
    u.id,
    u.email,
    u.created_at,
    -- Data from RPC
    EXISTS(SELECT 1 FROM whitelist w WHERE w.email = u.email) as is_whitelisted,
    EXISTS(SELECT 1 FROM applications a WHERE a.user_id = u.id) as has_application,
    COALESCE(a.status, 'none') as application_status,
    -- Metadata checks
    u.raw_user_meta_data->>'approved' = 'true' as metadata_approved,
    u.raw_user_meta_data->>'application_status' = 'approved' as metadata_status_approved,
    COALESCE(u.raw_user_meta_data->>'has_seen_welcome', 'false') = 'false' as needs_welcome
  FROM auth.users u
  LEFT JOIN applications a ON a.user_id = u.id
  WHERE u.created_at > NOW() - INTERVAL '7 days' -- Recent users only
)
SELECT 
  email,
  CASE 
    -- The actual routing logic from App.tsx
    WHEN metadata_approved OR metadata_status_approved THEN 'MAIN_APP (approved)'
    WHEN is_whitelisted AND NOT has_application THEN 'WHITELIST_SIGNUP (forced)'
    WHEN is_whitelisted AND has_application AND needs_welcome THEN 'MAIN_APP + WELCOME_MODAL'
    WHEN is_whitelisted AND has_application AND NOT needs_welcome THEN 'MAIN_APP'
    WHEN NOT is_whitelisted AND NOT has_application THEN 'RETRO2 (application form)'
    WHEN NOT is_whitelisted AND has_application AND application_status = 'pending' THEN 'PENDING_PAGE'
    WHEN NOT is_whitelisted AND has_application AND application_status = 'rejected' THEN 'PENDING_PAGE (rejected)'
    ELSE 'UNKNOWN_STATE'
  END as expected_route,
  is_whitelisted,
  has_application,
  application_status,
  needs_welcome
FROM user_routing
ORDER BY created_at DESC;

-- ================================================
-- 7. FIX SUGGESTIONS
-- ================================================

-- Find whitelisted users that need application records created
SELECT 
  'CREATE APPLICATION RECORD' as action_needed,
  w.email,
  u.id as user_id,
  'INSERT INTO applications (user_id, data, status) VALUES (''' || u.id || ''', ''{"auto_created": true}'', ''approved'');' as fix_sql
FROM whitelist w
JOIN auth.users u ON u.email = w.email
LEFT JOIN applications a ON a.user_id = u.id
WHERE a.id IS NULL;

-- Find inconsistent has_seen_welcome values
SELECT 
  'SYNC HAS_SEEN_WELCOME' as action_needed,
  w.email,
  'UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || ''{"has_seen_welcome": ' || w.has_seen_welcome || '}'' WHERE email = ''' || w.email || ''';' as fix_sql
FROM whitelist w
JOIN auth.users u ON u.email = w.email
WHERE w.has_seen_welcome::text != COALESCE(u.raw_user_meta_data->>'has_seen_welcome', 'false');