-- Safely fix approve_application to update user metadata with application_status
-- This version explicitly preserves all existing metadata
CREATE OR REPLACE FUNCTION approve_application(p_application_id UUID)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_admin_email text;
  v_current_user_metadata jsonb;
BEGIN
  -- Get the admin's email from auth.jwt()
  v_admin_email := auth.jwt() ->> 'email';
  
  -- Get the user_id, email, and current metadata from the application
  SELECT a.user_id, u.email, u.raw_user_meta_data 
  INTO v_user_id, v_email, v_current_user_metadata
  FROM applications a
  JOIN auth.users u ON a.user_id = u.id
  WHERE a.id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Update application status and record who approved it
  UPDATE applications
  SET 
    status = 'approved',
    approved_on = now(),
    updated_at = now(),
    final_action = jsonb_build_object(
      'admin', v_admin_email,
      'action', 'approved',
      'timestamp', now()
    )
  WHERE id = p_application_id;

  -- Update user metadata - preserving ALL existing fields and adding new ones
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email']
    ),
    raw_user_meta_data = COALESCE(v_current_user_metadata, '{}'::jsonb) || jsonb_build_object(
      'email_verified', true,
      'application_status', 'approved',
      'has_applied', true,
      'is_whitelisted', true
    )
  WHERE id = v_user_id;

  -- Add to whitelist if not already there
  INSERT INTO whitelist (email, created_at, updated_at)
  VALUES (v_email, now(), now())
  ON CONFLICT (email) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;