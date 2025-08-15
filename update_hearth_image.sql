-- Update The Hearth accommodation image URL to use Supabase storage
UPDATE accommodations 
SET image_url = 'https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/accommodations/photos/hearth.jpg'
WHERE id = '42015935-bc3e-4963-8191-c779fd69ef13'
  AND title = 'The Hearth';

-- Verify the update
SELECT id, title, image_url 
FROM accommodations 
WHERE id = '42015935-bc3e-4963-8191-c779fd69ef13';