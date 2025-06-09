-- Migration to fix credits system to use decimal for proper monetary values
-- Convert credits from integer to decimal(10,2)

-- First, alter the profiles table
ALTER TABLE profiles 
ALTER COLUMN credits TYPE DECIMAL(10,2) USING credits::DECIMAL(10,2);

-- Update the bookings table to handle decimal credits
ALTER TABLE bookings
ALTER COLUMN credits_used TYPE DECIMAL(10,2) USING credits_used::DECIMAL(10,2);

-- Update the credit_transactions table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
        ALTER TABLE credit_transactions
        ALTER COLUMN amount TYPE DECIMAL(10,2) USING amount::DECIMAL(10,2);
        
        -- Also update balance if it exists
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'credit_transactions' AND column_name = 'balance') THEN
            ALTER TABLE credit_transactions
            ALTER COLUMN balance TYPE DECIMAL(10,2) USING balance::DECIMAL(10,2);
        END IF;
    END IF;
END $$;

-- Update the credits table if it exists  
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'credits') THEN
        ALTER TABLE credits
        ALTER COLUMN amount TYPE DECIMAL(10,2) USING amount::DECIMAL(10,2);
    END IF;
END $$;

-- Update the create_booking function to handle decimal credits
CREATE OR REPLACE FUNCTION create_booking(
  p_accommodation_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_total_price DECIMAL,
  p_user_id UUID,
  p_applied_discount_code TEXT DEFAULT NULL,
  p_credits_used DECIMAL DEFAULT 0
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings;
  v_accommodation accommodations;
  v_current_bookings INTEGER;
  v_user_credits DECIMAL(10,2);
  v_updated_credits DECIMAL(10,2);
BEGIN
  -- Get accommodation details
  SELECT * INTO v_accommodation
  FROM accommodations
  WHERE id = p_accommodation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accommodation not found';
  END IF;
  
  -- Check if accommodation has unlimited inventory
  IF NOT v_accommodation.is_unlimited THEN
    -- Count current bookings for this accommodation in the date range
    SELECT COUNT(*) INTO v_current_bookings
    FROM bookings b
    WHERE b.accommodation_id = p_accommodation_id
      AND b.status = 'confirmed'
      AND b.check_in < p_check_out
      AND b.check_out > p_check_in;
    
    -- Check if there's availability
    IF v_current_bookings >= v_accommodation.inventory THEN
      RAISE EXCEPTION 'No availability for this accommodation';
    END IF;
  END IF;
  
  -- Check user credits if credits are being used
  IF p_credits_used > 0 THEN
    SELECT credits INTO v_user_credits
    FROM profiles
    WHERE id = p_user_id;
    
    IF v_user_credits < p_credits_used THEN
      RAISE EXCEPTION 'Insufficient credits. Available: %, Required: %', v_user_credits, p_credits_used;
    END IF;
    
    -- Deduct credits from user profile
    v_updated_credits := v_user_credits - p_credits_used;
    UPDATE profiles
    SET credits = v_updated_credits
    WHERE id = p_user_id;
    
    -- Log credit transaction if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
      INSERT INTO credit_transactions (user_id, amount, balance, description, created_at)
      VALUES (p_user_id, -p_credits_used, v_updated_credits, 'Booking payment', NOW());
    END IF;
  END IF;
  
  -- Create the booking
  INSERT INTO bookings (
    user_id,
    accommodation_id,
    check_in,
    check_out,
    total_price,
    status,
    applied_discount_code,
    credits_used
  ) VALUES (
    p_user_id,
    p_accommodation_id,
    p_check_in,
    p_check_out,
    p_total_price,
    'confirmed',
    p_applied_discount_code,
    p_credits_used
  ) RETURNING * INTO v_booking;
  
  RETURN v_booking;
END;
$$;

-- Update check constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_credits_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_credits_check CHECK (credits >= 0);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_credits_used_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_credits_used_check CHECK (credits_used >= 0);

-- Add comment to document the change
COMMENT ON COLUMN profiles.credits IS 'User credits balance in euros with 2 decimal places';
COMMENT ON COLUMN bookings.credits_used IS 'Credits used for this booking in euros with 2 decimal places';