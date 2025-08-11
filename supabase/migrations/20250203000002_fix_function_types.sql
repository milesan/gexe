-- Fix the get_accommodation_item_availability_range function to use text types instead of enums

BEGIN;

-- Drop and recreate the function with text types
DROP FUNCTION IF EXISTS get_accommodation_item_availability_range(date, date);

CREATE OR REPLACE FUNCTION get_accommodation_item_availability_range(
    start_date date,
    end_date date
) RETURNS TABLE (
    availability_date date,
    accommodation_id uuid,
    accommodation_item_id uuid,
    item_tag text,
    zone text,
    type text,
    size text,
    item_id integer,
    title text,
    is_available boolean,
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
            b.accommodation_item_id,
            b.check_in::date as booking_start,
            b.check_out::date as booking_end,
            b.status,
            b.user_id,
            b.guest_email,
            u.email as user_email,
            u.raw_user_meta_data->>'full_name' as guest_name,
            ap.id as application_id,
            jsonb_build_object(
                'id', b.id,
                'check_in', b.check_in,
                'check_out', b.check_out,
                'status', b.status,
                'guest_email', COALESCE(b.guest_email, u.email),
                'guest_name', u.raw_user_meta_data->>'full_name',
                'user_id', b.user_id,
                'application_id', ap.id
            ) as booking_details
        FROM bookings b
        LEFT JOIN auth.users u ON b.user_id = u.id
        LEFT JOIN applications ap ON ap.user_id = b.user_id
        WHERE b.check_in::date <= end_date 
        AND b.check_out::date >= start_date
        AND b.status = 'confirmed'
    )
    SELECT 
        d.curr_date as availability_date,
        ai.accommodation_id,
        ai.id as accommodation_item_id,
        get_accommodation_item_tag(ai.zone, ai.type, ai.size, ai.item_id) as item_tag,
        ai.zone,
        ai.type,
        ai.size,
        ai.item_id,
        a.title,
        -- An item is available if it has no bookings on that date
        NOT EXISTS (
            SELECT 1 
            FROM bookings_in_range b 
            WHERE b.accommodation_item_id = ai.id 
            AND d.curr_date >= b.booking_start 
            AND d.curr_date < b.booking_end
        ) AS is_available,
        -- Get all bookings for this item on this date
        COALESCE(
            jsonb_agg(b.booking_details) FILTER (
                WHERE b.accommodation_item_id = ai.id 
                AND d.curr_date >= b.booking_start 
                AND d.curr_date < b.booking_end
            ), 
            '[]'::jsonb
        ) as bookings
    FROM dates d
    CROSS JOIN accommodation_items ai
    JOIN accommodations a ON ai.accommodation_id = a.id
    LEFT JOIN bookings_in_range b ON b.accommodation_item_id = ai.id
    GROUP BY d.curr_date, ai.id, ai.accommodation_id, ai.zone, ai.type, ai.size, ai.item_id, a.title
    ORDER BY d.curr_date, ai.zone NULLS LAST, ai.type, ai.size, ai.item_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_accommodation_item_availability_range TO authenticated;

COMMIT;