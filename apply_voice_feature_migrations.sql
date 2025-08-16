-- Safe migration script for voice application feature
-- Run this in Supabase SQL editor

-- ========================================
-- PART 1: Create pending bookings table
-- ========================================

-- Create pending bookings table if it doesn't exist
CREATE TABLE IF NOT EXISTS pending_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_pending_booking_per_user UNIQUE(user_id, application_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_pending_bookings_user_id ON pending_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_bookings_expires_at ON pending_bookings(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_bookings_claimed ON pending_bookings(claimed);

-- Enable RLS
ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view own pending bookings" ON pending_bookings;
CREATE POLICY "Users can view own pending bookings" 
  ON pending_bookings FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pending bookings" ON pending_bookings;
CREATE POLICY "Users can update own pending bookings" 
  ON pending_bookings FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all pending bookings" ON pending_bookings;
CREATE POLICY "Admins can manage all pending bookings" 
  ON pending_bookings FOR ALL
  USING (public.is_admin());

-- Create or replace functions
CREATE OR REPLACE FUNCTION expire_pending_bookings()
RETURNS void AS $$
BEGIN
  UPDATE pending_bookings
  SET claimed = FALSE
  WHERE expires_at < NOW() AND claimed = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_pending_booking_on_approval(
  p_user_id UUID,
  p_application_id UUID,
  p_accommodation_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS pending_bookings AS $$
DECLARE
  v_pending_booking pending_bookings;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_expires_at := NOW() + INTERVAL '72 hours';
  
  INSERT INTO pending_bookings (
    user_id,
    application_id,
    accommodation_id,
    start_date,
    end_date,
    expires_at
  ) VALUES (
    p_user_id,
    p_application_id,
    p_accommodation_id,
    p_start_date,
    p_end_date,
    v_expires_at
  ) 
  ON CONFLICT (user_id, application_id) 
  DO UPDATE SET
    accommodation_id = EXCLUDED.accommodation_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    expires_at = EXCLUDED.expires_at,
    claimed = FALSE,
    updated_at = NOW()
  RETURNING * INTO v_pending_booking;
  
  RETURN v_pending_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION claim_pending_booking(
  p_pending_booking_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_total_price INTEGER
) RETURNS bookings AS $$
DECLARE
  v_pending pending_bookings;
  v_booking bookings;
BEGIN
  SELECT * INTO v_pending
  FROM pending_bookings
  WHERE id = p_pending_booking_id
    AND user_id = auth.uid()
    AND claimed = FALSE
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending booking not found or expired';
  END IF;
  
  INSERT INTO bookings (
    accommodation_id,
    user_id,
    check_in,
    check_out,
    total_price,
    payment_intent_id,
    status
  ) VALUES (
    v_pending.accommodation_id,
    v_pending.user_id,
    v_pending.start_date::TIMESTAMP WITH TIME ZONE,
    v_pending.end_date::TIMESTAMP WITH TIME ZONE,
    p_total_price,
    p_stripe_payment_intent_id,
    'confirmed'
  ) RETURNING * INTO v_booking;
  
  UPDATE pending_bookings
  SET claimed = TRUE,
      updated_at = NOW()
  WHERE id = p_pending_booking_id;
  
  RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pending_bookings_updated_at ON pending_bookings;
CREATE TRIGGER update_pending_bookings_updated_at
  BEFORE UPDATE ON pending_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- PART 2: Add visible column and new questions
-- ========================================

-- Add visible column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_questions_2' 
    AND column_name = 'visible'
  ) THEN
    ALTER TABLE application_questions_2 
    ADD COLUMN visible BOOLEAN DEFAULT true;
    
    -- Make sure all existing questions are visible
    UPDATE application_questions_2 SET visible = true WHERE visible IS NULL;
  END IF;
END $$;

-- Check if questions already exist before inserting
DO $$
DECLARE
  v_max_order INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Check if our questions already exist
  SELECT EXISTS(
    SELECT 1 FROM application_questions_2 
    WHERE id IN (
      'c1234567-89ab-cdef-0123-456789abcdef',
      'c2234567-89ab-cdef-0123-456789abcdef',
      'c3234567-89ab-cdef-0123-456789abcdef'
    )
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    -- Get the max order number (your constraint requires >= 1000)
    SELECT COALESCE(MAX(order_number), 999) INTO v_max_order 
    FROM application_questions_2 
    WHERE order_number < 100000;
    
    -- Make sure we start at least at 1000 to satisfy the constraint
    IF v_max_order < 1000 THEN
      v_max_order := 999;
    END IF;
    
    INSERT INTO application_questions_2 (
      id,
      order_number,
      text,
      type,
      required,
      section,
      visibility_rules,
      visible
    ) VALUES 
    (
      'c1234567-89ab-cdef-0123-456789abcdef',
      v_max_order + 1,
      'When would you like to arrive?',
      'date',
      false,
      'stay',
      NULL,
      false -- HIDDEN by default
    ),
    (
      'c2234567-89ab-cdef-0123-456789abcdef',
      v_max_order + 2,
      'When would you like to depart?',
      'date',
      false,
      'stay',
      NULL,
      false -- HIDDEN by default
    ),
    (
      'c3234567-89ab-cdef-0123-456789abcdef',
      v_max_order + 3,
      'What type of accommodation would you prefer?',
      'text', -- Changed from 'accommodation_selector' to 'text' since that's a valid type
      false,
      'stay',
      NULL,
      false -- HIDDEN by default
    );
    
    RAISE NOTICE 'New questions added successfully (hidden by default)';
  ELSE
    RAISE NOTICE 'Questions already exist, skipping insertion';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN application_questions_2.visible IS 
'Controls whether question appears in application. Set date/accommodation questions to visible=true when ready to enable new voice flow.';

-- ========================================
-- VERIFICATION
-- ========================================

-- Show status
SELECT 
  'Pending bookings table created' as status,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_bookings') as success
UNION ALL
SELECT 
  'Visible column added to questions' as status,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'application_questions_2' AND column_name = 'visible') as success
UNION ALL
SELECT 
  'New questions added (hidden)' as status,
  EXISTS(SELECT 1 FROM application_questions_2 WHERE id = 'c1234567-89ab-cdef-0123-456789abcdef') as success;

-- Show the new questions (should be hidden)
SELECT id, text, type, visible, required 
FROM application_questions_2 
WHERE id IN (
  'c1234567-89ab-cdef-0123-456789abcdef',
  'c2234567-89ab-cdef-0123-456789abcdef',
  'c3234567-89ab-cdef-0123-456789abcdef'
);

-- Instructions for enabling the feature
SELECT '
To enable the new date/accommodation selection feature, run:

UPDATE application_questions_2 
SET visible = true, required = true
WHERE id IN (
  ''c1234567-89ab-cdef-0123-456789abcdef'',
  ''c2234567-89ab-cdef-0123-456789abcdef'',
  ''c3234567-89ab-cdef-0123-456789abcdef''
);
' as instructions;