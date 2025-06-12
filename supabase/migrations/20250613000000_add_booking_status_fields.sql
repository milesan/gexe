-- Add new columns to bookings table for proper payment tracking
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS food_contribution numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_used integer DEFAULT 0;

-- Update status column to have more states
DO $$ 
BEGIN
  -- Check if the type already exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_new') THEN
    CREATE TYPE booking_status_new AS ENUM (
      'pending_payment',
      'payment_processing',
      'confirmed',
      'cancelled',
      'refunded',
      'completed'
    );
  END IF;
END $$;

-- Update existing bookings to have proper status
UPDATE bookings 
SET status = 'confirmed' 
WHERE status = 'active' OR status IS NULL;

-- If status column exists with old type, we need to update it
DO $$
BEGIN
  -- Check if status column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'status') THEN
    -- Alter the column type
    ALTER TABLE bookings 
    ALTER COLUMN status TYPE booking_status_new 
    USING (
      CASE 
        WHEN status = 'active' THEN 'confirmed'::booking_status_new
        WHEN status = 'cancelled' THEN 'cancelled'::booking_status_new
        ELSE 'confirmed'::booking_status_new
      END
    );
  ELSE
    -- Add the column if it doesn't exist
    ALTER TABLE bookings 
    ADD COLUMN status booking_status_new DEFAULT 'pending_payment';
  END IF;
END $$;

-- Create an index on payment_intent_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent_id ON bookings(payment_intent_id);

-- Create an index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Add a function to automatically cancel old pending bookings (older than 1 hour)
CREATE OR REPLACE FUNCTION cancel_expired_pending_bookings()
RETURNS void AS $$
BEGIN
  UPDATE bookings
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE 
    status = 'pending_payment'
    AND created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Create a function to deduct user credits
CREATE OR REPLACE FUNCTION deduct_user_credits(
  p_user_id UUID,
  p_credits_to_deduct INTEGER
)
RETURNS void AS $$
BEGIN
  -- Update user credits
  UPDATE profiles
  SET credits = credits - p_credits_to_deduct
  WHERE user_id = p_user_id
  AND credits >= p_credits_to_deduct;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits or user not found';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION deduct_user_credits TO service_role;
GRANT EXECUTE ON FUNCTION cancel_expired_pending_bookings TO service_role;