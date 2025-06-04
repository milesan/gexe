-- Fix get_accommodation_availability function to use inventory and return available_capacity
-- This restores the functionality that was lost in the weathered_pond migration

BEGIN;

-- Drop the existing function
DROP FUNCTION IF EXISTS get_accommodation_availability;

-- Create the corrected function that uses inventory and returns available_capacity
CREATE OR REPLACE FUNCTION get_accommodation_availability(
    check_in_date text,
    check_out_date text
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
            ELSE (COALESCE(a.inventory, 0) - COALESCE(booked.count, 0)) > 0
        END AS is_available,
        -- Available capacity: NULL for unlimited, otherwise (inventory - booked count)
        CASE 
            WHEN a.is_unlimited THEN NULL 
            ELSE GREATEST(COALESCE(a.inventory, 0) - COALESCE(booked.count, 0)::int, 0)
        END AS available_capacity
    FROM accommodations a
    LEFT JOIN (
        SELECT 
            b.accommodation_id, 
            CAST(COUNT(*) AS integer) AS count
        FROM bookings b
        WHERE b.status = 'confirmed'
        AND b.check_in < (check_out_date::timestamp with time zone)
        AND b.check_out > (check_in_date::timestamp with time zone)
        GROUP BY b.accommodation_id
    ) booked ON a.id = booked.accommodation_id;
END;
$$;

COMMIT; 