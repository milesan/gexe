-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created_set_metadata ON auth.users;
DROP FUNCTION IF EXISTS set_user_metadata() CASCADE;

-- Create updated function to handle whitelisting
CREATE OR REPLACE FUNCTION public.set_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set default app metadata
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'email',
    'providers', array['email']
  );
  
  -- Check whitelist first
  IF EXISTS (SELECT 1 FROM whitelist WHERE email = NEW.email) THEN
    -- Set metadata for whitelisted users
    NEW.raw_user_meta_data := jsonb_build_object(
      'is_whitelisted', true,
      'has_seen_welcome', false,
      'application_status', 'approved',
      'has_applied', true
    );
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
    NEW.raw_user_meta_data := jsonb_build_object(
      'has_applied', false,
      'application_status', null,
      'is_whitelisted', false
    );
  END IF;
  
  -- Special case for admin
  IF NEW.email = 'andre@thegarden.pt' THEN
    NEW.raw_user_meta_data := jsonb_build_object(
      'is_admin', true,
      'application_status', 'approved',
      'has_applied', true
    );
    NEW.email_confirmed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that runs BEFORE insert
CREATE TRIGGER on_auth_user_created_set_metadata
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_metadata();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_user_metadata TO authenticated;
