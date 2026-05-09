-- Add landing_page_url to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS landing_page_url TEXT;

-- Create public bucket for AI-generated landing pages
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-pages', 'landing-pages', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read landing pages (they're public marketing pages)
DROP POLICY IF EXISTS "Landing pages are publicly readable" ON storage.objects;
CREATE POLICY "Landing pages are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-pages');

-- Authenticated users can create landing pages in a folder named with their user id
DROP POLICY IF EXISTS "Users can upload own landing pages" ON storage.objects;
CREATE POLICY "Users can upload own landing pages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'landing-pages' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own landing pages" ON storage.objects;
CREATE POLICY "Users can update own landing pages"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'landing-pages' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own landing pages" ON storage.objects;
CREATE POLICY "Users can delete own landing pages"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'landing-pages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins / managers full access on landing pages
DROP POLICY IF EXISTS "Admins manage all landing pages" ON storage.objects;
CREATE POLICY "Admins manage all landing pages"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'landing-pages' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'landing-pages' AND public.is_admin(auth.uid()));