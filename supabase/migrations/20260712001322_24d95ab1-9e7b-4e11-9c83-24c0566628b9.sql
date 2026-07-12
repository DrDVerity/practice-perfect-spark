
-- Plan tier + trial fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_url_normalized text;

-- Normalized website URL on accounts (used to auto-group teammates)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS website_url_normalized text;

CREATE INDEX IF NOT EXISTS idx_accounts_website_url_normalized
  ON public.accounts (website_url_normalized)
  WHERE website_url_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_website_url_normalized
  ON public.profiles (website_url_normalized)
  WHERE website_url_normalized IS NOT NULL;

-- Strategy PDF + approval status columns on campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS strategy_pdf_url text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required';
-- values: not_required | pending | approved | rejected

-- ============ 14-day nurture queue ============
CREATE TABLE IF NOT EXISTS public.subscriber_nurture_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  template_key text NOT NULL,
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriber_nurture_emails TO authenticated;
GRANT ALL ON public.subscriber_nurture_emails TO service_role;
ALTER TABLE public.subscriber_nurture_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own nurture queue" ON public.subscriber_nurture_emails
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_nurture_due
  ON public.subscriber_nurture_emails (send_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

-- ============ Approval requests ============
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  account_id uuid,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL, -- 'budget' | 'strategy'
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  summary text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account members view approvals" ON public.approval_requests
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR (account_id IS NOT NULL AND public.is_account_member(auth.uid(), account_id))
    OR requested_by = auth.uid()
  );
CREATE POLICY "members request approval" ON public.approval_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by
  );
CREATE POLICY "owners/managers decide approvals" ON public.approval_requests
  FOR UPDATE USING (
    public.is_admin(auth.uid())
    OR (account_id IS NOT NULL AND public.is_account_owner(auth.uid(), account_id))
    OR public.is_manager(auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_approvals_campaign ON public.approval_requests (campaign_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approval_requests (status);

CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ URL normalization helper + auto-grouping ============
CREATE OR REPLACE FUNCTION public.normalize_website_url(_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(_url, ''))), '^https?://', ''),
        '^www\.', ''
      ),
      '[/?#].*$', ''
    ),
    ''
  );
$$;

-- Auto-populate profiles.website_url_normalized on insert/update.
CREATE OR REPLACE FUNCTION public.profiles_set_website_normalized()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.website_url_normalized := public.normalize_website_url(NEW.website_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_normalize_url ON public.profiles;
CREATE TRIGGER profiles_normalize_url
  BEFORE INSERT OR UPDATE OF website_url ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_website_normalized();

-- Backfill existing rows
UPDATE public.profiles
SET website_url_normalized = public.normalize_website_url(website_url)
WHERE website_url IS NOT NULL AND website_url_normalized IS NULL;
