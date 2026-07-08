ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS target_audience text;