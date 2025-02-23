-- Add name columns to profiles table
ALTER TABLE profiles 
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Ensure profiles.id references auth.users.id
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
