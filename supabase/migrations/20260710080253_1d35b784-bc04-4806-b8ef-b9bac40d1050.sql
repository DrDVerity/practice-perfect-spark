CREATE TABLE public.landing_page_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_page_leads_campaign ON public.landing_page_leads(campaign_id);
CREATE INDEX idx_landing_page_leads_account ON public.landing_page_leads(account_id);

GRANT INSERT ON public.landing_page_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_leads TO authenticated;
GRANT ALL ON public.landing_page_leads TO service_role;

ALTER TABLE public.landing_page_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.landing_page_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Account members can view leads"
  ON public.landing_page_leads
  FOR SELECT
  TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Account members can update leads"
  ON public.landing_page_leads
  FOR UPDATE
  TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Account members can delete leads"
  ON public.landing_page_leads
  FOR DELETE
  TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));