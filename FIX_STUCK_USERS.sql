-- Fix Stuck Whitelisted Users
-- This script creates application records for whitelisted users who don't have them

-- First, let's see who we're about to fix
SELECT 
  u.email,
  u.id as user_id,
  u.created_at as user_created,
  u.raw_user_meta_data->>'has_completed_whitelist_signup' as completed_signup
FROM auth.users u
JOIN whitelist w ON w.email = u.email
LEFT JOIN applications a ON a.user_id = u.id
WHERE a.id IS NULL
ORDER BY u.created_at DESC;

-- Create application records for stuck users
-- We'll check for existing records first to avoid duplicates
INSERT INTO applications (user_id, data, status, created_at, updated_at)
SELECT 
  u.id,
  jsonb_build_object(
    'auto_created', true,
    'source', 'whitelist_fix',
    'created_by', 'system_repair',
    'original_whitelist_date', w.created_at,
    'fix_applied', NOW()
  ),
  'approved',
  NOW(),
  NOW()
FROM auth.users u
JOIN whitelist w ON w.email = u.email
WHERE NOT EXISTS (
  SELECT 1 
  FROM applications a 
  WHERE a.user_id = u.id
);

-- Verify the fix worked
SELECT 
  u.email,
  u.id as user_id,
  a.id as application_id,
  a.status,
  a.data
FROM auth.users u
JOIN whitelist w ON w.email = u.email
JOIN applications a ON a.user_id = u.id
WHERE a.data->>'source' = 'whitelist_fix'
ORDER BY a.created_at DESC;

-- Update user metadata to ensure they're marked correctly
UPDATE auth.users u
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data IS NULL THEN '{}'::jsonb
    ELSE raw_user_meta_data
  END || 
  jsonb_build_object(
    'has_completed_whitelist_signup', true,
    'has_applied', true,
    'application_status', 'approved',
    'is_whitelisted', true
  )
FROM whitelist w
WHERE u.email = w.email
  AND EXISTS (
    SELECT 1 
    FROM applications a 
    WHERE a.user_id = u.id
  );

-- Update whitelist table to mark accounts as created
UPDATE whitelist w
SET 
  has_created_account = true,
  account_created_at = COALESCE(account_created_at, u.created_at),
  updated_at = NOW()
FROM auth.users u
WHERE w.email = u.email;

-- Final check: Any whitelisted users still without applications?
SELECT COUNT(*) as still_stuck
FROM auth.users u
JOIN whitelist w ON w.email = u.email
LEFT JOIN applications a ON a.user_id = u.id
WHERE a.id IS NULL;