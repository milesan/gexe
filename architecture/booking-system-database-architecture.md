# Database Architecture  

-- Create accommodations table
CREATE TABLE IF NOT EXISTS accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  base_price integer NOT NULL CHECK (base_price >= 0),
  type accommodation_type NOT NULL,
  capacity integer CHECK (capacity >= 0),
  has_wifi boolean NOT NULL DEFAULT false,
  has_electricity boolean NOT NULL DEFAULT false,
  image_url text,
  is_unlimited boolean NOT NULL DEFAULT false,
  parent_accommodation_id uuid REFERENCES accommodations(id),
  inventory_count integer CHECK (inventory_count >= 0),
  is_fungible boolean NOT NULL DEFAULT false
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

CREATE OR REPLACE FUNCTION get_accommodation_availability(
    check_in_date date,
    check_out_date date
) RETURNS TABLE (
    accommodation_id uuid,
    title text,
    is_available boolean,
    available_capacity integer
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        a.id AS accommodation_id,
        a.title,
        -- If unlimited, always available. Otherwise, check if capacity > booked count
        CASE 
            WHEN a.is_unlimited THEN TRUE 
            ELSE (a.capacity - COALESCE(booked.count, 0)) > 0
        END AS is_available,
        -- Available capacity: NULL for unlimited, otherwise (capacity - booked count)
        CASE 
            WHEN a.is_unlimited THEN NULL 
            ELSE GREATEST(a.capacity - COALESCE(booked.count, 0)::int, 0)
        END AS available_capacity
    FROM accommodations a
    LEFT JOIN (
        SELECT 
            b.accommodation_id, 
            CAST(COUNT(*) AS integer) AS count  -- Explicit type cast to integer
        FROM bookings b
        WHERE b.status = 'confirmed'
        AND b.check_in < check_out_date 
        AND b.check_out > check_in_date
        GROUP BY b.accommodation_id
    ) booked ON a.id = booked.accommodation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get availability for a date range, returning daily availability for each accommodation
CREATE OR REPLACE FUNCTION get_accommodation_availability_range(
    start_date date,
    end_date date
) RETURNS TABLE (
    availability_date date,
    accommodation_id uuid,
    title text,
    is_available boolean,
    available_capacity integer,
    bookings jsonb
) AS $$
BEGIN
    RETURN QUERY 
    WITH RECURSIVE dates AS (
        SELECT start_date::date AS curr_date
        UNION ALL
        SELECT curr_date + 1
        FROM dates
        WHERE curr_date < end_date
    ),
    bookings_in_range AS (
        SELECT 
            b.accommodation_id,
            b.check_in::date as booking_start,
            b.check_out::date as booking_end,
            b.status,
            jsonb_build_object(
                'id', b.id,
                'check_in', b.check_in,
                'check_out', b.check_out,
                'status', b.status
            ) as booking_details
        FROM bookings b
        WHERE b.check_in::date <= end_date 
        AND b.check_out::date >= start_date
        AND b.status = 'confirmed'
    )
    SELECT 
        d.curr_date as availability_date,
        a.id AS accommodation_id,
        a.title,
        CASE 
            WHEN a.is_unlimited THEN TRUE 
            ELSE (a.capacity - COALESCE(COUNT(DISTINCT b.booking_details) FILTER (WHERE b.booking_start <= d.curr_date AND b.booking_end > d.curr_date), 0)) > 0
        END AS is_available,
        CASE 
            WHEN a.is_unlimited THEN NULL 
            ELSE GREATEST(a.capacity - COALESCE(COUNT(DISTINCT b.booking_details) FILTER (WHERE b.booking_start <= d.curr_date AND b.booking_end > d.curr_date), 0)::int, 0)
        END AS available_capacity,
        COALESCE(jsonb_agg(b.booking_details) FILTER (WHERE b.booking_details IS NOT NULL), '[]'::jsonb) as bookings
    FROM dates d
    CROSS JOIN accommodations a
    LEFT JOIN bookings_in_range b ON 
        a.id = b.accommodation_id 
        AND d.curr_date >= b.booking_start 
        AND d.curr_date < b.booking_end
    GROUP BY d.curr_date, a.id, a.title, a.capacity, a.is_unlimited
    ORDER BY d.curr_date, a.title;
END;
$$ LANGUAGE plpgsql;