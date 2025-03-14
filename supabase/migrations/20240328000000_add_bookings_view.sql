-- Create a view for bookings with user emails
CREATE OR REPLACE VIEW bookings_with_emails AS
SELECT 
  b.*,
  u.email as user_email
FROM bookings b
JOIN auth.users u ON b.user_id = u.id;

-- Grant access to the view
GRANT SELECT ON bookings_with_emails TO authenticated; 