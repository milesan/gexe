-- DEBUG AND FIX HELPER FOR WHITELIST WELCOME MODAL BUG
-- Run this in Supabase SQL Editor to check and fix a specific user

-- 1. Check a specific user's current status
-- Replace 'your-email@example.com' with the actual email you're testing
WITH user_debug AS (
  SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data,
    (u.raw_user_meta_data->>'has_seen_welcome')::boolean as has_seen_welcome,
    (u.raw_user_meta_data->>'has_completed_whitelist_signup')::boolean as has_completed_signup,
    (u.raw_user_meta_data->>'is_whitelisted')::boolean as is_whitelisted,
    EXISTS(SELECT 1 FROM applications a WHERE a.user_id = u.id) as has_application_record,
    -- Check what the RPC would return
    (SELECT get_user_app_entry_status_v2(u.id, u.email)) as rpc_result
  FROM auth.users u 
  WHERE u.email = 'your-email@example.com'  -- REPLACE THIS EMAIL
)
SELECT 
  email,
  has_seen_welcome,
  has_completed_signup,
  is_whitelisted,
  has_application_record,
  rpc_result,
  -- Diagnosis
  CASE 
    WHEN NOT is_whitelisted THEN '❌ User is not whitelisted'
    WHEN NOT has_application_record THEN '❌ User has no application record (needs to complete signup)'
    WHEN has_seen_welcome = false THEN '❌ has_seen_welcome is false (will show modal)'
    WHEN has_completed_signup = false THEN '⚠️ has_completed_whitelist_signup is false (shouldn''t matter for modal)'
    ELSE '✅ All metadata looks correct (modal should NOT show)'
  END as diagnosis,
  raw_user_meta_data
FROM user_debug;

-- 2. FIX FUNCTION: Run this to manually fix a user's metadata
-- (Uncomment the function below and run it, then call it with the user's email)

/*
CREATE OR REPLACE FUNCTION fix_user_metadata(p_email text)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_has_application boolean;
  v_updated_metadata jsonb;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;
  
  -- Check if user has application record
  v_has_application := EXISTS(SELECT 1 FROM applications WHERE user_id = v_user_id);
  
  -- Fix the metadata
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'has_seen_welcome', true,  -- Set to true to prevent modal from showing
    'has_completed_whitelist_signup', v_has_application  -- Set based on actual application record
  )
  WHERE id = v_user_id;
  
  -- Get updated metadata
  SELECT raw_user_meta_data INTO v_updated_metadata
  FROM auth.users
  WHERE id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'has_application_record', v_has_application,
    'updated_metadata', v_updated_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fix_user_metadata TO authenticated;
*/

-- 3. To use the fix function, uncomment the above function, then run:
-- SELECT fix_user_metadata('your-email@example.com');

-- 4. After running the fix, check the user again with the first query to confirm it worked 