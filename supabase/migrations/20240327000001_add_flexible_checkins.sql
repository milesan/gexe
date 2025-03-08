-- Create table for flexible check-in dates
CREATE TABLE flexible_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_customization_id uuid REFERENCES week_customizations(id) ON DELETE CASCADE,
  allowed_checkin_date date NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  
  -- Ensure unique combination of week and check-in date
  UNIQUE(week_customization_id, allowed_checkin_date),
  
  -- Ensure check-in date falls within week's date range
  CONSTRAINT valid_checkin_date CHECK (
    allowed_checkin_date >= (
      SELECT start_date 
      FROM week_customizations 
      WHERE id = week_customization_id
    ) AND 
    allowed_checkin_date <= (
      SELECT end_date 
      FROM week_customizations 
      WHERE id = week_customization_id
    )
  )
);

-- Enable RLS
ALTER TABLE flexible_checkins ENABLE ROW LEVEL SECURITY;

-- Basic policies - we'll update these later with proper admin checks
CREATE POLICY "Flexible checkins are viewable by all users"
  ON flexible_checkins FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify flexible checkins"
  ON flexible_checkins FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('andre@thegarden.pt', 'redis213@gmail.com')
  )); 