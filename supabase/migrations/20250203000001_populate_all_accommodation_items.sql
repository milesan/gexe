-- Populate accommodation_items for all accommodations with inventory
-- This migration adds items for rooms, dorms, cabins, etc.

BEGIN;

-- First, drop views that depend on the accommodation_items table
DROP VIEW IF EXISTS bookings_with_items CASCADE;
DROP VIEW IF EXISTS accommodation_items_with_tags CASCADE;

-- Now we can convert the enum columns to text to allow more flexible types
ALTER TABLE accommodation_items 
  ALTER COLUMN type TYPE text,
  ALTER COLUMN size TYPE text,
  ALTER COLUMN zone TYPE text;

-- Drop the unique constraint that uses the enum types
ALTER TABLE accommodation_items DROP CONSTRAINT IF EXISTS accommodation_items_type_size_item_id_key;

-- Recreate it with the new column types
ALTER TABLE accommodation_items ADD CONSTRAINT accommodation_items_type_size_item_id_key 
  UNIQUE(type, size, item_id);

-- Update the get_accommodation_item_tag function to handle text types
CREATE OR REPLACE FUNCTION get_accommodation_item_tag(
  p_zone text,
  p_type text,
  p_size text,
  p_item_id integer
) RETURNS text AS $$
BEGIN
  -- Handle NULL zone by showing "??" instead
  RETURN COALESCE(p_zone, '??') || '-' || p_type || '.' || p_size || '-' || lpad(p_item_id::text, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Recreate the views with the new column types
CREATE OR REPLACE VIEW accommodation_items_with_tags AS
SELECT 
  ai.*,
  get_accommodation_item_tag(ai.zone, ai.type, ai.size, ai.item_id) as full_tag,
  a.title as accommodation_title,
  a.type as accommodation_type
FROM accommodation_items ai
JOIN accommodations a ON ai.accommodation_id = a.id;

-- Recreate the bookings_with_items view
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

-- Grant permissions on the recreated views
GRANT SELECT ON accommodation_items_with_tags TO authenticated;
GRANT SELECT ON bookings_with_items TO authenticated;

-- Now let's populate the accommodation items

-- Microcabins (3 total)
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  'M' as zone, -- M for Microcabins
  'MC' as type, -- MicroCabin
  CASE 
    WHEN title LIKE '%Left%' THEN 'L'
    WHEN title LIKE '%Right%' THEN 'R'
    WHEN title LIKE '%Middle%' THEN 'M'
    ELSE '1'
  END as size,
  1 as item_id
FROM accommodations 
WHERE type = 'cabin' AND title LIKE 'Microcabin%';

-- The Yurt
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  'U' as zone, -- U for Upper Glamping Plateau
  'YT' as type, -- YurT
  '1' as size,
  1 as item_id
FROM accommodations 
WHERE title = 'The Yurt';

-- Rooms (The Hearth, Writer's Room, Valleyview Room)
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone, -- Rooms don't have specific zones
  'RM' as type, -- RooM
  CASE 
    WHEN title = 'The Hearth' THEN 'H'
    WHEN title = 'Writer''s Room' THEN 'W'
    WHEN title = 'Valleyview Room' THEN 'V'
    ELSE '1'
  END as size,
  1 as item_id
FROM accommodations 
WHERE type = 'room' AND title IN ('The Hearth', 'Writer''s Room', 'Valleyview Room');

-- 3-Bed Dorm (each bed is a separate item)
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone,
  'D3' as type, -- Dorm 3-bed
  '1' as size,
  generate_series(1, 3) as item_id -- Creates 3 items
FROM accommodations 
WHERE title = '3-Bed Dorm';

-- 6-Bed Dorm (each bed is a separate item)
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone,
  'D6' as type, -- Dorm 6-bed
  '1' as size,
  generate_series(1, 6) as item_id -- Creates 6 items
FROM accommodations 
WHERE title = '6-Bed Dorm';

-- For unlimited accommodations (Van Parking, Your Own Tent, Staying with somebody)
-- We'll create a few initial slots that can be expanded dynamically

-- Van Parking (start with 10 slots)
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  'P' as zone, -- P for Parking
  'VP' as type, -- Van Parking
  '1' as size,
  generate_series(1, 10) as item_id
FROM accommodations 
WHERE title = 'Van Parking' AND is_unlimited = true;

-- Your Own Tent (start with 20 slots)
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone, -- Can be anywhere
  'OT' as type, -- Own Tent
  '1' as size,
  generate_series(1, 20) as item_id
FROM accommodations 
WHERE title = 'Your Own Tent' AND is_unlimited = true;

-- Staying with somebody (start with 10 slots)
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone,
  'SW' as type, -- Staying With
  '1' as size,
  generate_series(1, 10) as item_id
FROM accommodations 
WHERE title = 'Staying with somebody' AND is_unlimited = true;


COMMIT;