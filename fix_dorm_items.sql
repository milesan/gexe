-- Delete the duplicate dorm items with size='1' (these are incorrect)
DELETE FROM accommodation_items 
WHERE type IN ('D3', 'D6') 
AND size = '1';

-- Verify what's left
SELECT * FROM accommodation_items 
WHERE type IN ('D3', 'D6')
ORDER BY accommodation_id, item_id;