-- Allow "Your Own Tent" and "Van Parking" to be assigned to any accommodation item
CREATE OR REPLACE FUNCTION assign_accommodation_item_to_booking(
    p_booking_id UUID,
    p_accommodation_item_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_accommodation_id UUID;
    v_accommodation_title TEXT;
    v_item_accommodation_id UUID;
    v_item_tag TEXT;
    v_check_in TIMESTAMP WITH TIME ZONE;
    v_check_out TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the booking's accommodation info
    SELECT accommodation_id, accommodation_title, check_in, check_out
    INTO v_accommodation_id, v_accommodation_title, v_check_in, v_check_out
    FROM bookings
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    
    -- Get the accommodation item's accommodation_id
    SELECT accommodation_id, 
           CONCAT(
               COALESCE(zone, ''),
               COALESCE(type, ''),
               COALESCE(size::text, ''),
               COALESCE(item_id::text, '')
           ) as tag
    INTO v_item_accommodation_id, v_item_tag
    FROM accommodation_items
    WHERE id = p_accommodation_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Accommodation item not found';
    END IF;
    
    -- Check if accommodation types match, except for flexible types that can be assigned anywhere
    IF v_accommodation_title NOT IN ('Staying with somebody', 'Your Own Tent', 'Van Parking') 
       AND v_accommodation_id != v_item_accommodation_id THEN
        RAISE EXCEPTION 'Accommodation item does not belong to the booking''s accommodation type';
    END IF;
    
    -- No longer checking for conflicts - multiple bookings can share the same item
    -- This allows multiple people to share a bell tent, tipi, etc.
    
    -- Update the booking with the accommodation item
    UPDATE bookings
    SET 
        accommodation_item_id = p_accommodation_item_id,
        item_tag = v_item_tag,
        updated_at = NOW()
    WHERE id = p_booking_id;
    
    RAISE NOTICE 'Booking % assigned to accommodation item % with tag %', p_booking_id, p_accommodation_item_id, v_item_tag;
END;
$$;