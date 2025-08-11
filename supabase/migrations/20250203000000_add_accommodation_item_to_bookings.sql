-- Add accommodation_item_id to bookings table to track specific inventory items
-- This allows multiple bookings for the same accommodation item at different times

BEGIN;

-- Add accommodation_item_id column to bookings table
ALTER TABLE bookings 
ADD COLUMN accommodation_item_id uuid NULL REFERENCES accommodation_items(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_bookings_accommodation_item_id ON bookings(accommodation_item_id);

-- Create a view that includes booking details with accommodation item information
CREATE OR REPLACE VIEW bookings_with_items AS
SELECT 
    b.*,
    ai.zone,
    ai.type,
    ai.size,
    ai.item_id,
    get_accommodation_item_tag(ai.zone, ai.type, ai.size, ai.item_id) as item_tag,
    u.email as user_email,
    u.raw_user_meta_data->>'full_name' as guest_name,
    ap.data as application_data,
    ap.id as application_id
FROM bookings b
LEFT JOIN accommodation_items ai ON b.accommodation_item_id = ai.id
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN applications ap ON ap.user_id = b.user_id;

-- Grant permissions
GRANT SELECT ON bookings_with_items TO authenticated;

-- Keep the original get_accommodation_availability_range function as is
-- Create a new function specifically for accommodation items
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

-- Function to assign an accommodation item to a booking
CREATE OR REPLACE FUNCTION assign_accommodation_item_to_booking(
    p_booking_id uuid,
    p_accommodation_item_id uuid
) RETURNS void AS $$
DECLARE
    v_accommodation_id uuid;
    v_item_accommodation_id uuid;
    v_check_in date;
    v_check_out date;
    v_conflict_count integer;
BEGIN
    -- Get booking details
    SELECT accommodation_id, check_in, check_out
    INTO v_accommodation_id, v_check_in, v_check_out
    FROM bookings
    WHERE id = p_booking_id;
    
    IF v_accommodation_id IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    
    -- Get accommodation item's accommodation_id
    SELECT accommodation_id
    INTO v_item_accommodation_id
    FROM accommodation_items
    WHERE id = p_accommodation_item_id;
    
    IF v_item_accommodation_id IS NULL THEN
        RAISE EXCEPTION 'Accommodation item not found';
    END IF;
    
    -- Verify the item belongs to the same accommodation type
    IF v_accommodation_id != v_item_accommodation_id THEN
        RAISE EXCEPTION 'Accommodation item does not belong to the booking''s accommodation type';
    END IF;
    
    -- Check for conflicts
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM bookings b
    WHERE b.accommodation_item_id = p_accommodation_item_id
    AND b.status = 'confirmed'
    AND b.id != p_booking_id
    AND b.check_in < v_check_out
    AND b.check_out > v_check_in;
    
    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Accommodation item is already booked for these dates';
    END IF;
    
    -- Assign the item
    UPDATE bookings
    SET accommodation_item_id = p_accommodation_item_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_accommodation_item_to_booking TO authenticated;
GRANT EXECUTE ON FUNCTION get_accommodation_item_availability_range TO authenticated;

COMMIT;