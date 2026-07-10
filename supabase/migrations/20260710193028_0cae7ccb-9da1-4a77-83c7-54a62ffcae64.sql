
CREATE TABLE public.prospect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  practice_name text,
  website_url text,
  campaign_focus text,
  target_audience text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  converted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.prospect_accounts TO service_role;
ALTER TABLE public.prospect_accounts ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge functions) can access.

CREATE TABLE public.prospect_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospect_accounts(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, doc_type)
);
GRANT ALL ON public.prospect_reports TO service_role;
ALTER TABLE public.prospect_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.prospect_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospect_accounts(id) ON DELETE CASCADE,
  blog_title text,
  blog_html text,
  hero_image_url text,
  illustrations jsonb NOT NULL DEFAULT '[]'::jsonb,
  posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  email_funnel jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.prospect_campaigns TO service_role;
ALTER TABLE public.prospect_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_prospect_accounts_updated_at
  BEFORE UPDATE ON public.prospect_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_prospect_reports_updated_at
  BEFORE UPDATE ON public.prospect_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_prospect_campaigns_updated_at
  BEFORE UPDATE ON public.prospect_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_prospect_reports_prospect ON public.prospect_reports(prospect_id);
CREATE INDEX idx_prospect_campaigns_prospect ON public.prospect_campaigns(prospect_id);
CREATE INDEX idx_prospect_accounts_email ON public.prospect_accounts(lower(email));
