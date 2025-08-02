-- First drop the view since it depends on the column
DROP VIEW IF EXISTS application_details;

-- Now we can safely remove the reminder_email_sent column from applications table (if it was added)
ALTER TABLE applications 
DROP COLUMN IF EXISTS reminder_email_sent;

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
  u2.email as linked_user_email,
  -- Add latest booking check_in date and reminder_email_sent status
  (SELECT b.check_in 
   FROM bookings b 
   WHERE b.user_id = a.user_id 
   AND b.status != 'cancelled'
   ORDER BY b.check_in DESC
   LIMIT 1) as latest_booking_check_in,
  -- Add reminder_email_sent from the latest booking
  (SELECT b.reminder_email_sent 
   FROM bookings b 
   WHERE b.user_id = a.user_id 
   AND b.status != 'cancelled'
   ORDER BY b.check_in DESC
   LIMIT 1) as reminder_email_sent
FROM applications a
JOIN auth.users u ON a.user_id = u.id
LEFT JOIN profiles p ON a.user_id = p.id
LEFT JOIN linked_applications la ON a.id = la.primary_application_id
LEFT JOIN applications la2 ON a.linked_application_id = la2.id
LEFT JOIN auth.users u2 ON la2.user_id = u2.id;

-- Grant access to the updated view
GRANT SELECT ON application_details TO authenticated;

-- Remove reminder_email_sent from the toggle function and restore original
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

-- Create a function to toggle reminder_email_sent on bookings for a user
CREATE OR REPLACE FUNCTION toggle_booking_reminder_for_user(
  p_user_id UUID
) RETURNS void AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  -- Verify the user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Get the latest non-cancelled booking for the user
  SELECT id INTO v_booking_id
  FROM bookings
  WHERE user_id = p_user_id
  AND status != 'cancelled'
  ORDER BY check_in DESC
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'No active booking found for this user';
  END IF;

  -- Toggle the reminder_email_sent status
  UPDATE bookings
  SET reminder_email_sent = NOT COALESCE(reminder_email_sent, FALSE)
  WHERE id = v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;