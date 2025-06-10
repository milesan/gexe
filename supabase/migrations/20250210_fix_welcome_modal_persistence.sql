-- Fix the set_user_metadata trigger to preserve user-set values
-- This addresses the root cause where the trigger hard-codes has_seen_welcome: false

-- Drop and recreate the function to preserve existing user metadata values
DROP FUNCTION IF EXISTS public.set_user_metadata() CASCADE;

CREATE OR REPLACE FUNCTION public.set_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set default app metadata (this part is fine)
  NEW.raw_app_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'provider', 'email',
    'providers', array['email']
  );
  
  -- Check whitelist first
  IF EXISTS (SELECT 1 FROM whitelist WHERE email = NEW.email) THEN
    -- FIXED: Merge with existing metadata instead of overwriting
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_whitelisted', true,
      'application_status', 'approved',
      'has_applied', true
      -- REMOVED: No longer hard-coding has_seen_welcome or has_completed_whitelist_signup
      -- These should be set by the application logic, not the trigger
    );
    
    -- Only set has_seen_welcome and has_completed_whitelist_signup if they don't already exist
    IF (NEW.raw_user_meta_data->>'has_seen_welcome') IS NULL THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data || jsonb_build_object('has_seen_welcome', false);
    END IF;
    
    IF (NEW.raw_user_meta_data->>'has_completed_whitelist_signup') IS NULL THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data || jsonb_build_object('has_completed_whitelist_signup', false);
    END IF;
    
    NEW.email_confirmed_at := now();
    
    -- Update whitelist record
    UPDATE whitelist
    SET 
      last_login = now(),
      has_created_account = true,
      account_created_at = COALESCE(account_created_at, now()),
      updated_at = now()
    WHERE email = NEW.email;
  ELSE
    -- Set default metadata for non-whitelisted users
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'has_applied', false,
      'application_status', null,
      'is_whitelisted', false
    );
  END IF;
  
  -- Special case for admin (preserve existing logic)
  IF NEW.email = 'andre@thegarden.pt' THEN
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_admin', true,
      'application_status', 'approved',
      'has_applied', true
    );
    NEW.email_confirmed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_set_metadata
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_metadata();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_user_metadata TO authenticated;


-- PROBLEM: ERROR:  42601: unterminated dollar-quoted string at or near "$$"
-- Also fix the check_whitelist_status function to preserve user-set values
-- Fix the check_whitelist_status function to preserve user-set values
CREATE OR REPLACE FUNCTION check_whitelist_status(p_email text)
RETURNS jsonb AS $func$
DECLARE
  v_whitelist_entry whitelist;
  v_current_metadata jsonb;
  v_has_seen_welcome boolean;
  v_has_completed_signup boolean;
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

  -- Get current user metadata to preserve important user-set values
  SELECT raw_user_meta_data INTO v_current_metadata
  FROM auth.users
  WHERE email = p_email;

  -- Preserve existing has_seen_welcome value (don't reset to false!)
  v_has_seen_welcome := COALESCE(
    (v_current_metadata->>'has_seen_welcome')::boolean,
    v_whitelist_entry.has_seen_welcome,
    false
  );
  
  -- Preserve existing has_completed_whitelist_signup value
  v_has_completed_signup := COALESCE(
    (v_current_metadata->>'has_completed_whitelist_signup')::boolean,
    false
  );

  -- Update whitelist table
  UPDATE whitelist
  SET 
    last_login = now(),
    has_created_account = true,
    account_created_at = COALESCE(account_created_at, now()),
    has_seen_welcome = v_has_seen_welcome, -- Sync with user metadata
    updated_at = now()
  WHERE id = v_whitelist_entry.id;

  -- Update user metadata, preserving existing values!
  UPDATE auth.users
  SET 
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
      'is_whitelisted', true,
      'has_seen_welcome', v_has_seen_welcome, -- PRESERVE existing value
      'has_completed_whitelist_signup', v_has_completed_signup, -- PRESERVE existing value
      'application_status', 'approved',
      'has_applied', true
    ),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE email = p_email;

  RETURN jsonb_build_object(
    'is_whitelisted', true,
    'has_seen_welcome', v_has_seen_welcome,
    'has_completed_whitelist_signup', v_has_completed_signup
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_whitelist_status TO authenticated;

-- Also fix any other problematic functions that might overwrite metadata
-- Update any existing users who lost their has_completed_whitelist_signup due to metadata overwrites
UPDATE auth.users u
SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
  'has_completed_whitelist_signup', 
  CASE 
    WHEN EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id) THEN true
    ELSE COALESCE((raw_user_meta_data->>'has_completed_whitelist_signup')::boolean, false)
  END
)
WHERE (raw_user_meta_data->>'is_whitelisted')::boolean = true
  AND EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id)
  AND (raw_user_meta_data->>'has_completed_whitelist_signup')::boolean IS DISTINCT FROM true; 