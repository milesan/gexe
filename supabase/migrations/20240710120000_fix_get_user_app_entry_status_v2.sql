CREATE OR REPLACE FUNCTION public.get_user_app_entry_status_v2(p_user_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_whitelisted boolean;
  v_has_seen_welcome boolean;
  v_has_application_record boolean;
BEGIN
  -- Log the input parameters
  RAISE NOTICE 'get_user_app_entry_status_v2 called for user_id: %, email: %', p_user_id, p_email;

  -- 1. Check if the user's email exists in the whitelist table
  SELECT EXISTS (
    SELECT 1 FROM public.whitelist wl WHERE wl.email = p_email
  )
  INTO v_is_whitelisted;

  -- 2. Check if the user has seen the welcome modal from the AUTH user metadata
  SELECT (raw_user_meta_data->>'has_seen_welcome')::boolean
  INTO v_has_seen_welcome
  FROM auth.users
  WHERE id = p_user_id;

  -- 3. Check for an existing application record
  SELECT EXISTS (
    SELECT 1 FROM public.applications app WHERE app.user_id = p_user_id
  )
  INTO v_has_application_record;

  -- Log the determined values before returning
  RAISE NOTICE 'get_user_app_entry_status_v2 determined: is_whitelisted=%, has_seen_welcome=%, has_application_record=%',
    v_is_whitelisted, v_has_seen_welcome, v_has_application_record;

  -- Construct the JSONB object to return
  RETURN jsonb_build_object(
    'is_whitelisted', COALESCE(v_is_whitelisted, false),
    -- "needs_welcome" is true if they are whitelisted AND have NOT seen the welcome yet
    'needs_welcome', COALESCE(v_is_whitelisted, false) AND NOT COALESCE(v_has_seen_welcome, false),
    'has_application_record', COALESCE(v_has_application_record, false)
  );
END;
$$; 