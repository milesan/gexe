-- Create enums for the tagging system
CREATE TYPE accommodation_zone AS ENUM (
  'T', -- Tipiland
  'G', -- Grove (forest/upper chestnut orchard)
  'C', -- Tennis Court
  'M', -- Microcabins
  'N', -- Containers
  'U', -- Upper Glamping Plateau
  'L', -- Lower Glamping Plateau
  'P'  -- Parking (near forest entrance)
);

CREATE TYPE accommodation_item_type AS ENUM (
  'BT', -- Bell Tent
  'PT', -- Pumpkin-Shaped Bell Tent
  'TP', -- Tipi
  'VC', -- DIY Van
  'TC'  -- DIY Tent
);

CREATE TYPE accommodation_item_size AS ENUM (
  '2',  -- 2.2m Tipi (Single)
  '3',  -- 3m Tipi (Double)
  '4',  -- 4m Bell tent
  '5',  -- 5m Bell tent
  '6'   -- 6m Bell tent
);

-- Create accommodation_items table
CREATE TABLE accommodation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  zone accommodation_zone NULL DEFAULT NULL, -- Made nullable as requested
  type accommodation_item_type NOT NULL,
  size accommodation_item_size NOT NULL,
  item_id integer NOT NULL, -- Sequential ID (01, 02, 03...)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique tags within each type+size combination
  UNIQUE(type, size, item_id),
  
  -- Ensure item_id is positive
  CONSTRAINT positive_item_id CHECK (item_id > 0)
);

-- Create indexes for better performance
CREATE INDEX idx_accommodation_items_accommodation_id ON accommodation_items(accommodation_id);
CREATE INDEX idx_accommodation_items_tag ON accommodation_items(type, size, item_id);

-- Create a function to generate the full tag (updated to handle NULL zones)
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

-- Create a view for easy access to full tags
CREATE OR REPLACE VIEW accommodation_items_with_tags AS
SELECT 
  ai.*,
  get_accommodation_item_tag(ai.zone, ai.type, ai.size, ai.item_id) as full_tag,
  a.title as accommodation_title,
  a.type as accommodation_type
FROM accommodation_items ai
JOIN accommodations a ON ai.accommodation_id = a.id;

-- Enable RLS
ALTER TABLE accommodation_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public read access to accommodation items"
  ON accommodation_items FOR SELECT
  USING (true);

CREATE POLICY "Admin full access to accommodation items"
  ON accommodation_items FOR ALL
  USING (public.is_admin());

-- Grant permissions
GRANT SELECT ON accommodation_items TO authenticated;
GRANT ALL ON accommodation_items TO authenticated;
GRANT SELECT ON accommodation_items_with_tags TO authenticated;

-- Populate accommodation_items with initial data based on existing accommodations
-- Only add specific items as requested, excluding rooms and dorms

-- 8 4-meter bell tents with NULL zones
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone, -- NULL zone as requested
  'BT' as type,
  '4' as size,
  generate_series(1, 8) as item_id -- Exactly 8 items
FROM accommodations 
WHERE title LIKE '%4 Meter Bell Tent%' AND capacity > 0
LIMIT 1; -- Only take the first matching accommodation

-- 2 single tipis with NULL zones
INSERT INTO accommodation_items (accommodation_id, zone, type, size, item_id)
SELECT 
  id,
  NULL as zone, -- NULL zone as requested
  'TP' as type,
  '2' as size, -- Single tipi size
  generate_series(1, 2) as item_id -- Exactly 2 items
FROM accommodations 
WHERE title LIKE '%Single Tipi%' AND capacity > 0
LIMIT 1; -- Only take the first matching accommodation 