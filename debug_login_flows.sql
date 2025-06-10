-- Debug Login Flows Script
-- This script analyzes the login flow for different user types

-- ============================================
-- 1. CURRENT STATE ANALYSIS
-- ============================================

-- Check whitelist entries
SELECT 
  '=== WHITELIST ENTRIES ===' as section;

SELECT 
  email,
  has_created_account,
  has_seen_welcome,
  account_created_at,
  has_booked,
  total_bookings,
  last_login
FROM whitelist
ORDER BY created_at DESC
LIMIT 10;

-- Check recent users and their metadata
SELECT 
  '=== RECENT USERS & METADATA ===' as section;

SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'has_applied' as has_applied,
  u.raw_user_meta_data->>'approved' as approved,
  u.raw_user_meta_data->>'application_status' as application_status,
  u.raw_user_meta_data->>'is_whitelisted' as is_whitelisted,
  u.raw_user_meta_data->>'has_seen_welcome' as has_seen_welcome
FROM auth.users u
ORDER BY u.created_at DESC
LIMIT 10;

-- Check applications
SELECT 
  '=== RECENT APPLICATIONS ===' as section;

SELECT 
  a.id,
  a.user_id,
  u.email,
  a.status,
  a.created_at,
  a.updated_at
FROM applications a
JOIN auth.users u ON a.user_id = u.id
ORDER BY a.created_at DESC
LIMIT 10;

-- ============================================
-- 2. TEST SCENARIOS
-- ============================================

-- Scenario 1: Check what happens for a whitelisted user
SELECT 
  '=== SCENARIO 1: WHITELISTED USER ===' as section;

-- Pick a whitelisted email
WITH whitelisted_user AS (
  SELECT email FROM whitelist LIMIT 1
)
SELECT 
  w.email,
  w.has_created_account,
  w.has_seen_welcome,
  u.id as user_id,
  u.raw_user_meta_data,
  EXISTS(SELECT 1 FROM applications WHERE user_id = u.id) as has_application
FROM whitelisted_user wu
JOIN whitelist w ON w.email = wu.email
LEFT JOIN auth.users u ON u.email = w.email;

-- Test the RPC function for a whitelisted user
WITH test_user AS (
  SELECT u.id, u.email 
  FROM auth.users u
  JOIN whitelist w ON w.email = u.email
  LIMIT 1
)
SELECT 
  tu.email,
  get_user_app_entry_status_v2(tu.id, tu.email) as rpc_result
FROM test_user tu;

-- Scenario 2: Check what happens for a new user (not in whitelist, no application)
SELECT 
  '=== SCENARIO 2: NEW USER (NON-WHITELISTED) ===' as section;

-- Find users without applications
WITH new_users AS (
  SELECT u.id, u.email, u.raw_user_meta_data
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM whitelist w WHERE w.email = u.email)
  LIMIT 5
)
SELECT 
  nu.email,
  nu.raw_user_meta_data->>'has_applied' as has_applied,
  nu.raw_user_meta_data->>'approved' as approved,
  get_user_app_entry_status_v2(nu.id, nu.email) as rpc_result
FROM new_users nu;

-- Scenario 3: Check existing users with applications
SELECT 
  '=== SCENARIO 3: EXISTING USERS WITH APPLICATIONS ===' as section;

WITH existing_users AS (
  SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data,
    a.status as application_status
  FROM auth.users u
  JOIN applications a ON a.user_id = u.id
  WHERE NOT EXISTS (SELECT 1 FROM whitelist w WHERE w.email = u.email)
  LIMIT 5
)
SELECT 
  eu.email,
  eu.application_status,
  eu.raw_user_meta_data->>'approved' as metadata_approved,
  eu.raw_user_meta_data->>'application_status' as metadata_app_status,
  get_user_app_entry_status_v2(eu.id, eu.email) as rpc_result
FROM existing_users eu;

-- ============================================
-- 3. EDGE CASES
-- ============================================

SELECT 
  '=== EDGE CASES ===' as section;

-- Check for whitelisted users without accounts
SELECT 
  'Whitelisted without account:' as case_type,
  email,
  has_created_account
FROM whitelist
WHERE has_created_account = false OR has_created_account IS NULL;

-- Check for users in both whitelist and with applications
SELECT 
  'Users in whitelist AND applications:' as case_type,
  w.email,
  u.id as user_id,
  a.id as application_id,
  a.status
FROM whitelist w
JOIN auth.users u ON u.email = w.email
JOIN applications a ON a.user_id = u.id;

-- Check for inconsistent metadata
SELECT 
  'Inconsistent metadata:' as case_type,
  u.email,
  u.raw_user_meta_data->>'approved' as metadata_approved,
  u.raw_user_meta_data->>'application_status' as metadata_status,
  a.status as actual_status
FROM auth.users u
JOIN applications a ON a.user_id = u.id
WHERE (u.raw_user_meta_data->>'application_status')::text != a.status
   OR (u.raw_user_meta_data->>'approved' = 'true' AND a.status != 'approved')
   OR (u.raw_user_meta_data->>'approved' != 'true' AND a.status = 'approved');

-- ============================================
-- 4. LOGIN FLOW PATHS
-- ============================================

SELECT 
  '=== LOGIN FLOW DECISION TREE ===' as section;

-- Simulate login flow decision for all user types
WITH user_analysis AS (
  SELECT 
    u.id,
    u.email,
    u.created_at,
    -- Whitelist status
    EXISTS(SELECT 1 FROM whitelist w WHERE w.email = u.email) as is_whitelisted,
    -- Application status
    EXISTS(SELECT 1 FROM applications a WHERE a.user_id = u.id) as has_application,
    a.status as application_status,
    -- Metadata
    u.raw_user_meta_data->>'has_applied' as metadata_has_applied,
    u.raw_user_meta_data->>'approved' as metadata_approved,
    u.raw_user_meta_data->>'application_status' as metadata_app_status,
    u.raw_user_meta_data->>'has_seen_welcome' as has_seen_welcome
  FROM auth.users u
  LEFT JOIN applications a ON a.user_id = u.id
)
SELECT 
  email,
  CASE 
    -- Admin check would happen first in the app
    WHEN metadata_approved = 'true' OR metadata_app_status = 'approved' THEN 'APPROVED_USER_FLOW'
    -- Whitelisted without application
    WHEN is_whitelisted AND NOT has_application THEN 'WHITELIST_SIGNUP_FLOW'
    -- Whitelisted with application and needs welcome
    WHEN is_whitelisted AND has_application AND (has_seen_welcome IS NULL OR has_seen_welcome = 'false') THEN 'SHOW_WELCOME_MODAL'
    -- New user (not whitelisted, no application)
    WHEN NOT is_whitelisted AND NOT has_application THEN 'APPLICATION_FLOW'
    -- Existing user with pending/rejected application
    WHEN NOT is_whitelisted AND has_application AND application_status != 'approved' THEN 'PENDING_PAGE'
    ELSE 'UNKNOWN_STATE'
  END as expected_flow,
  is_whitelisted,
  has_application,
  application_status,
  metadata_approved,
  has_seen_welcome
FROM user_analysis
ORDER BY created_at DESC
LIMIT 20;