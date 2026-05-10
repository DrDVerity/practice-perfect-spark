INSERT INTO public.knowledge_base (user_id, title, doc_type, content, metadata)
SELECT 'c8b15039-62dc-4858-bec1-8cd00860e9ed'::uuid,
       'Zirtibsr1.png',
       'custom'::kb_document_type,
       '[Uploaded image: Zirtibsr1.png]\n\nStored in Knowledge Base for AI use.',
       jsonb_build_object(
         'uploaded', true,
         'file_kind', 'image',
         'mime_type', 'image/png',
         'storage_path', 'c8b15039-62dc-4858-bec1-8cd00860e9ed/1156e9da-af48-4bcc-967a-ba3080f9b5bf-Zirtibsr1.png',
         'file_url', 'https://ljboxfiejgaedpexxcdd.supabase.co/storage/v1/object/public/kb-files/c8b15039-62dc-4858-bec1-8cd00860e9ed/1156e9da-af48-4bcc-967a-ba3080f9b5bf-Zirtibsr1.png'
       )
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_base WHERE metadata->>'storage_path' = 'c8b15039-62dc-4858-bec1-8cd00860e9ed/1156e9da-af48-4bcc-967a-ba3080f9b5bf-Zirtibsr1.png'
);