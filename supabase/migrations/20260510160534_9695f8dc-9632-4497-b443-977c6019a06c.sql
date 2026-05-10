
-- 1) Move social_auth_token to a strict owner-only table
CREATE TABLE IF NOT EXISTS public.user_secrets (
  user_id UUID PRIMARY KEY,
  social_auth_token TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own secrets" ON public.user_secrets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners can insert own secrets" ON public.user_secrets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update own secrets" ON public.user_secrets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners can delete own secrets" ON public.user_secrets
  FOR DELETE USING (auth.uid() = user_id);

-- Migrate existing tokens
INSERT INTO public.user_secrets (user_id, social_auth_token)
SELECT user_id, social_auth_token FROM public.profiles
WHERE social_auth_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET social_auth_token = EXCLUDED.social_auth_token;

-- Drop sensitive column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS social_auth_token;

-- 2) post-media bucket: enforce per-user folder ownership on writes; keep public read for posted assets
DROP POLICY IF EXISTS "Authenticated upload post-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update post-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete post-media" ON storage.objects;

CREATE POLICY "Users upload own post-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
  );
CREATE POLICY "Users update own post-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
  );
CREATE POLICY "Users delete own post-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
  );

-- 3) Align channel_posts INSERT policy with admin/manager scope
DROP POLICY IF EXISTS "Users can create own channel posts" ON public.channel_posts;
CREATE POLICY "Users can create own channel posts" ON public.channel_posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_channels cc
      JOIN public.campaigns c ON c.id = cc.campaign_id
      WHERE cc.id = channel_posts.campaign_channel_id
        AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_manager_of(auth.uid(), c.user_id))
    )
  );
