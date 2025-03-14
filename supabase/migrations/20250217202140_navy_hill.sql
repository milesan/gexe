-- Create extension for better UUID handling
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better data integrity
CREATE TYPE accommodation_type AS ENUM (
  'room', 'dorm', 'cabin', 'tent', 'parking', 'addon'
);

CREATE TYPE booking_status AS ENUM (
  'pending', 'confirmed', 'cancelled'
);

-- Create accommodations table
CREATE TABLE IF NOT EXISTS accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text NOT NULL,
  base_price integer NOT NULL CHECK (base_price >= 0),
  type accommodation_type NOT NULL,
  capacity integer NOT NULL CHECK (capacity >= 0),
  bathrooms numeric NOT NULL DEFAULT 0,
  has_wifi boolean NOT NULL DEFAULT false,
  has_electricity boolean NOT NULL DEFAULT false,
  image_url text,
  is_fungible boolean NOT NULL DEFAULT false,
  is_unlimited boolean NOT NULL DEFAULT false,
  parent_accommodation_id uuid REFERENCES accommodations(id) ON DELETE CASCADE,
  inventory_count integer NOT NULL DEFAULT 1 CHECK (inventory_count >= 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unlimited accommodations have high inventory
  CONSTRAINT unlimited_inventory CHECK (
    NOT is_unlimited OR inventory_count >= 5000
  ),
  
  -- Ensure fungible accommodations have proper inventory
  CONSTRAINT fungible_inventory CHECK (
    NOT is_fungible OR inventory_count > 1 OR parent_accommodation_id IS NOT NULL
  )
);

-- Create bookings table with better constraints
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  accommodation_id uuid REFERENCES accommodations(id) ON DELETE CASCADE NOT NULL,
  check_in timestamp with time zone NOT NULL,
  check_out timestamp with time zone NOT NULL,
  total_price integer NOT NULL CHECK (total_price >= 0),
  status booking_status NOT NULL DEFAULT 'pending',
  payment_intent_id text UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure check_out is after check_in
  CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- Create seasonal rates table for flexible pricing
CREATE TABLE IF NOT EXISTS seasonal_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid REFERENCES accommodations(id) ON DELETE CASCADE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  discount_percentage integer NOT NULL CHECK (
    discount_percentage >= 0 AND 
    discount_percentage <= 100
  ),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure end_date is after start_date
  CONSTRAINT valid_season_dates CHECK (end_date >= start_date),
  
  -- Prevent overlapping seasons for same accommodation
  CONSTRAINT no_overlapping_seasons EXCLUDE USING gist (
    accommodation_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
);

-- Create availability holds table for concurrent booking prevention
CREATE TABLE IF NOT EXISTS availability_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid REFERENCES accommodations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  check_in timestamp with time zone NOT NULL,
  check_out timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure hold expiry is in the future
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create function to automatically expire holds
CREATE OR REPLACE FUNCTION expire_availability_holds() RETURNS void AS $$
BEGIN
  DELETE FROM availability_holds
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better query performance
CREATE INDEX idx_accommodations_parent ON accommodations(parent_accommodation_id);
CREATE INDEX idx_accommodations_type ON accommodations(type);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_accommodation ON bookings(accommodation_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_seasonal_rates_dates ON seasonal_rates(start_date, end_date);
CREATE INDEX idx_availability_holds_dates ON availability_holds(check_in, check_out);
CREATE INDEX idx_availability_holds_expiry ON availability_holds(expires_at);

-- Create view for accommodation availability
CREATE OR REPLACE VIEW accommodation_availability AS
WITH booked_units AS (
  SELECT 
    a.id AS accommodation_id,
    a.title,
    a.is_fungible,
    a.is_unlimited,
    a.inventory_count,
    b.check_in,
    b.check_out,
    COUNT(*) AS booked_count
  FROM accommodations a
  LEFT JOIN bookings b ON a.id = b.accommodation_id
  WHERE b.status = 'confirmed'
  GROUP BY 
    a.id, 
    a.title, 
    a.is_fungible, 
    a.is_unlimited,
    a.inventory_count,
    b.check_in,
    b.check_out
)
SELECT
  accommodation_id,
  title,
  is_fungible,
  is_unlimited,
  inventory_count,
  check_in,
  check_out,
  CASE
    WHEN is_unlimited THEN inventory_count
    ELSE GREATEST(0, inventory_count - COALESCE(booked_count, 0))
  END AS available_units
FROM booked_units;

-- Enable RLS
ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_holds ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public read access to accommodations"
  ON accommodations FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access to bookings"
  ON bookings FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can view their own holds"
  ON availability_holds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create holds"
  ON availability_holds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own holds"
  ON availability_holds FOR DELETE
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT ON accommodations TO authenticated;
GRANT SELECT, INSERT ON bookings TO authenticated;
GRANT SELECT, INSERT, DELETE ON availability_holds TO authenticated;
GRANT SELECT ON accommodation_availability TO authenticated;

-- Schedule hold expiry to run every minute
SELECT cron.schedule(
  'expire-holds',
  '* * * * *',
  $$SELECT expire_availability_holds()$$
);