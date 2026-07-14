
# Extend Agent Pipeline: Drip Series + Landing Page

Add two new phases to `run-campaign-agent` so a "Design it" campaign produces a complete asset set end-to-end, including per-channel drip messages and a client-branded landing page stored on the campaign itself.

## Current pipeline (recap)
```text
ensuring_kb → planning → writing_content → deriving_posts → writing_funnel → completed
```

## New pipeline
```text
ensuring_kb → planning → writing_content → deriving_posts → writing_funnel
            → writing_drips → building_landing_page → completed
```

## Phase 5 — `writing_drips`

**Goal:** For every Email or SMS channel already attached to the campaign, seed a default drip series so the user has drafts to Accept/Edit/Regenerate.

Behavior:
- Orchestrator queries `campaign_channels` where `channel_type in ('email','sms')`.
- For each channel: if no `campaign_drip_series` row exists yet, insert one with defaults (`series_length = 3`, `recipient_mode = 'existing'`, `recipient_config = {}`).
- Invoke new edge function `generate-drip-series` with `{ campaignId, channelId, seriesId }`.
- `generate-drip-series` (new):
  - Loads campaign context (name, focus, target_audience, strategy, blog article).
  - Respects `assets_accepted` — never overwrites an accepted series (`campaign_drip_series.accepted = true`).
  - Generates N messages one-by-one via OpenRouter. Email = `subject + body`; SMS = short `body` only.
  - Inserts into `campaign_drip_messages` with `status='draft'`, `accepted=false`, `sequence_no=1..N`.
- Non-fatal on individual channel failure.
- Skipped entirely if the campaign has no Email/SMS channels.

## Phase 6 — `building_landing_page`

**Goal:** Produce a robust, client-branded landing page and persist it **on the campaign** so it renders at `/landing/:id` via the existing `serve-landing-page` function. No KB copy is created.

Behavior:
- Orchestrator invokes existing `generate-landing-page` with `{ campaignId }` (extending it — see Technical Details).
- Respects `assets_accepted.landing_page` — if true, skip regeneration.
- Extension of `generate-landing-page`:
  1. Load brand guidelines from the client KB for the campaign's `location_id`. If missing, invoke `generate-brand-guidelines` first (Firecrawl grounded). Brand guidelines KB doc is only *read*, never written by this phase.
  2. Load `campaigns.blog_article`, extract H2s as "Highlights".
  3. Compose sections: Hero (logo + headline + primary CTA), Highlights, Offer/Benefits/Features, Social Proof placeholder, three repeating CTA bands (Schedule Appointment / Call for Pricing / Request Consultation).
  4. Render to HTML and write to `campaigns.landing_page_html` (already exists — served by `serve-landing-page/index.ts`).
  5. Set `campaigns.landing_page_url` to the public `/landing/:id` route so the UI has a canonical link.
- Non-fatal on failure.

Edits to the landing page happen on the campaign record itself (existing Landing Page card in `CampaignEditNew`), not through the KB.

## Orchestrator changes (`run-campaign-agent/index.ts`)
- After Phase 4, set `generation_status = 'writing_drips'`, run Phase 5.
- Then set `generation_status = 'building_landing_page'`, run Phase 6.
- Then `completed`.
- Both phases guarded so a rerun with accepted assets is a no-op for those assets.

## UI changes
- `GenerationProgress.tsx`: add labels for `writing_drips` ("Drafting drip messages…") and `building_landing_page` ("Building landing page…").
- `CampaignEditNew.tsx`: Landing Page card shows the `/landing/:id` link + Regenerate (disabled when `assets_accepted.landing_page` is true).

## Data model
No new tables — reuses `campaign_drip_series` and `campaign_drip_messages` (created earlier). One additive column on `campaigns`:
- `landing_page_url text` (canonical public URL; `landing_page_html` already exists).

`assets_accepted jsonb` gains a `landing_page` boolean key by convention (no schema change).

## Technical Details

**New file:** `supabase/functions/generate-drip-series/index.ts`
- Input: `{ campaignId, channelId, seriesId }`
- Auth: `requireAccess` from `_shared/campaign-agent.ts`
- Loop `sequence_no` 1..N, one OpenRouter call per message.
- Idempotent: deletes existing non-accepted drafts before regen; accepted messages preserved.

**Edited file:** `supabase/functions/generate-landing-page/index.ts`
- Add brand-guideline read (with fallback generation call).
- Structured section list → HTML string.
- Persist `landing_page_html` + `landing_page_url` on the campaign. No KB writes.

**Edited file:** `supabase/functions/run-campaign-agent/index.ts`
- Add Phase 5 + Phase 6 blocks after Phase 4. Wrapped in try/catch so campaign still reaches `completed`.

**Edited file:** `src/components/campaign/GenerationProgress.tsx`
- Extend the status → label map.

**Edited file:** `src/pages/CampaignEditNew.tsx`
- Landing Page card: show `/landing/:id` link + accept-aware Regenerate button.

**Migration:**
- `ALTER TABLE campaigns ADD COLUMN landing_page_url text;`

## Out of Scope
- Recipient list picker UI for drips (existing / new group / custom SQL). Defaults for now.
- Actual scheduled sending of drip email/SMS.
- Landing page A/B variants.
- Any KB document creation for the landing page.

## Order of operations
1. Migration: add `landing_page_url` column.
2. Create `generate-drip-series` edge function.
3. Extend `generate-landing-page` edge function.
4. Update `run-campaign-agent` orchestrator with Phase 5 + 6.
5. UI: `GenerationProgress` labels + `CampaignEditNew` landing card link.
6. Smoke test with one Email channel attached; verify pipeline reaches `completed` with drip drafts and a renderable `/landing/:id`.

Confirm and I'll implement in that order.
