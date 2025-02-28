-- Create function to update application status when user is whitelisted
CREATE OR REPLACE FUNCTION update_application_on_whitelist()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE applications a
  SET status = 'approved'
  FROM auth.users u
  WHERE a.user_id = u.id
    AND u.email = NEW.email
    AND a.status = 'pending';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs after insert on whitelist
CREATE TRIGGER whitelist_application_update
AFTER INSERT ON whitelist
FOR EACH ROW
EXECUTE FUNCTION update_application_on_whitelist();

-- Update existing applications for already whitelisted users
UPDATE applications a
SET status = 'approved'
FROM auth.users u
WHERE a.user_id = u.id
  AND u.email IN (SELECT email FROM whitelist)
  AND a.status = 'pending';
