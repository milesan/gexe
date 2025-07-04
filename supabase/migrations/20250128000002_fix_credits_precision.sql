-- Fix credit precision issues
-- Issue: credits_used column and trigger function use integer instead of numeric, causing rounding errors

-- Step 1: Drop existing triggers and views that depend on credits_used column
DROP TRIGGER IF EXISTS booking_credits_update_trigger ON bookings;
DROP TRIGGER IF EXISTS booking_credits_trigger ON bookings;
DROP VIEW IF EXISTS bookings_with_emails CASCADE;

-- Step 2: Change bookings.credits_used column from integer to numeric(10,2)
ALTER TABLE bookings 
ALTER COLUMN credits_used TYPE numeric(10,2) USING credits_used::numeric(10,2);

-- Update the check constraint to work with decimal values
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_credits_used_check;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_credits_used_check CHECK (credits_used >= 0);

-- Step 3: Fix the extension credit deduction trigger function
DROP FUNCTION IF EXISTS handle_booking_credits_update();

CREATE OR REPLACE FUNCTION handle_booking_credits_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_credits numeric(10,2);
  v_new_balance numeric(10,2);
  v_additional_credits_used numeric(10,2); -- FIXED: Use numeric instead of integer
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

-- Recreate the trigger
CREATE TRIGGER booking_credits_update_trigger
AFTER UPDATE OF credits_used ON bookings
FOR EACH ROW
WHEN (COALESCE(NEW.credits_used, 0) > COALESCE(OLD.credits_used, 0))
EXECUTE FUNCTION handle_booking_credits_update();

-- Step 4: Also fix the original booking credits function for consistency
DROP FUNCTION IF EXISTS handle_booking_with_credits();

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

-- Step 5: Recreate the original booking credits trigger (dropped in step 1)
CREATE TRIGGER booking_credits_trigger
AFTER INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION handle_booking_with_credits();

-- Step 6: Recreate the bookings_with_emails view (dropped in step 1)
CREATE OR REPLACE VIEW bookings_with_emails AS
SELECT 
  b.*,
  u.email as user_email
FROM
  bookings b
  LEFT JOIN auth.users u ON b.user_id = u.id;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_booking_credits_update TO authenticated;
GRANT EXECUTE ON FUNCTION handle_booking_with_credits TO authenticated;
GRANT SELECT ON bookings_with_emails TO authenticated;

-- Add helpful comments
COMMENT ON TRIGGER booking_credits_update_trigger ON bookings IS 'Handles credit deduction when credits_used is increased during booking extensions (FIXED: uses numeric precision)';
COMMENT ON TRIGGER booking_credits_trigger ON bookings IS 'Handles credit deduction when booking is created (FIXED: uses numeric precision)';
COMMENT ON FUNCTION handle_booking_credits_update() IS 'Deducts credits from user balance when booking credits_used field is increased (for extensions) - FIXED: uses numeric(10,2) precision';
COMMENT ON FUNCTION handle_booking_with_credits() IS 'Deducts credits from user balance when booking is created (FIXED: uses numeric(10,2) precision)';
COMMENT ON VIEW bookings_with_emails IS 'View combining bookings with user emails and complete price breakdown (RECREATED: supports numeric credits_used)'; 