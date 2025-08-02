-- Update the application_details view to include new tracking fields
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