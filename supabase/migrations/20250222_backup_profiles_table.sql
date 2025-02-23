-- Create a backup of the profiles table
CREATE TABLE profiles_backup AS 
SELECT * FROM profiles;

-- Add the same foreign key constraint to maintain referential integrity
ALTER TABLE profiles_backup
ADD CONSTRAINT profiles_backup_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Add comment to indicate this is a backup
COMMENT ON TABLE profiles_backup IS 'Backup of profiles table created on 2025-02-22';
