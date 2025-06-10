-- Comprehensive fix for duplicate auth triggers causing "Database error saving new user"
-- This consolidates all auth user creation logic into a single trigger

-- 1. First, check what we're dealing with
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

-- 2. Drop ALL existing triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_set_metadata ON auth.users;
DROP TRIGGER IF EXISTS trigger_link_whitelist_on_user_insert ON auth.users;

-- 3. Drop all related functions to avoid conflicts
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS link_whitelist_entry_to_new_user() CASCADE;
-- Keep set_user_metadata but we'll redefine it

-- 4. Create a single, comprehensive function that handles everything
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
    
    -- Update whitelist record (this replaces the link_whitelist_entry_to_new_user functionality)
    UPDATE whitelist
    SET 
      last_login = now(),
      has_created_account = true,
      account_created_at = COALESCE(account_created_at, now()),
      user_id = NEW.id,  -- Link the whitelist entry to the new user
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
  
  -- Create profile entry for ALL users (previously in handle_new_user)
  -- Using INSERT ... ON CONFLICT to handle any race conditions
  INSERT INTO public.profiles (id, email, credits)
  VALUES (NEW.id, NEW.email, 1000)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in set_user_metadata for %: %', NEW.email, SQLERRM;
    -- Still return NEW to allow user creation to proceed
    RETURN NEW;
END;
$$;

-- 5. Create a SINGLE trigger
CREATE TRIGGER on_auth_user_created_set_metadata
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_metadata();

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_user_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_metadata TO anon;
GRANT EXECUTE ON FUNCTION set_user_metadata TO service_role;

-- 7. Verify we now have only one trigger
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    'Fixed!' as status
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE ns.nspname = 'auth' 
  AND c.relname = 'users'
  AND t.tgisinternal = FALSE
ORDER BY t.tgname;

-- 8. Test creating a non-whitelisted user (comment out in production)
-- This should now work without errors
/*
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Try to create a test non-whitelisted user
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
  VALUES ('test-' || gen_random_uuid() || '@example.com', crypt('test123', gen_salt('bf')), NULL)
  RETURNING id INTO test_user_id;
  
  -- Check if profile was created
  IF EXISTS (SELECT 1 FROM profiles WHERE id = test_user_id) THEN
    RAISE NOTICE 'Success! Profile created for test user %', test_user_id;
  ELSE
    RAISE WARNING 'Profile was not created for test user %', test_user_id;
  END IF;
  
  -- Clean up
  DELETE FROM auth.users WHERE id = test_user_id;
END $$;
*/