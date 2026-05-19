ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bundle_social_team_id TEXT;

ALTER TABLE public.channel_posts
  ADD COLUMN IF NOT EXISTS bundle_social_post_id TEXT,
  ADD COLUMN IF NOT EXISTS publish_error TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.idx_channel_posts_pending_publish;
CREATE INDEX idx_channel_posts_pending_publish
  ON public.channel_posts (status, scheduled_start)
  WHERE bundle_social_post_id IS NULL AND publish_error IS NULL;

COMMENT ON COLUMN public.profiles.bundle_social_team_id IS
  'Bundle.social team ID. Created via bundle-social-create-team edge function on client onboarding.';
COMMENT ON COLUMN public.channel_posts.bundle_social_post_id IS
  'Bundle.social post ID returned after successful publish. NULL means not yet published.';