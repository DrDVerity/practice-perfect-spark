ALTER TABLE public.campaign_addons
  ADD COLUMN IF NOT EXISTS custom_label text,
  ADD COLUMN IF NOT EXISTS custom_icon  text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS budget_target numeric;