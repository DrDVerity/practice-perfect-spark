-- Make kb-files bucket public so images uploaded to KB can render directly via getPublicUrl()
UPDATE storage.buckets SET public = true WHERE id = 'kb-files';

-- Add a public read policy so anyone can render uploaded marketing images by URL
DROP POLICY IF EXISTS "KB files: public read" ON storage.objects;
CREATE POLICY "KB files: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'kb-files');