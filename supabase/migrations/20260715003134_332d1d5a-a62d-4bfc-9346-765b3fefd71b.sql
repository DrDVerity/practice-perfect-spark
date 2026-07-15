-- 1. Per-post acceptance
ALTER TABLE public.channel_posts
  ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;

-- 2. Email distribution list link on channel
ALTER TABLE public.campaign_channels
  ADD COLUMN IF NOT EXISTS distribution_list_id UUID;

-- 3. Distribution lists table
CREATE TABLE IF NOT EXISTS public.email_distribution_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id UUID,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('existing','import','pms')),
  row_count INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT,
  pms_query TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_distribution_lists TO authenticated;
GRANT ALL ON public.email_distribution_lists TO service_role;

ALTER TABLE public.email_distribution_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their distribution lists"
  ON public.email_distribution_lists
  FOR ALL
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_email_distribution_lists_updated_at
  BEFORE UPDATE ON public.email_distribution_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();