-- Add file_storage_bucket column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'application_questions' 
        AND column_name = 'file_storage_bucket'
    ) THEN
        ALTER TABLE application_questions 
        ADD COLUMN file_storage_bucket VARCHAR;
    END IF;
END $$;

-- Update existing file-type questions
UPDATE application_questions 
SET file_storage_bucket = 'application-photos'
WHERE type = 'file' AND (file_storage_bucket IS NULL OR file_storage_bucket = '');

-- Create or update storage bucket to be public
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-photos', 'application-photos', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Disable RLS for the bucket
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Just in case, clean up any existing policies
DROP POLICY IF EXISTS "Anyone can view application photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload application photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload application photos" ON storage.objects;
