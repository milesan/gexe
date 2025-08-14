-- This query will remove duplicate dorm bed items with incorrect size='1'
-- The correct dorm bed items should have size='3' for 3-bed dorms and size='6' for 6-bed dorms

-- First, let's see what we're going to delete (run this to verify):
SELECT * FROM accommodation_items 
WHERE type IN ('D3', 'D6') 
AND size = '1'
ORDER BY accommodation_id, item_id;

-- Then, delete the duplicates with size='1':
DELETE FROM accommodation_items 
WHERE type IN ('D3', 'D6') 
AND size = '1';

-- Verify the remaining correct items:
SELECT * FROM accommodation_items 
WHERE type IN ('D3', 'D6')
ORDER BY accommodation_id, item_id;