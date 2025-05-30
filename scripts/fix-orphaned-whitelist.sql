-- Script to detect orphaned whitelist entries (whitelist entries without auth users)

-- First, let's see what we're dealing with
SELECT 
  w.id,
  w.email,
  w.has_created_account,
  w.account_created_at,
  w.user_id,
  CASE 
    WHEN au.id IS NOT NULL THEN 'Has Auth User'
    ELSE 'ORPHANED - No Auth User'
  END as status
FROM whitelist w
LEFT JOIN auth.users au ON w.user_id = au.id
ORDER BY w.created_at DESC;

-- Count orphaned entries
SELECT 
  COUNT(*) as total_whitelist_entries,
  COUNT(au.id) as entries_with_auth_users,
  COUNT(*) - COUNT(au.id) as orphaned_entries
FROM whitelist w
LEFT JOIN auth.users au ON w.user_id = au.id;

-- Show orphaned entries details
SELECT 
  w.id as whitelist_id,
  w.email,
  w.created_at as whitelisted_at,
  w.has_created_account,
  w.notes
FROM whitelist w
LEFT JOIN auth.users au ON w.user_id = au.id
WHERE au.id IS NULL
ORDER BY w.created_at DESC;

-- Optional: Reset orphaned entries to clean state
-- (Run this only if you want to reset the orphaned entries)
-- UPDATE whitelist 
-- SET 
--   has_created_account = false,
--   account_created_at = NULL,
--   user_id = NULL
-- WHERE id IN (
--   SELECT w.id 
--   FROM whitelist w
--   LEFT JOIN auth.users au ON w.user_id = au.id
--   WHERE au.id IS NULL AND w.user_id IS NOT NULL
-- ); 