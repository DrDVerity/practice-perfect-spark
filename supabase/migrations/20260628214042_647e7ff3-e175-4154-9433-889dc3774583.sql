ALTER TABLE public.channel_posts
  ADD COLUMN IF NOT EXISTS voiceover_script text,
  ADD COLUMN IF NOT EXISTS video_status text;