ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS duration_value integer,
  ADD COLUMN IF NOT EXISTS duration_unit text CHECK (duration_unit IN ('days','weeks','months')),
  ADD COLUMN IF NOT EXISTS start_date date;