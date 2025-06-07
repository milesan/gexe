-- Stop the credit fairy: Change automatic credit allocation from 1000 to 0
-- Because apparently we were running a charity for random internet strangers

-- Drop and recreate the handle_new_user function with 0 credits
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile with 0 credits (no more free money!)
  -- Keep it simple - just stop the credit fairy
  BEGIN
    INSERT INTO public.profiles (id, email, credits)
    VALUES (NEW.id, NEW.email, 0)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'Could not create profile: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (keeping it as AFTER INSERT to match current setup)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Clean up the orphaned credit fairy functions
-- (Seriously, what was that migration spree about?)
DROP FUNCTION IF EXISTS create_profile() CASCADE;
DROP FUNCTION IF EXISTS create_profile_for_user() CASCADE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user TO authenticated; 