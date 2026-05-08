-- Create private storage bucket for Knowledge Base file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kb-files',
  'kb-files',
  false,
  104857600, -- 100 MB
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects scoped to bucket 'kb-files'
-- Users can manage their own folder (folder name must equal their auth.uid())
CREATE POLICY "KB files: users can read own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kb-files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
    OR public.is_manager_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "KB files: users can upload own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kb-files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
    OR public.is_manager_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "KB files: users can update own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'kb-files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
    OR public.is_manager_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "KB files: users can delete own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kb-files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
    OR public.is_manager_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);