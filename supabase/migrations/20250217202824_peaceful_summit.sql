-- Create bed size enum
CREATE TYPE bed_size AS ENUM (
  'single',    -- 90×200cm (35×79")
  'double',    -- 140×200cm (55×79")
  'queen',     -- 160×200cm (63×79")
  'king',      -- 180×200cm (71×79")
  'none'       -- For accommodations without beds
);

-- Add bed size column to accommodations
ALTER TABLE accommodations
ADD COLUMN bed_size bed_size;

-- Update existing accommodations with bed sizes
UPDATE accommodations SET
  bed_size = CASE
    -- Dorms
    WHEN title = '4-Bed Dorm' OR title = '6-Bed Dorm' OR title LIKE '%Dorm Bed%' THEN 'single'
    
    -- A-Frame and Microcabins
    WHEN title = 'A-Frame Pod' OR title LIKE 'Microcabin%' THEN 'double'
    
    -- Writer's Room
    WHEN title = 'Writer''s Room' THEN 'double'
    
    -- Valleyview Room
    WHEN title = 'Valleyview Room' THEN 'queen'
    
    -- The Hearth
    WHEN title = 'The Hearth' THEN 'king'
    
    -- Master's Suite
    WHEN title = 'Master''s Suite' THEN 'queen'
    
    -- Bell Tents
    WHEN title = '4 Meter Bell Tent' THEN 'double'
    WHEN title = '5m Bell Tent' THEN 'queen'
    
    -- Tipi
    WHEN title = '2.2 Meter Tipi' THEN 'single'
    
    -- Your Own Tent
    WHEN title = 'Your Own Tent' THEN 'single'
    
    -- No beds
    WHEN title = 'Van Parking' OR title = 'I''m staying with someone else / +1' THEN 'none'
    
    -- Default to none for any other cases
    ELSE 'none'
  END;

-- Create a view that shows bed sizes in human-readable format
CREATE OR REPLACE VIEW accommodation_details AS
SELECT 
  a.*,
  CASE a.bed_size
    WHEN 'single' THEN '90×200cm (35×79") - Single'
    WHEN 'double' THEN '140×200cm (55×79") - Double'
    WHEN 'queen' THEN '160×200cm (63×79") - Queen'
    WHEN 'king' THEN '180×200cm (71×79") - King'
    WHEN 'none' THEN 'No bed'
    ELSE 'Unknown'
  END as bed_size_display
FROM accommodations a;

-- Grant access to the view
GRANT SELECT ON accommodation_details TO authenticated;