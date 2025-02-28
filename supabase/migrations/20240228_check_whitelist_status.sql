-- Function to update user's whitelist status in metadata
CREATE OR REPLACE FUNCTION update_user_whitelist_status(user_id uuid)
RETURNS void AS $$
DECLARE
  is_in_whitelist boolean;
  user_record RECORD;
BEGIN
  -- Get the user record
  SELECT * FROM auth.users
  WHERE id = user_id
  INTO user_record;

  -- Check if the user's email is in the whitelist
  SELECT EXISTS (
    SELECT 1 FROM whitelist w
    WHERE w.email = user_record.email
  ) INTO is_in_whitelist;

  -- If user is whitelisted but metadata doesn't reflect this, update it
  IF is_in_whitelist AND 
     (user_record.raw_user_meta_data->>'is_whitelisted' IS NULL OR 
      user_record.raw_user_meta_data->>'is_whitelisted' = 'false') THEN
    
    -- Update user metadata to include whitelisted status
    UPDATE auth.users
    SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN 
          jsonb_build_object('is_whitelisted', true)
        ELSE
          raw_user_meta_data || jsonb_build_object('is_whitelisted', true)
      END
    WHERE id = user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for trigger to call
CREATE OR REPLACE FUNCTION check_whitelist_status_trigger()
RETURNS trigger AS $$
BEGIN
  PERFORM update_user_whitelist_status(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function that can be called directly to check whitelist status
CREATE OR REPLACE FUNCTION get_whitelist_status()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM whitelist w
    WHERE w.email = auth.email()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to run this check whenever a user authenticates
DROP TRIGGER IF EXISTS check_whitelist_on_auth ON auth.users;
CREATE TRIGGER check_whitelist_on_auth
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION check_whitelist_status_trigger();

-- Update all existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    PERFORM update_user_whitelist_status(user_record.id);
  END LOOP;
END $$;
