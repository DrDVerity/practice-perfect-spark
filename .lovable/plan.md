## Problem

Campaign `9117997b…` has an email channel (`internal_email`) but 0 posts. LinkedIn also has 0 posts, while Facebook/Instagram have 4 each with images.

**Root cause:** `supabase/functions/generate-campaign-content/index.ts` (lines 568–583) has a campaign-wide guard: if *any* post on *any* channel already has an `image_url`, the whole run exits early. Once Facebook/Instagram posts were generated with images, every subsequent re-run to fill in the email/LinkedIn channels bailed out without generating anything for those channels. The email-generation logic itself (`deriveEmailFunnel`) is fine and does not depend on a distribution list.

## Changes

### 1. Fix email-post generation (backend)
`supabase/functions/generate-campaign-content/index.ts`
- Make the "already has images" guard **per-channel** instead of campaign-wide. Before generating a channel, skip only that channel if it already has posts with images (respecting `force` and `replaceDrafts`). Empty channels always get generated.
- Redeploy `generate-campaign-content`.

### 2. Auto-fill missing channels
`src/pages/CampaignEditNew.tsx` (channel selection / post-agent effect) — when the user adds an email channel to an already-generated campaign, invoke `generate-campaign-content` with that `channelId` so posts are produced immediately, matching current behavior for other channel types.

### 3. Rename "Email" → "Patient Email"
Only the user-facing label for the internal patient-broadcast email channel. Do not touch the landing-page lead-nurture funnel copy.
- `src/pages/CampaignEditNew.tsx` line 605: channel picker card label.
- `src/components/campaign/CampaignBudgetDialog.tsx` line 51: `internal_email` label → "Patient Email".
- Any headings on ChannelEdit / CampaignDashboardSection that render the `internal_email` platform label.
- `channel_type` value stays `email` in the DB — display-only change.

### 4. "General email list" test option
`src/components/channel/EmailDistributionSelector.tsx`
- Add a new dropdown entry `__general__` labeled **"General email list (test only)"** with a helper caption "Assume a general list exists for previewing posts. A real list must be attached before publishing."
- Selecting it writes a sentinel value into `campaign_channels.distribution_list_id` — use the literal string `'general-test'` stored in a new column `distribution_list_mode` (text, nullable) to avoid breaking the FK. Migration: add `distribution_list_mode text` to `campaign_channels`; when set to `'general_test'`, `distribution_list_id` stays null.
- Show a visible amber badge on the channel card ("Test list — replace before publish") whenever `distribution_list_mode = 'general_test'`.

### 5. Preflight + acceptance gate
`supabase/functions/publish-campaign-preflight/index.ts`
- For every email channel, require either a real `distribution_list_id` OR block publish when `distribution_list_mode = 'general_test'`. Add a failing check "Patient Email channel needs a real distribution list before publishing."
- Redeploy.
- `AcceptSectionButton` / channel accept flow: block accepting the email channel while it is on the general test list (surface the same message inline).

### 6. Backfill the current campaign
After deploy, trigger `generate-campaign-content` with `{ campaignId: '9117997b…', channelId: '50d91792…' }` (email) and `{ channelId: '85242f18…' }` (LinkedIn) so their posts populate.

## Out of scope
- No changes to the landing-page nurture funnel (`generate-email-funnel`).
- No changes to auth, RLS, or Bundle.social integration.
- Image regeneration remains manual.
