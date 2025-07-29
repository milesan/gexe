-- Update the get_user_app_entry_status_v2 function to also show welcome modal to approved users
CREATE OR REPLACE FUNCTION public.get_user_app_entry_status_v2(p_user_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_metadata jsonb;
  v_is_whitelisted boolean;
  v_has_seen_welcome boolean;
  v_has_application_record boolean;
  v_is_approved boolean;
BEGIN
  -- Get user metadata
  SELECT raw_user_meta_data INTO v_user_metadata
  FROM auth.users
  WHERE id = p_user_id;

  -- Extract values from metadata
  v_is_whitelisted := COALESCE((v_user_metadata->>'is_whitelisted')::boolean, false);
  v_has_seen_welcome := COALESCE((v_user_metadata->>'has_seen_welcome')::boolean, false);
  
  -- Check if user is approved (either whitelisted or has approved status)
  v_is_approved := v_is_whitelisted OR 
    COALESCE((v_user_metadata->>'approved')::boolean, false) OR 
    (v_user_metadata->>'application_status') = 'approved';
  
  -- Check if user has application record
  v_has_application_record := EXISTS (
    SELECT 1 FROM applications
    WHERE user_id = p_user_id
  );

  -- Return combined status
  RETURN jsonb_build_object(
    'is_whitelisted', v_is_whitelisted,
    'needs_welcome', v_is_approved AND NOT v_has_seen_welcome, -- needs_welcome is true if approved (whitelisted OR approved status) but hasn't seen welcome
    'has_application_record', v_has_application_record
  );
END;
$$; 