-- Fix for "Database error saving new user" issue
-- This removes duplicate triggers and ensures clean auth user creation

-- 1. First, drop ALL auth user creation triggers to start fresh
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_set_metadata ON auth.users;

-- 2. Drop the old handle_new_user function if it still exists
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- 3. Ensure the set_user_metadata function is properly created
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
  
  -- Create profile entry for the new user
  BEGIN
    INSERT INTO public.profiles (id, email, credits)
    VALUES (NEW.id, NEW.email, 1000)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'Could not create profile for user %: %', NEW.email, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- 4. Create a single trigger for auth user creation
CREATE TRIGGER on_auth_user_created_set_metadata
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_metadata();

-- 5. Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_user_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_metadata TO anon;
GRANT EXECUTE ON FUNCTION set_user_metadata TO service_role;

-- 6. Verify the fix by checking for duplicate triggers
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE ns.nspname = 'auth' 
  AND c.relname = 'users'
  AND t.tgisinternal = FALSE
ORDER BY t.tgname;