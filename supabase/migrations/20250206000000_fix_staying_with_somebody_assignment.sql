-- Fix the assign_accommodation_item_to_booking function to properly handle "Staying with somebody"
-- This ensures the function actually allows cross-accommodation assignments

BEGIN;

-- Drop and recreate the function with proper handling
DROP FUNCTION IF EXISTS assign_accommodation_item_to_booking(uuid, uuid);

CREATE OR REPLACE FUNCTION assign_accommodation_item_to_booking(
    p_booking_id uuid,
    p_accommodation_item_id uuid
) RETURNS void AS $$
DECLARE
    v_accommodation_id uuid;
    v_accommodation_title text;
    v_item_accommodation_id uuid;
    v_check_in date;
    v_check_out date;
BEGIN
    -- Get booking details including accommodation title
    SELECT b.accommodation_id, b.check_in, b.check_out, a.title
    INTO v_accommodation_id, v_check_in, v_check_out, v_accommodation_title
    FROM bookings b
    JOIN accommodations a ON b.accommodation_id = a.id
    WHERE b.id = p_booking_id;
    
    IF v_accommodation_id IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    
    -- Debug logging
    RAISE NOTICE 'Booking accommodation: % (ID: %)', v_accommodation_title, v_accommodation_id;
    
    -- Get accommodation item's accommodation_id
    SELECT accommodation_id
    INTO v_item_accommodation_id
    FROM accommodation_items
    WHERE id = p_accommodation_item_id;
    
    IF v_item_accommodation_id IS NULL THEN
        RAISE EXCEPTION 'Accommodation item not found';
    END IF;
    
    RAISE NOTICE 'Item accommodation ID: %', v_item_accommodation_id;
    RAISE NOTICE 'Is "Staying with somebody": %', (v_accommodation_title = 'Staying with somebody');
    
    -- Only verify accommodation type match if NOT "Staying with somebody"
    -- "Staying with somebody" can be assigned to any accommodation item
    IF v_accommodation_title != 'Staying with somebody' AND v_accommodation_id != v_item_accommodation_id THEN
        RAISE EXCEPTION 'Accommodation item does not belong to the booking''s accommodation type';
    END IF;
    
    -- No conflict checking - multiple bookings can share the same item
    -- This allows multiple people to share accommodations
    
    -- Assign the item
    UPDATE bookings
    SET accommodation_item_id = p_accommodation_item_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_booking_id;
    
    RAISE NOTICE 'Successfully assigned booking % to item %', p_booking_id, p_accommodation_item_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_accommodation_item_to_booking TO authenticated;

-- Add a comment to document this change
COMMENT ON FUNCTION assign_accommodation_item_to_booking IS 
'Assigns an accommodation item to a booking. Multiple bookings can share the same item. 
"Staying with somebody" bookings can be assigned to any accommodation item regardless of type.
Includes debug logging to help troubleshoot assignment issues.';

COMMIT;