-- Add new columns for application tracking (keeping original status field unchanged)
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS approved_on TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subsidy BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS next_action TEXT,
ADD COLUMN IF NOT EXISTS on_sheet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update the approve_application function to set approved_on
CREATE OR REPLACE FUNCTION approve_application(p_application_id UUID)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_admin_email text;
BEGIN
  -- Get the admin's email from auth.jwt()
  v_admin_email := auth.jwt() ->> 'email';
  
  -- Get the user_id and email from the application
  SELECT a.user_id, u.email INTO v_user_id, v_email
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
    approved_on = now(), -- NEW: Set approval timestamp
    updated_at = now(),
    final_action = jsonb_build_object(
      'admin', v_admin_email,
      'action', 'approved',
      'timestamp', now()
    )
  WHERE id = p_application_id;

  -- Update user metadata WITHOUT resetting has_seen_welcome
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email']
    ),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
      'email_verified', true
    )
  WHERE id = v_user_id;

  -- Add to whitelist if not already there
  INSERT INTO whitelist (email, created_at, updated_at)
  VALUES (v_email, now(), now())
  ON CONFLICT (email) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the application_details view to include new fields
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
  a.final_action,
  a.tracking_status,
  a.approved_on,
  a.subsidy,
  a.next_action,
  a.on_sheet,
  a.notes,
  u.email as user_email,
  u.last_sign_in_at,
  u.raw_user_meta_data,
  p.credits,
  la.linked_name,
  la.linked_email,
  la2.id as linked_application_id,
  u2.email as linked_user_email
FROM applications a
JOIN auth.users u ON a.user_id = u.id
LEFT JOIN profiles p ON a.user_id = p.id
LEFT JOIN linked_applications la ON a.id = la.primary_application_id
LEFT JOIN applications la2 ON a.linked_application_id = la2.id
LEFT JOIN auth.users u2 ON la2.user_id = u2.id;

-- Grant access to the updated view
GRANT SELECT ON application_details TO authenticated;

-- Create function to update application tracking fields (for inline editing)
CREATE OR REPLACE FUNCTION update_application_tracking_field(
  p_application_id UUID,
  p_field TEXT,
  p_value TEXT
) RETURNS void AS $$
BEGIN
  -- Verify the user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Update based on field name
  CASE p_field
    WHEN 'tracking_status' THEN
      UPDATE applications 
      SET tracking_status = p_value, updated_at = CURRENT_TIMESTAMP 
      WHERE id = p_application_id;
    WHEN 'next_action' THEN
      UPDATE applications 
      SET next_action = p_value, updated_at = CURRENT_TIMESTAMP 
      WHERE id = p_application_id;
    WHEN 'notes' THEN
      UPDATE applications 
      SET notes = p_value, updated_at = CURRENT_TIMESTAMP 
      WHERE id = p_application_id;
    ELSE
      RAISE EXCEPTION 'Invalid field name';
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to toggle boolean tracking fields
CREATE OR REPLACE FUNCTION toggle_application_tracking_field(
  p_application_id UUID,
  p_field TEXT
) RETURNS void AS $$
BEGIN
  -- Verify the user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Toggle based on field name
  CASE p_field
    WHEN 'subsidy' THEN
      UPDATE applications 
      SET subsidy = NOT COALESCE(subsidy, FALSE), updated_at = CURRENT_TIMESTAMP 
      WHERE id = p_application_id;
    WHEN 'on_sheet' THEN
      UPDATE applications 
      SET on_sheet = NOT COALESCE(on_sheet, FALSE), updated_at = CURRENT_TIMESTAMP 
      WHERE id = p_application_id;
    ELSE
      RAISE EXCEPTION 'Invalid field name';
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_application_tracking_field TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_application_tracking_field TO authenticated;

-- Set initial tracking_status based on existing status
UPDATE applications
SET tracking_status = CASE
  WHEN status = 'approved' THEN 'booked'
  WHEN status = 'rejected' THEN 'withdrawn'
  WHEN status = 'pending' THEN 'new'
  ELSE 'new'
END
WHERE tracking_status IS NULL OR tracking_status = 'new';