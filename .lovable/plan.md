# Why no assets are generating

Two distinct failure modes are happening, depending on the campaign:

1. **Current campaign `Zirtibar` (93ff2fdc…) has 0 channels.**
   `acceptPlanAndGenerate` calls `generate-campaign-content`, which sees no `campaign_channels` rows and returns the early "strategy accepted, no posts generated" branch. UI then says "0 posts created." Nothing for it to generate against.

2. **Campaigns with channels (e.g. `fed454f6…` — 3 channels: linkedin, instagram, internal_email) still show 0 posts.**
   The edge function generates content **sequentially**: for each channel it calls Gemini for text, then for **every post** calls Gemini image-gen, then inserts. With 3 channels × ~6 posts × image gen, the function exceeds the edge runtime CPU/wall budget and is terminated before any `channel_posts` rows are inserted. Errors are swallowed by per-channel try/catch and never reach the client (logs only show boot/shutdown, no console output).

There is also no real **email funnel** generation — `internal_email` is just treated as another "post" channel.

# Plan

## 1. Don't accept against an empty channel list (frontend)
In `src/pages/CampaignEditNew.tsx` `acceptPlanAndGenerate`:
- If `campaign.campaign_channels.length === 0`, auto-create a sensible default set inferred from the strategy: LinkedIn (social_media), Instagram (social_media), and Internal Email (email). If we cannot infer, show a blocking toast asking the user to add at least one channel before accepting, and surface the channel picker.
- Only after channels exist, kick off generation.

## 2. Convert `generate-campaign-content` to an async background job
In `supabase/functions/generate-campaign-content/index.ts`:
- After auth + authorization checks, set `campaigns.status = 'scheduled'` and a new `generation_status = 'processing'` field, then return `202 { jobStarted: true }` immediately.
- Move the per-channel loop inside `EdgeRuntime.waitUntil(...)` so it runs after the response is sent and isn't bound by the request timeout.
- On completion, write `generation_status = 'completed'` (or `'failed'` with `generation_error`) on the campaign row.

Migration: add nullable columns `generation_status text` and `generation_error text` to `campaigns`.

## 3. Insert posts first, generate images after (resilience + speed)
Inside the background job:
- For each channel, generate text variations, then **bulk-insert** all `channel_posts` rows with `image_url = null` and `status = 'draft'`.
- After all rows are inserted, fan out image generation **in parallel** (`Promise.allSettled`) and `update` each row's `image_url` as it returns. A failed image no longer blocks any post from existing.
- Run channels in parallel with `Promise.allSettled` instead of sequential `for…of`.

## 4. Real email funnel for `channel_type = 'email'`
When a channel's `channel_type` is `email` (or platform is `internal_email`/`email`), call the model with an email-funnel system prompt that returns a 5-step sequence: Welcome → Value → Social Proof → Offer → Reminder. Each step becomes one `channel_posts` row with a `scheduled_offset_days` spaced across the campaign. Subject line goes into `title`, body into `text_content`. No image generation for email steps unless the prompt explicitly requests one.

## 5. UI: live generation status
In `CampaignEditNew.tsx`:
- After invoking the function, read `generation_status` on the campaign row. Show a non-blocking banner ("Generating campaign assets…") while `processing`, success toast + auto-refetch when `completed`, and an error banner with retry when `failed`.
- Poll `campaigns` every 4s (or use Realtime on `campaigns`) until status leaves `processing`, then stop.
- Add a "Regenerate assets" button that re-runs the job for an already-accepted campaign.

## 6. Verification
- Accept on `Zirtibar` (0 channels): UI now creates default channels then triggers generation; posts appear within ~30–60s.
- Accept on `fed454f6` (3 channels): function returns 202 instantly; banner shows processing; LinkedIn + Instagram posts and a 5-step email funnel populate; failed images don't block post creation.
- Edge logs show per-channel progress messages and a final "completed" entry.

## Technical details
- New campaign columns: `generation_status text`, `generation_error text` (nullable, no default change).
- `EdgeRuntime.waitUntil` is required so the function process isn't reaped after the 202 response.
- Uses the existing service-role Supabase client inside the background task — RLS not in the way.
- Image-gen concurrency capped (e.g. 4 in flight) to avoid AI gateway rate limits.
- No changes to `serve-landing-page` or the landing-page flow.
