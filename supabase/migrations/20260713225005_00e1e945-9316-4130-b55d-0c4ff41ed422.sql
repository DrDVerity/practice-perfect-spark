
-- Per-post accept flag
ALTER TABLE public.channel_posts
  ADD COLUMN IF NOT EXISTS accepted boolean NOT NULL DEFAULT false;

-- Message attachments (links to PDFs, deep links, etc.)
ALTER TABLE public.campaign_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Drip series (email or SMS)
CREATE TABLE IF NOT EXISTS public.campaign_drip_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.campaign_channels(id) ON DELETE SET NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('email','sms')),
  recipient_mode text NOT NULL DEFAULT 'existing' CHECK (recipient_mode IN ('existing','new_group','custom_sql')),
  recipient_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  series_length int NOT NULL DEFAULT 3 CHECK (series_length BETWEEN 1 AND 20),
  complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_drip_series TO authenticated;
GRANT ALL ON public.campaign_drip_series TO service_role;
ALTER TABLE public.campaign_drip_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drip_series_owner_all" ON public.campaign_drip_series
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));

CREATE POLICY "drip_series_manager_read" ON public.campaign_drip_series
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.is_manager_of(auth.uid(), c.user_id)
  ));

CREATE POLICY "drip_series_admin_all" ON public.campaign_drip_series
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.campaign_drip_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.campaign_drip_series(id) ON DELETE CASCADE,
  sequence_no int NOT NULL,
  subject text,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','accepted','deleted')),
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, sequence_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_drip_messages TO authenticated;
GRANT ALL ON public.campaign_drip_messages TO service_role;
ALTER TABLE public.campaign_drip_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drip_msg_owner_all" ON public.campaign_drip_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_drip_series s
    JOIN public.campaigns c ON c.id = s.campaign_id
    WHERE s.id = series_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaign_drip_series s
    JOIN public.campaigns c ON c.id = s.campaign_id
    WHERE s.id = series_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "drip_msg_manager_read" ON public.campaign_drip_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_drip_series s
    JOIN public.campaigns c ON c.id = s.campaign_id
    WHERE s.id = series_id AND public.is_manager_of(auth.uid(), c.user_id)
  ));

CREATE POLICY "drip_msg_admin_all" ON public.campaign_drip_messages
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_drip_series_updated
  BEFORE UPDATE ON public.campaign_drip_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_drip_msg_updated
  BEFORE UPDATE ON public.campaign_drip_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
