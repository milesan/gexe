-- Create trigger to automatically update tracking_status when a booking is created
CREATE OR REPLACE FUNCTION update_tracking_status_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the tracking_status to 'booked' for the user's application
  UPDATE applications
  SET 
    tracking_status = 'booked',
    updated_at = NOW()
  WHERE user_id = NEW.user_id
  AND status = 'approved'  -- Only update approved applications
  AND (tracking_status IS NULL OR tracking_status != 'booked');  -- Only update if not already 'booked'
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_update_tracking_status_on_booking ON bookings;
CREATE TRIGGER trigger_update_tracking_status_on_booking
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_tracking_status_on_booking();


-- Update existing applications that have bookings but tracking_status is not 'booked'
UPDATE applications a
SET 
  tracking_status = 'booked',
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 
  FROM bookings b 
  WHERE b.user_id = a.user_id 
  AND b.status != 'cancelled'
)
AND a.status = 'approved'
AND (a.tracking_status IS NULL OR a.tracking_status != 'booked');