-- Create pending bookings table for approved applications
CREATE TABLE IF NOT EXISTS pending_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES weekly_accommodations(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_pending_booking_per_user UNIQUE(user_id, application_id)
);

-- Create indexes for performance
CREATE INDEX idx_pending_bookings_user_id ON pending_bookings(user_id);
CREATE INDEX idx_pending_bookings_expires_at ON pending_bookings(expires_at);
CREATE INDEX idx_pending_bookings_claimed ON pending_bookings(claimed);

-- Enable RLS
ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own pending bookings
CREATE POLICY "Users can view own pending bookings" 
  ON pending_bookings FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy for users to update their own pending bookings
CREATE POLICY "Users can update own pending bookings" 
  ON pending_bookings FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for admins to manage all pending bookings
CREATE POLICY "Admins can manage all pending bookings" 
  ON pending_bookings FOR ALL
  USING (public.is_admin());

-- Function to auto-expire pending bookings
CREATE OR REPLACE FUNCTION expire_pending_bookings()
RETURNS void AS $$
BEGIN
  UPDATE pending_bookings
  SET claimed = FALSE
  WHERE expires_at < NOW() AND claimed = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create pending booking on approval
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
  -- Set expiration to 72 hours from now
  v_expires_at := NOW() + INTERVAL '72 hours';
  
  -- Check if accommodation is available for these dates
  -- This will be enhanced later with actual availability checking
  
  -- Create the pending booking
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

-- Function to claim a pending booking (convert to actual booking)
CREATE OR REPLACE FUNCTION claim_pending_booking(
  p_pending_booking_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_total_price INTEGER
) RETURNS bookings AS $$
DECLARE
  v_pending pending_bookings;
  v_booking bookings;
BEGIN
  -- Get the pending booking
  SELECT * INTO v_pending
  FROM pending_bookings
  WHERE id = p_pending_booking_id
    AND user_id = auth.uid()
    AND claimed = FALSE
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending booking not found or expired';
  END IF;
  
  -- Create the actual booking
  INSERT INTO bookings (
    accommodation_id,
    user_id,
    check_in,
    check_out,
    total_price,
    stripe_payment_intent_id,
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
  
  -- Mark pending booking as claimed
  UPDATE pending_bookings
  SET claimed = TRUE,
      updated_at = NOW()
  WHERE id = p_pending_booking_id;
  
  RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pending_bookings_updated_at
  BEFORE UPDATE ON pending_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();