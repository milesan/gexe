-- Fix check_whitelist_status to preserve has_seen_welcome value
CREATE OR REPLACE FUNCTION check_whitelist_status(p_email text)
RETURNS jsonb AS $$
DECLARE
  v_whitelist_entry whitelist;
  v_current_metadata jsonb;
  v_has_seen_welcome boolean;
BEGIN
  -- Get whitelist entry
  SELECT * INTO v_whitelist_entry
  FROM whitelist
  WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_whitelisted', false
    );
  END IF;

  -- Get current user metadata to preserve has_seen_welcome
  SELECT raw_user_meta_data INTO v_current_metadata
  FROM auth.users
  WHERE email = p_email;

  -- Get current has_seen_welcome value, defaulting to false if not set
  v_has_seen_welcome := COALESCE(
    (v_current_metadata->>'has_seen_welcome')::boolean,
    v_whitelist_entry.has_seen_welcome,
    false
  );

  -- Update last login and account status
  UPDATE whitelist
  SET 
    last_login = now(),
    has_created_account = true,
    account_created_at = COALESCE(account_created_at, now()),
    has_seen_welcome = v_has_seen_welcome, -- Sync whitelist table with user metadata
    updated_at = now()
  WHERE id = v_whitelist_entry.id;

  -- Update user metadata, preserving existing values where appropriate
  UPDATE auth.users
  SET 
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
      'is_whitelisted', true,
      'has_seen_welcome', v_has_seen_welcome, -- Preserve the existing value!
      'application_status', 'approved',
      'has_applied', true
    ),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE email = p_email;

  RETURN jsonb_build_object(
    'is_whitelisted', true,
    'has_seen_welcome', v_has_seen_welcome
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create/update the get_user_app_entry_status_v2 function if it doesn't exist
-- This function should read from user metadata, not the whitelist table
CREATE OR REPLACE FUNCTION get_user_app_entry_status_v2(p_user_id uuid, p_email text)
RETURNS jsonb AS $$
DECLARE
  v_user_metadata jsonb;
  v_is_whitelisted boolean;
  v_has_seen_welcome boolean;
  v_has_application_record boolean;
BEGIN
  -- Get user metadata
  SELECT raw_user_meta_data INTO v_user_metadata
  FROM auth.users
  WHERE id = p_user_id;

  -- Extract values from metadata
  v_is_whitelisted := COALESCE((v_user_metadata->>'is_whitelisted')::boolean, false);
  v_has_seen_welcome := COALESCE((v_user_metadata->>'has_seen_welcome')::boolean, false);
  
  -- Check if user has application record
  v_has_application_record := EXISTS (
    SELECT 1 FROM applications
    WHERE user_id = p_user_id
  );

  -- Return combined status
  RETURN jsonb_build_object(
    'is_whitelisted', v_is_whitelisted,
    'needs_welcome', v_is_whitelisted AND NOT v_has_seen_welcome, -- needs_welcome is true if whitelisted but hasn't seen welcome
    'has_application_record', v_has_application_record
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_app_entry_status_v2 TO authenticated;