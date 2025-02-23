-- Test get_accommodation_availability_range function
DO $$ 
DECLARE
    test_accommodation_id uuid;
    result_record record;
BEGIN
    -- Create test accommodation
    INSERT INTO accommodations (title, is_unlimited)
    VALUES ('Test Room', false)
    RETURNING id INTO test_accommodation_id;

    -- Test 1: Check availability for empty period
    PERFORM * FROM get_accommodation_availability_range(
        '2025-03-01',  -- start_date
        '2025-03-31'   -- end_date
    );

    -- Test 2: Create a booking and check availability
    INSERT INTO bookings (
        accommodation_id,
        user_id,
        check_in,
        check_out,
        status
    ) VALUES (
        test_accommodation_id,
        '00000000-0000-0000-0000-000000000000',  -- Replace with actual user_id
        '2025-03-15',
        '2025-03-20',
        'confirmed'
    );

    -- Check availability for the month again
    FOR result_record IN 
        SELECT * FROM get_accommodation_availability_range(
            '2025-03-01',  -- start_date
            '2025-03-31'   -- end_date
        )
    LOOP
        RAISE NOTICE 'Date: %, Accommodation: %, Available: %', 
            result_record.availability_date,
            result_record.title,
            result_record.is_available;
    END LOOP;

    -- Cleanup
    DELETE FROM bookings WHERE accommodation_id = test_accommodation_id;
    DELETE FROM accommodations WHERE id = test_accommodation_id;
END;
$$ LANGUAGE plpgsql;
