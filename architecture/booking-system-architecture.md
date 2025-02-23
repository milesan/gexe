# Booking system architecture

## Pages (page layouts)

BookingPage.tsx
Book2Page.tsx

## Components (UI elements)

WeekSelector.tsx
WeekBox.tsx
MyBookings.tsx
BookingSummary.tsx
BookingList.tsx
BookingModal.tsx
Book2Page.tsx
AvailabilityCalendar.tsx
AccommodaitonCard.tsx

## Hooks (data fetching)

useWeeklyAccommodations.tsx
useAvailability.tsx
useAccommodation.tsx

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
  is_unlimited boolean NOT NULL DEFAULT false
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
            CAST(COUNT(*) AS integer) AS count  -- ✅ Explicit type cast to integer
        FROM bookings b
        WHERE b.status = 'confirmed'
        AND b.check_in < check_out_date 
        AND b.check_out > check_in_date
        GROUP BY b.accommodation_id
    ) booked ON a.id = booked.accommodation_id;
END;
$$ LANGUAGE plpgsql;