
CREATE TABLE public.weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  pdf_url TEXT NOT NULL,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, week_start)
);

CREATE INDEX idx_weekly_reports_account_week ON public.weekly_reports(account_id, week_start DESC);

GRANT SELECT ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and admins view weekly reports"
  ON public.weekly_reports FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR is_account_member(auth.uid(), account_id)
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = weekly_reports.account_id
        AND is_manager_of(auth.uid(), a.owner_user_id)
    )
  );

CREATE TRIGGER update_weekly_reports_updated_at
  BEFORE UPDATE ON public.weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
