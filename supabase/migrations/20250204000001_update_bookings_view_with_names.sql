-- Update bookings_with_items view to include first and last names from applications data

BEGIN;

-- Drop the existing view
DROP VIEW IF EXISTS bookings_with_items CASCADE;

-- Recreate the view with first and last names extracted from applications data using the specific question IDs
CREATE OR REPLACE VIEW bookings_with_items AS
SELECT 
    b.*,
    ai.zone,
    ai.type,
    ai.size,
    ai.item_id,
    get_accommodation_item_tag(ai.zone, ai.type, ai.size, ai.item_id) as item_tag,
    u.email as user_email,
    -- Extract first and last name from applications data using both old and new question IDs
    COALESCE(
        ap.data->>'39f455d1-0de8-438f-8f34-10818eaec15e', -- New First Name question ID
        ap.data->>'4000', -- Old First Name question ID
        split_part(u.raw_user_meta_data->>'full_name', ' ', 1),
        ''
    ) as first_name,
    COALESCE(
        ap.data->>'246d0acf-25cd-4e4e-9434-765e6ea679cb', -- New Last Name question ID
        ap.data->>'5500', -- Old Last Name question ID (alternative)
        ap.data->>'5000', -- Old Last Name question ID (original)
        split_part(u.raw_user_meta_data->>'full_name', ' ', 2),
        ''
    ) as last_name,
    -- Keep the full name for backward compatibility
    COALESCE(
        CASE 
            WHEN (ap.data->>'39f455d1-0de8-438f-8f34-10818eaec15e' IS NOT NULL 
                AND ap.data->>'246d0acf-25cd-4e4e-9434-765e6ea679cb' IS NOT NULL)
            THEN TRIM(CONCAT(
                ap.data->>'39f455d1-0de8-438f-8f34-10818eaec15e', 
                ' ', 
                ap.data->>'246d0acf-25cd-4e4e-9434-765e6ea679cb'
            ))
            WHEN (ap.data->>'4000' IS NOT NULL AND (ap.data->>'5000' IS NOT NULL OR ap.data->>'5500' IS NOT NULL))
            THEN TRIM(CONCAT(ap.data->>'4000', ' ', COALESCE(ap.data->>'5500', ap.data->>'5000')))
            ELSE u.raw_user_meta_data->>'full_name'
        END,
        ''
    ) as guest_name,
    ap.data as application_data,
    ap.id as application_id
FROM bookings b
LEFT JOIN accommodation_items ai ON b.accommodation_item_id = ai.id
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN applications ap ON ap.user_id = b.user_id;

-- Grant permissions
GRANT SELECT ON bookings_with_items TO authenticated;

COMMIT;