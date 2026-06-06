ALTER TYPE public.kb_document_type ADD VALUE IF NOT EXISTS 'reputation_sentiment';
ALTER TYPE public.kb_document_type ADD VALUE IF NOT EXISTS 'social_media';
ALTER TYPE public.kb_document_type ADD VALUE IF NOT EXISTS 'business_dna';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_reports_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_reports_total int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_reports_done int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_reports_error text,
  ADD COLUMN IF NOT EXISTS onboarding_reports_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_reports_completed_at timestamptz;