-- Update admin verdict function to handle verdict removal
CREATE OR REPLACE FUNCTION update_admin_verdict(
  p_application_id UUID,
  p_verdict TEXT -- 'thumbs_up', 'thumbs_down', or 'remove'
) RETURNS void AS $$
DECLARE
  admin_email TEXT;
BEGIN
  -- Get the current admin's email
  SELECT email INTO admin_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Verify the user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Handle verdict removal
  IF p_verdict = 'remove' THEN
    -- Remove the admin's verdict by updating the JSONB to exclude their email
    UPDATE applications
    SET 
      admin_verdicts = COALESCE(admin_verdicts, '{}'::jsonb) - admin_email,
      updated_at = now()
    WHERE id = p_application_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Application not found.';
    END IF;
    
    RETURN;
  END IF;

  -- Validate verdict value for non-removal cases
  IF p_verdict NOT IN ('thumbs_up', 'thumbs_down') THEN
    RAISE EXCEPTION 'Invalid verdict. Must be thumbs_up, thumbs_down, or remove.';
  END IF;

  -- Update the admin verdicts with the new verdict
  UPDATE applications
  SET 
    admin_verdicts = COALESCE(admin_verdicts, '{}'::jsonb) || jsonb_build_object(admin_email, p_verdict),
    updated_at = now()
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 