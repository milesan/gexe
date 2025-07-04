-- Fix credit deduction for booking extensions
-- Issue: No trigger handles credit deduction when credits_used is updated on existing bookings

-- Drop existing trigger and function if they exist (from previous attempt with wrong transaction_type)
DROP TRIGGER IF EXISTS booking_credits_update_trigger ON bookings;
DROP FUNCTION IF EXISTS handle_booking_credits_update();

-- Create function to handle credit deduction when credits_used is updated
CREATE OR REPLACE FUNCTION handle_booking_credits_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_credits numeric(10,2);
  v_new_balance numeric(10,2);
  v_additional_credits_used integer;
BEGIN
  -- Only process if credits_used field has increased (extension with credits)
  v_additional_credits_used := COALESCE(NEW.credits_used, 0) - COALESCE(OLD.credits_used, 0);
  
  IF v_additional_credits_used > 0 THEN
    -- Get current user credits
    SELECT credits INTO v_user_credits
    FROM profiles
    WHERE id = NEW.user_id
    FOR UPDATE; -- Lock the row to prevent concurrent updates
    
    -- Check if user has enough credits
    IF v_user_credits < v_additional_credits_used THEN
      RAISE EXCEPTION 'Insufficient credits for booking extension. Available: %, Required: %', v_user_credits, v_additional_credits_used;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_user_credits - v_additional_credits_used;
    
    -- Deduct credits from user profile
    UPDATE profiles
    SET credits = v_new_balance
    WHERE id = NEW.user_id;
    
    -- Record the credit transaction
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
      -v_additional_credits_used, -- Negative amount for deduction
      v_new_balance,
      'booking_payment',
      'Credits used for booking extension ' || NEW.id || ' (additional: ' || v_additional_credits_used || ')'
    );
    
    -- Log for debugging
    RAISE NOTICE 'Credit deduction triggered for booking % - Additional credits: %, New balance: %', 
      NEW.id, v_additional_credits_used, v_new_balance;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle credits on booking update when credits_used changes
CREATE TRIGGER booking_credits_update_trigger
AFTER UPDATE OF credits_used ON bookings
FOR EACH ROW
WHEN (COALESCE(NEW.credits_used, 0) > COALESCE(OLD.credits_used, 0))
EXECUTE FUNCTION handle_booking_credits_update();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_booking_credits_update TO authenticated;

-- Add helpful comment
COMMENT ON TRIGGER booking_credits_update_trigger ON bookings IS 'Handles credit deduction when credits_used is increased during booking extensions';
COMMENT ON FUNCTION handle_booking_credits_update() IS 'Deducts credits from user balance when booking credits_used field is increased (for extensions)'; 