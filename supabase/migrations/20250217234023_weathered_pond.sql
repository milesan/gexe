-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_accommodation_availability;

-- Create a single, unambiguous version of the function
CREATE OR REPLACE FUNCTION get_accommodation_availability(
    check_in_date text,
    check_out_date text
) RETURNS TABLE (
    accommodation_id uuid,
    title text,
    is_available boolean
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        a.id AS accommodation_id,
        a.title,
        CASE
            WHEN a.is_unlimited THEN true
            ELSE NOT EXISTS (
                SELECT 1 
                FROM bookings b
                WHERE b.accommodation_id = a.id
                AND b.status = 'confirmed'
                AND (
                    -- Check if the booking overlaps with the requested date range
                    b.check_in < (check_out_date::timestamp with time zone)
                    AND b.check_out > (check_in_date::timestamp with time zone)
                )
            )
        END AS is_available
    FROM accommodations a;
END;
$$ LANGUAGE plpgsql;