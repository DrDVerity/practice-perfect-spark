
ALTER TABLE public.campaign_email_funnel ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.campaign_addons ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;
