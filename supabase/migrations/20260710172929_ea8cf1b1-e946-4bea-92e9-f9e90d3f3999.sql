
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS step_plan JSONB,
  ADD COLUMN IF NOT EXISTS strategy_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS article_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posts_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS funnel_accepted BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.campaign_email_funnel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  body_html TEXT NOT NULL,
  send_offset_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, order_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_email_funnel TO authenticated;
GRANT ALL ON public.campaign_email_funnel TO service_role;

ALTER TABLE public.campaign_email_funnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view funnel by campaign access"
  ON public.campaign_email_funnel FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_email_funnel.campaign_id
      AND (public.is_admin(auth.uid())
           OR public.is_location_member(auth.uid(), c.location_id)
           OR public.is_manager_of(auth.uid(), c.user_id))
  ));

CREATE POLICY "insert funnel by campaign access"
  ON public.campaign_email_funnel FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_email_funnel.campaign_id
      AND (public.is_admin(auth.uid())
           OR public.is_location_member(auth.uid(), c.location_id)
           OR public.is_manager_of(auth.uid(), c.user_id))
  ));

CREATE POLICY "update funnel by campaign access"
  ON public.campaign_email_funnel FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_email_funnel.campaign_id
      AND (public.is_admin(auth.uid())
           OR public.is_location_member(auth.uid(), c.location_id)
           OR public.is_manager_of(auth.uid(), c.user_id))
  ));

CREATE POLICY "delete funnel by campaign access"
  ON public.campaign_email_funnel FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_email_funnel.campaign_id
      AND (public.is_admin(auth.uid())
           OR public.is_location_member(auth.uid(), c.location_id)
           OR public.is_manager_of(auth.uid(), c.user_id))
  ));

CREATE TRIGGER update_campaign_email_funnel_updated_at
  BEFORE UPDATE ON public.campaign_email_funnel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
