-- Migration B: Ayrshare publish tracking on channel_posts
-- Tracks the result of each publish attempt so the UI can show real status.

ALTER TABLE public.channel_posts
  ADD COLUMN IF NOT EXISTS ayrshare_post_id  TEXT,
  ADD COLUMN IF NOT EXISTS publish_error     TEXT,
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ;

-- Index so the cron query (status='scheduled' AND scheduled_start <= now() AND ayrshare_post_id IS NULL)
-- stays fast even at scale.
CREATE INDEX IF NOT EXISTS idx_channel_posts_pending_publish
  ON public.channel_posts (status, scheduled_start)
  WHERE ayrshare_post_id IS NULL AND publish_error IS NULL;

COMMENT ON COLUMN public.channel_posts.ayrshare_post_id IS
  'Ayrshare post ID returned after successful publish. NULL means not yet published.';
COMMENT ON COLUMN public.channel_posts.publish_error IS
  'Error message from last failed publish attempt. Reset to NULL on retry.';
COMMENT ON COLUMN public.channel_posts.published_at IS
  'Timestamp when Ayrshare confirmed the post was submitted.';
