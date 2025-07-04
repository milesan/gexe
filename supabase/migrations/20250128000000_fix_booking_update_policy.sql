-- Add missing UPDATE policy for bookings to allow users to update their own bookings
-- This is needed for the booking extension functionality with credits

-- Check if the policy already exists and drop it if it does
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;

-- Create the UPDATE policy for bookings
CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant UPDATE permission on bookings to authenticated users
GRANT UPDATE ON bookings TO authenticated;

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Added UPDATE policy for bookings - users can now update their own bookings';
END $$; 