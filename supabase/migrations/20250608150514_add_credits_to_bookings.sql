-- Add credits_used column to bookings table
ALTER TABLE bookings
ADD COLUMN credits_used integer DEFAULT 0 NOT NULL CHECK (credits_used >= 0);

-- Create function to handle booking creation with credits
CREATE OR REPLACE FUNCTION handle_booking_with_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_user_credits integer;
BEGIN
  -- Only process if credits were used
  IF NEW.credits_used > 0 THEN
    -- Get current user credits
    SELECT credits INTO v_user_credits
    FROM profiles
    WHERE id = NEW.user_id
    FOR UPDATE; -- Lock the row to prevent concurrent updates
    
    -- Check if user has enough credits
    IF v_user_credits < NEW.credits_used THEN
      RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', v_user_credits, NEW.credits_used;
    END IF;
    
    -- Deduct credits from user profile
    UPDATE profiles
    SET credits = credits - NEW.credits_used
    WHERE id = NEW.user_id;
    
    -- Record the credit transaction
    INSERT INTO credits (user_id, amount, description, booking_id)
    VALUES (
      NEW.user_id,
      -NEW.credits_used, -- Negative amount for deduction
      'Booking payment with credits',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle credits on booking insert
CREATE TRIGGER booking_credits_trigger
AFTER INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION handle_booking_with_credits();

-- Create function to handle booking cancellation with credits
CREATE OR REPLACE FUNCTION handle_booking_cancellation_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if booking is being cancelled and had credits used
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' AND OLD.credits_used > 0 THEN
    -- Refund credits to user
    UPDATE profiles
    SET credits = credits + OLD.credits_used
    WHERE id = OLD.user_id;
    
    -- Record the credit refund
    INSERT INTO credits (user_id, amount, description, booking_id)
    VALUES (
      OLD.user_id,
      OLD.credits_used, -- Positive amount for refund
      'Booking cancellation credit refund',
      OLD.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle credits on booking status update
CREATE TRIGGER booking_cancellation_credits_trigger
AFTER UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION handle_booking_cancellation_credits();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_booking_with_credits TO authenticated;
GRANT EXECUTE ON FUNCTION handle_booking_cancellation_credits TO authenticated;