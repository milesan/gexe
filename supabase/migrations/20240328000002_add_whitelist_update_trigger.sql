-- Create a function to update user metadata when they get whitelisted
CREATE OR REPLACE FUNCTION auth.update_user_whitelist_status()
RETURNS trigger AS $$
BEGIN
  -- Check if user exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email) THEN
    -- Update the user's metadata to set is_whitelisted = true
    UPDATE auth.users
    SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN 
          jsonb_build_object('is_whitelisted', true)
        ELSE
          raw_user_meta_data || jsonb_build_object('is_whitelisted', true)
      END
    WHERE email = NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run when a new whitelist entry is added
DROP TRIGGER IF EXISTS on_whitelist_insert ON public.whitelist;
CREATE TRIGGER on_whitelist_insert
  AFTER INSERT ON public.whitelist
  FOR EACH ROW
  EXECUTE FUNCTION auth.update_user_whitelist_status();
