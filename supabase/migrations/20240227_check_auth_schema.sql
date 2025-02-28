-- Check auth.users table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
AND table_name = 'users'
ORDER BY ordinal_position;

-- Check if email_confirm is a valid parameter
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'create_user'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');

-- Check existing users with similar metadata structure
SELECT 
    id,
    email,
    raw_user_meta_data,
    raw_app_meta_data,
    email_confirmed_at,
    created_at
FROM auth.users
WHERE raw_user_meta_data ? 'is_whitelisted'
LIMIT 1;

-- Check if we can directly query the function parameters
SELECT * FROM pg_proc
WHERE proname = 'create_user'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');

-- Create function to verify and use whitelist token atomically
CREATE OR REPLACE FUNCTION public.verify_and_use_whitelist_token(
  p_token text,
  p_current_time timestamp with time zone
)
RETURNS TABLE (
  token_id uuid,
  whitelist_id uuid,
  email text,
  expires_at timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Lock the token row for update to prevent concurrent access
  SELECT 
    wt.id as token_id,
    wt.whitelist_id,
    w.email,
    wt.expires_at,
    wt.used_at
  INTO v_token_record
  FROM whitelist_tokens wt
  JOIN whitelist w ON w.id = wt.whitelist_id
  WHERE wt.token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  IF v_token_record.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Token has already been used';
  END IF;

  IF v_token_record.expires_at < p_current_time THEN
    RAISE EXCEPTION 'Token has expired';
  END IF;

  IF v_token_record.email IS NULL THEN
    RAISE EXCEPTION 'No email associated with this token';
  END IF;

  -- Mark token as used
  UPDATE whitelist_tokens
  SET used_at = p_current_time
  WHERE id = v_token_record.token_id;

  -- Update whitelist entry
  UPDATE whitelist
  SET has_created_account = true,
      created_account_at = p_current_time
  WHERE id = v_token_record.whitelist_id;

  -- Return the result as a single row
  RETURN QUERY
  SELECT 
    v_token_record.token_id,
    v_token_record.whitelist_id,
    v_token_record.email,
    v_token_record.expires_at;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.verify_and_use_whitelist_token TO authenticated, anon;
