-- Track automatic onboarding research-report generation on each practice profile.
-- Status lifecycle: pending -> running -> complete | error
-- 'awaiting_social' means the website is set but no social accounts are connected yet.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_reports_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_reports_total int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_reports_done int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_reports_error text,
  ADD COLUMN IF NOT EXISTS onboarding_reports_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_reports_completed_at timestamptz;
