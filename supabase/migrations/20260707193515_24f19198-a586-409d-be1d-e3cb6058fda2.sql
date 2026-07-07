
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS blog_title text,
  ADD COLUMN IF NOT EXISTS short_video_url text,
  ADD COLUMN IF NOT EXISTS target_market_refined text,
  ADD COLUMN IF NOT EXISTS psychological_approach text,
  ADD COLUMN IF NOT EXISTS plan_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plan_inputs_hash text,
  ADD COLUMN IF NOT EXISTS assets_accepted jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS blog_article text,
  ADD COLUMN IF NOT EXISTS youtube_script text,
  ADD COLUMN IF NOT EXISTS content_topic text,
  ADD COLUMN IF NOT EXISTS topic_source text;
