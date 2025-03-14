-- Create email-assets bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Disable RLS for the bucket to allow public access
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY WHERE bucket_id = 'email-assets';

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload email assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-assets');

-- Create policy for public read access
CREATE POLICY "Public read access for email assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'email-assets'); 