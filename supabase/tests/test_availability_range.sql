-- Test get_accommodation_availability_range function
DO $$ 
DECLARE
    test_dorm_id uuid;
    test_tent_id uuid;
    result record;
    start_date date := '2025-03-01';
    end_date date := '2025-03-05';
BEGIN
    -- Create test accommodations
    INSERT INTO accommodations (id, title, inventory, is_unlimited)
    VALUES 
        ('11111111-1111-1111-1111-111111111111', 'Test Room 1', 2, false),
        ('22222222-2222-2222-2222-222222222222', 'Test Room 2', 1, false)
    RETURNING id INTO test_dorm_id;

    INSERT INTO accommodations (id, title, inventory, is_unlimited)
    VALUES 
        (gen_random_uuid(), 'Test Bell Tent', 1, false)
    RETURNING id INTO test_tent_id;

    -- Test 1: Empty period - should show full inventory available
    FOR result IN 
        SELECT * FROM get_accommodation_availability_range(start_date::text, end_date::text)
        WHERE accommodation_id IN (test_dorm_id, test_tent_id)
        ORDER BY availability_date, title
    LOOP
        RAISE NOTICE 'Test 1 - Date: %, Accommodation: %, Available: %, Inventory: %', 
            result.availability_date,
            result.title,
            result.is_available,
            result.available_capacity,
            2; -- Expected inventory
    END LOOP;

    -- Test 2: Add some bookings and check availability
    -- Book 2 beds in dorm
    INSERT INTO bookings (
        accommodation_id,
        user_id,
        check_in,
        check_out,
        status
    ) VALUES (
        test_dorm_id,
        '00000000-0000-0000-0000-000000000000',  -- Replace with actual user_id
        '2025-03-02',
        '2025-03-04',
        'confirmed'
    );

    -- Add another booking for same period
    INSERT INTO bookings (
        accommodation_id,
        user_id,
        check_in,
        check_out,
        status
    ) VALUES (
        test_dorm_id,
        '00000000-0000-0000-0000-000000000000',  -- Replace with actual user_id
        '2025-03-02',
        '2025-03-04',
        'confirmed'
    );

    -- Book the tent
    INSERT INTO bookings (
        accommodation_id,
        user_id,
        check_in,
        check_out,
        status
    ) VALUES (
        test_tent_id,
        '00000000-0000-0000-0000-000000000000',  -- Replace with actual user_id
        '2025-03-03',
        '2025-03-05',
        'confirmed'
    );

    -- Check availability again
    FOR result IN 
        SELECT * FROM get_accommodation_availability_range(start_date::text, end_date::text)
        WHERE accommodation_id IN (test_dorm_id, test_tent_id)
        ORDER BY availability_date, title
    LOOP
        RAISE NOTICE 'Test 2 - Date: %, Accommodation: %, Available: %, Inventory: %', 
            result.availability_date,
            result.title,
            result.is_available,
            result.available_capacity,
            2; -- Expected inventory
    END LOOP;

    -- Test 3: Add a cancelled booking - should not affect availability
    INSERT INTO bookings (
        accommodation_id,
        user_id,
        check_in,
        check_out,
        status
    ) VALUES (
        test_dorm_id,
        '00000000-0000-0000-0000-000000000000',  -- Replace with actual user_id
        '2025-03-02',
        '2025-03-04',
        'cancelled'
    );

    -- Check availability one more time
    FOR result IN 
        SELECT * FROM get_accommodation_availability_range(start_date::text, end_date::text)
        WHERE accommodation_id IN (test_dorm_id, test_tent_id)
        ORDER BY availability_date, title
    LOOP
        RAISE NOTICE 'Test 3 - Date: %, Accommodation: %, Available: %, Inventory: %', 
            result.availability_date,
            result.title,
            result.is_available,
            result.available_capacity,
            2; -- Expected inventory
    END LOOP;

    -- Cleanup
    DELETE FROM bookings WHERE accommodation_id IN (test_dorm_id, test_tent_id);
    DELETE FROM accommodations WHERE id IN (test_dorm_id, test_tent_id);
END;
$$ LANGUAGE plpgsql;
