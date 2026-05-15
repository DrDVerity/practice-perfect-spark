-- Migration A: Ayrshare agency integration
-- Adds ayrshare_profile_id to profiles so each client maps to one Ayrshare sub-profile.
-- The master AYRSHARE_API_KEY lives in Supabase Edge Function secrets — never in the DB.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ayrshare_profile_id TEXT;

COMMENT ON COLUMN public.profiles.ayrshare_profile_id IS
  'Ayrshare sub-profile key for this client. Created via ayrshare-create-profile edge function on client onboarding.';
