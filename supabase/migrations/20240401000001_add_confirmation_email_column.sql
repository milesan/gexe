-- Add confirmation_email_sent column to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS confirmation_email_sent BOOLEAN DEFAULT FALSE;

-- Add an index for better query performance when checking email status
CREATE INDEX IF NOT EXISTS idx_bookings_email_sent ON bookings (confirmation_email_sent);

-- Add a comment to explain the purpose of the column
COMMENT ON COLUMN bookings.confirmation_email_sent IS 'Tracks whether a booking confirmation email has been sent to the user'; 