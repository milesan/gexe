-- Remove the trigger and function that clears tracking_status on booking cancellation
-- This gives admins full control over tracking_status values

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_update_tracking_status_on_booking_change ON bookings;

-- Drop the function
DROP FUNCTION IF EXISTS update_tracking_status_on_booking_change();

-- The trigger that sets tracking_status to 'booked' on new bookings remains active