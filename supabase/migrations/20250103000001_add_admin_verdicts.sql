-- Add admin verdicts column to applications table
ALTER TABLE applications ADD COLUMN admin_verdicts JSONB DEFAULT '{}'::jsonb;

-- Create function to update admin verdict
CREATE OR REPLACE FUNCTION update_admin_verdict(
  p_application_id UUID,
  p_verdict TEXT -- 'thumbs_up' or 'thumbs_down'
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

  -- Validate verdict value
  IF p_verdict NOT IN ('thumbs_up', 'thumbs_down') THEN
    RAISE EXCEPTION 'Invalid verdict. Must be thumbs_up or thumbs_down.';
  END IF;

  -- Update the admin verdicts
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

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION update_admin_verdict TO authenticated;

-- Update the application_details view to include admin verdicts
DROP VIEW IF EXISTS application_details;

CREATE VIEW application_details AS
SELECT
  a.id,
  a.user_id,
  a.data,
  a.status,
  a.created_at,
  a.updated_at,
  a.admin_verdicts,
  u.email as user_email,
  u.last_sign_in_at,
  u.raw_user_meta_data,
  la.linked_name,
  la.linked_email,
  la2.id as linked_application_id,
  u2.email as linked_user_email
FROM applications a
JOIN auth.users u ON a.user_id = u.id
LEFT JOIN linked_applications la ON a.id = la.primary_application_id
LEFT JOIN applications la2 ON a.linked_application_id = la2.id
LEFT JOIN auth.users u2 ON la2.user_id = u2.id;

-- Grant access to the updated view
GRANT SELECT ON application_details TO authenticated; 