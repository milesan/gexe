-- Remove duplicate user-creation trigger that conflicts with on_auth_user_created_set_metadata
-- This fixes the "Database error saving new user" issue caused by two BEFORE INSERT triggers
-- both trying to insert into public.profiles table

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE; 