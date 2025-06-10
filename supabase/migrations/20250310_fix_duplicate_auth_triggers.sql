-- Fix duplicate auth triggers causing "Database error saving new user"
-- This consolidates three separate triggers into one comprehensive trigger

-- Drop ALL existing triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_set_metadata ON auth.users;
DROP TRIGGER IF EXISTS trigger_link_whitelist_on_user_insert ON auth.users;

-- Drop obsolete functions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS link_whitelist_entry_to_new_user() CASCADE;

-- Create consolidated function that handles all auth user creation logic
CREATE OR REPLACE FUNCTION public.set_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set default app metadata
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'provider', 'email',
    'providers', array['email']
  );
  
  -- Check whitelist first
  IF EXISTS (SELECT 1 FROM whitelist WHERE email = NEW.email) THEN
    -- Merge with existing metadata instead of overwriting
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_whitelisted', true,
      'application_status', 'approved',
      'has_applied', true
    );
    
    -- Only set has_seen_welcome if not already set
    IF (NEW.raw_user_meta_data->>'has_seen_welcome') IS NULL THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data || jsonb_build_object('has_seen_welcome', false);
    END IF;
    
    IF (NEW.raw_user_meta_data->>'has_completed_whitelist_signup') IS NULL THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data || jsonb_build_object('has_completed_whitelist_signup', false);
    END IF;
    
    NEW.email_confirmed_at := now();
    
    -- Update whitelist record and link to new user
    UPDATE whitelist
    SET 
      last_login = now(),
      has_created_account = true,
      account_created_at = COALESCE(account_created_at, now()),
      user_id = NEW.id,
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
  
  -- Special case for admin
  IF NEW.email = 'andre@thegarden.pt' THEN
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_admin', true,
      'application_status', 'approved',
      'has_applied', true
    );
    NEW.email_confirmed_at := now();
  END IF;
  
  -- Create profile entry for ALL users
  INSERT INTO public.profiles (id, email, credits)
  VALUES (NEW.id, NEW.email, 1000)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in set_user_metadata for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create single consolidated trigger
CREATE TRIGGER on_auth_user_created_set_metadata
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_metadata();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_user_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_metadata TO anon;
GRANT EXECUTE ON FUNCTION set_user_metadata TO service_role;