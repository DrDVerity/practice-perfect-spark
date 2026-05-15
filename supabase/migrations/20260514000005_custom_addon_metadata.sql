-- Migration E: Persist custom addon display metadata
--
-- Custom vectors added via AddCustomAddonDialog currently store only addon_type.
-- Their label and icon emoji live only in React state and are lost on refresh.
-- This migration adds columns to campaign_addons so the full definition is stored.

ALTER TABLE public.campaign_addons
  ADD COLUMN IF NOT EXISTS custom_label TEXT,
  ADD COLUMN IF NOT EXISTS custom_icon  TEXT;   -- single emoji or short icon code

COMMENT ON COLUMN public.campaign_addons.custom_label IS
  'Display label for custom (non-standard) addons. NULL for built-in addon types.';
COMMENT ON COLUMN public.campaign_addons.custom_icon IS
  'Emoji icon for custom addons, e.g. "📧". NULL for built-in addon types.';
