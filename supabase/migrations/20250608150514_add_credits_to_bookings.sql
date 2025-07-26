-- Add credits_used column to bookings table (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'credits_used'
  ) THEN
    ALTER TABLE bookings
    ADD COLUMN credits_used numeric(10,2) DEFAULT 0 NOT NULL CHECK (credits_used >= 0);
  END IF;
END $$;

-- Create function to handle booking creation with credits
CREATE OR REPLACE FUNCTION handle_booking_with_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_user_credits numeric(10,2);
  v_new_balance numeric(10,2);
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
    
    -- Calculate new balance
    v_new_balance := v_user_credits - NEW.credits_used;
    
    -- Deduct credits from user profile
    UPDATE profiles
    SET credits = v_new_balance
    WHERE id = NEW.user_id;
    
    -- Record the credit transaction in the proper table
    INSERT INTO credit_transactions (
      user_id, 
      booking_id, 
      amount, 
      new_balance, 
      transaction_type, 
      notes
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      -NEW.credits_used, -- Negative amount for deduction
      v_new_balance,
      'booking_payment',
      'Credits used for booking ' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle credits on booking insert (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'booking_credits_trigger' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER booking_credits_trigger
    AFTER INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION handle_booking_with_credits();
  END IF;
END $$;

-- Create function to handle booking cancellation with credits
CREATE OR REPLACE FUNCTION handle_booking_cancellation_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_user_credits numeric(10,2);
  v_new_balance numeric(10,2);
BEGIN
  -- Only process if booking is being cancelled and had credits used
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' AND OLD.credits_used > 0 THEN
    -- Get current user credits
    SELECT credits INTO v_user_credits
    FROM profiles
    WHERE id = OLD.user_id
    FOR UPDATE;
    
    -- Calculate new balance
    v_new_balance := v_user_credits + OLD.credits_used;
    
    -- Refund credits to user
    UPDATE profiles
    SET credits = v_new_balance
    WHERE id = OLD.user_id;
    
    -- Record the credit refund in the proper table
    INSERT INTO credit_transactions (
      user_id, 
      booking_id, 
      amount, 
      new_balance, 
      transaction_type, 
      notes
    )
    VALUES (
      OLD.user_id,
      OLD.id,
      OLD.credits_used, -- Positive amount for refund
      v_new_balance,
      'booking_refund',
      'Booking cancellation credit refund for booking ' || OLD.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle credits on booking status update (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'booking_cancellation_credits_trigger' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER booking_cancellation_credits_trigger
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION handle_booking_cancellation_credits();
  END IF;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_booking_with_credits TO authenticated;
GRANT EXECUTE ON FUNCTION handle_booking_cancellation_credits TO authenticated;