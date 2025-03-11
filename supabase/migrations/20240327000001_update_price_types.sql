-- Update the bookings table column
ALTER TABLE bookings 
ALTER COLUMN total_price TYPE decimal(10,2);

-- Update or replace all booking-related functions
CREATE OR REPLACE FUNCTION create_booking(
    p_accommodation_id uuid,
    p_check_in date,
    p_check_out date,
    p_total_price decimal(10,2)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id uuid;
BEGIN
    -- Insert the booking
    INSERT INTO bookings (
        accommodation_id,
        user_id,
        check_in,
        check_out,
        total_price,
        status
    )
    VALUES (
        p_accommodation_id,
        auth.uid(),
        p_check_in,
        p_check_out,
        p_total_price,
        'confirmed'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END;
$$;

-- Update the manual booking function
CREATE OR REPLACE FUNCTION create_manual_booking(
    p_accommodation_id uuid,
    p_user_id uuid,
    p_check_in date,
    p_check_out date,
    p_total_price decimal(10,2)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id uuid;
BEGIN
    -- Insert the booking
    INSERT INTO bookings (
        accommodation_id,
        user_id,
        check_in,
        check_out,
        total_price,
        status
    )
    VALUES (
        p_accommodation_id,
        p_user_id,
        p_check_in,
        p_check_out,
        p_total_price,
        'confirmed'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END;
$$;

-- Update the booking modification function
CREATE OR REPLACE FUNCTION modify_booking(
    p_booking_id uuid,
    p_new_check_in date,
    p_new_check_out date,
    p_new_total_price decimal(10,2)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the booking
    UPDATE bookings
    SET 
        check_in = p_new_check_in,
        check_out = p_new_check_out,
        total_price = p_new_total_price,
        updated_at = NOW()
    WHERE id = p_booking_id
    AND user_id = auth.uid();
END;
$$;

-- Update any views or materialized views that might reference total_price
REFRESH MATERIALIZED VIEW IF EXISTS bookings_summary;

-- Update any triggers if they handle total_price calculations
-- Add more function updates here if needed 