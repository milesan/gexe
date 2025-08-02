-- Fix tracking_status to be based on actual bookings
-- Reset tracking_status for all applications based on actual booking status

UPDATE applications a
SET tracking_status = CASE
  -- If they have a booking, mark as booked
  WHEN EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.user_id = a.user_id 
    AND b.status != 'cancelled'
  ) THEN 'booked'
  -- If approved but no booking, set to NULL (admin will fill out)
  WHEN a.status = 'approved' THEN NULL
  -- If rejected, mark as withdrawn
  WHEN a.status = 'rejected' THEN 'withdrawn'
  -- If pending, mark as new
  WHEN a.status = 'pending' THEN 'new'
  -- Default to NULL
  ELSE NULL
END;

-- Add a comment to explain the logic
COMMENT ON COLUMN applications.tracking_status IS 'Tracks the application workflow status. Set to "booked" if user has active booking, NULL if approved but not booked (admin fills), "withdrawn" if rejected, "new" if pending.';