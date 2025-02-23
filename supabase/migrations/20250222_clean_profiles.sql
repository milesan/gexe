-- First verify the backup exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles_backup'
  ) THEN
    RAISE EXCEPTION 'profiles_backup table does not exist. Please run the backup migration first.';
  END IF;
END $$;

-- Delete all profiles except Andre's
DELETE FROM profiles 
WHERE email != 'andre@thegarden.pt';

-- Log the count of remaining profiles
DO $$ 
DECLARE 
  profile_count integer;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  RAISE NOTICE 'Remaining profiles after deletion: %', profile_count;
END $$;
