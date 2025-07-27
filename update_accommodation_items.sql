-- Update accommodation_items table to make zone nullable and populate with specific data
-- Run these commands in your Supabase SQL editor

-- 1. Make zone column nullable
ALTER TABLE accommodation_items ALTER COLUMN zone DROP NOT NULL;
ALTER TABLE accommodation_items ALTER COLUMN zone SET DEFAULT NULL;

-- 2. Update the function to handle NULL zones
CREATE OR REPLACE FUNCTION get_accommodation_item_tag(
  p_zone accommodation_zone,
  p_type accommodation_item_type,
  p_size accommodation_item_size,
  p_item_id integer
) RETURNS text AS $$
BEGIN
  -- Handle NULL zone by showing "??" instead
  RETURN COALESCE(p_zone::text, '??') || '-' || p_type || '.' || p_size || '-' || lpad(p_item_id::text, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Update the view to handle NULL zones
CREATE OR REPLACE VIEW accommodation_items_with_tags AS
SELECT 
  ai.*,
  get_accommodation_item_tag(ai.zone, ai.type, ai.size, ai.item_id) as full_tag,
  a.title as accommodation_title,
  a.type as accommodation_type
FROM accommodation_items ai
JOIN accommodations a ON ai.accommodation_id = a.id;

-- 4. Clear existing data first
DELETE FROM accommodation_items;

-- 5. Insert 8 4-meter bell tents with NULL zones
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone,
  'BT' as type,
  '4' as size,
  generate_series(1, 8) as item_id
FROM accommodations 
WHERE title LIKE '%4 Meter Bell Tent%' AND capacity > 0
LIMIT 1;

-- 6. Insert 2 single tipis with NULL zones
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone,
  'TP' as type,
  '2' as size,
  generate_series(1, 2) as item_id
FROM accommodations 
WHERE title LIKE '%Single Tipi%' AND capacity > 0
LIMIT 1; 