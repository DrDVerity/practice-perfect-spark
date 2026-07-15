
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avg_patient_value_general numeric NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS avg_patient_value_allonx numeric NOT NULL DEFAULT 25000;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_hero_url text;

CREATE INDEX IF NOT EXISTS idx_campaigns_is_test ON public.campaigns(is_test) WHERE is_test = true;

-- Helper: derive account_id for a campaign via its location (or user's account) 
CREATE OR REPLACE FUNCTION public.account_id_for_campaign(_campaign_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT l.account_id FROM public.campaigns c
       JOIN public.locations l ON l.id = c.location_id
      WHERE c.id = _campaign_id),
    (SELECT p.account_id FROM public.campaigns c
       JOIN public.profiles p ON p.user_id = c.user_id
      WHERE c.id = _campaign_id)
  )
$$;

CREATE TABLE IF NOT EXISTS public.campaign_daily_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.campaign_channels(id) ON DELETE SET NULL,
  platform text NOT NULL,
  date date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  appointments integer NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, platform, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_daily_metrics TO authenticated;
GRANT ALL ON public.campaign_daily_metrics TO service_role;
ALTER TABLE public.campaign_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view metrics" ON public.campaign_daily_metrics FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));
CREATE POLICY "Members insert metrics" ON public.campaign_daily_metrics FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));
CREATE POLICY "Members update metrics" ON public.campaign_daily_metrics FOR UPDATE TO authenticated
  USING (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));
CREATE POLICY "Members delete metrics" ON public.campaign_daily_metrics FOR DELETE TO authenticated
  USING (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));

CREATE INDEX IF NOT EXISTS idx_cdm_campaign_date ON public.campaign_daily_metrics(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_cdm_is_test ON public.campaign_daily_metrics(is_test) WHERE is_test = true;
CREATE TRIGGER update_cdm_updated_at BEFORE UPDATE ON public.campaign_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.campaign_financials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  month date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  new_patients integer NOT NULL DEFAULT 0,
  avg_patient_value numeric NOT NULL DEFAULT 2500,
  revenue numeric NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_financials TO authenticated;
GRANT ALL ON public.campaign_financials TO service_role;
ALTER TABLE public.campaign_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view financials" ON public.campaign_financials FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));
CREATE POLICY "Members insert financials" ON public.campaign_financials FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));
CREATE POLICY "Members update financials" ON public.campaign_financials FOR UPDATE TO authenticated
  USING (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));
CREATE POLICY "Members delete financials" ON public.campaign_financials FOR DELETE TO authenticated
  USING (public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id)));

CREATE INDEX IF NOT EXISTS idx_cf_campaign_month ON public.campaign_financials(campaign_id, month);
CREATE INDEX IF NOT EXISTS idx_cf_is_test ON public.campaign_financials(is_test) WHERE is_test = true;
CREATE TRIGGER update_cf_updated_at BEFORE UPDATE ON public.campaign_financials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
