-- Fix database functions that still reference 'capacity' column
-- This migration updates functions to use 'inventory' instead of 'capacity'

BEGIN;

-- 1. Update get_accommodation_availability function
CREATE OR REPLACE FUNCTION get_accommodation_availability(
    check_in_date date,
    check_out_date date
) RETURNS TABLE (
    accommodation_id uuid,
    title text,
    is_available boolean,
    available_capacity integer
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        a.id AS accommodation_id,
        a.title,
        -- If unlimited, always available. Otherwise, check if inventory > booked count
        CASE 
            WHEN a.is_unlimited THEN TRUE 
            ELSE (a.inventory - COALESCE(booked.count, 0)) > 0
        END AS is_available,
        -- Available capacity: NULL for unlimited, otherwise (inventory - booked count)
        CASE 
            WHEN a.is_unlimited THEN NULL 
            ELSE GREATEST(a.inventory - COALESCE(booked.count, 0)::int, 0)
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
$$;

-- 2. Update get_accommodation_availability_range function
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
) LANGUAGE plpgsql AS $$
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
            ELSE (a.inventory - COALESCE(COUNT(DISTINCT b.booking_details) FILTER (WHERE b.booking_start <= d.curr_date AND b.booking_end > d.curr_date), 0)) > 0
        END AS is_available,
        CASE 
            WHEN a.is_unlimited THEN NULL 
            ELSE GREATEST(a.inventory - COALESCE(COUNT(DISTINCT b.booking_details) FILTER (WHERE b.booking_start <= d.curr_date AND b.booking_end > d.curr_date), 0)::int, 0)
        END AS available_capacity,
        COALESCE(jsonb_agg(b.booking_details) FILTER (WHERE b.booking_details IS NOT NULL), '[]'::jsonb) as bookings
    FROM dates d
    CROSS JOIN accommodations a
    LEFT JOIN bookings_in_range b ON 
        a.id = b.accommodation_id 
        AND d.curr_date >= b.booking_start 
        AND d.curr_date < b.booking_end
    GROUP BY d.curr_date, a.id, a.title, a.inventory, a.is_unlimited
    ORDER BY d.curr_date, a.title;
END;
$$;

-- 3. Optional: Rename the constraint for consistency (this will recreate it)
ALTER TABLE accommodations DROP CONSTRAINT accommodations_capacity_check;
ALTER TABLE accommodations ADD CONSTRAINT accommodations_inventory_check CHECK (inventory >= 0);

COMMIT; 