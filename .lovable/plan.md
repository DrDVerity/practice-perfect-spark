## Goal

Rework the "Create New Campaign" workflow so filling the form kicks off an autonomous agent that: pulls context from the KB, builds a strategic plan, writes a full blog article with hero image, derives platform-specific social posts + a short video, saves everything to the campaign for review, keeps the plan in sync when the user edits parameters, and gates Publish behind a completeness check before handing off to Bundle.social.

The Campaign Agent chat itself is out of scope for this pass — we only wire the pipeline.

## User-facing flow

1. Dashboard → **New Campaign** → existing dialog (name, focus, budget, duration). "Campaign Agent (AI design)" becomes the default primary action; "I'll design it myself" and "Reuse" remain.
2. On submit (agent mode): create campaign row, seed budget, then immediately navigate to `/campaign/:id` with a new **Generation Progress** overlay showing the live steps:
   - Reading knowledge base…
   - Refining target market & psychographic profile…
   - Building strategic plan…
   - Writing blog article + hero image…
   - Deriving social posts, short video, email & SMS variants…
   - Ready for review.
3. When done, the campaign screen shows: strategic plan, blog article (with hero image + title, first paragraph highlighted), per-channel post drafts, budget allocation, schedule. Every asset has an **Accept** control. Nothing is auto-published.
4. Editing any parameter (budget total, add/remove channel or add-on, change dates, change focus) triggers a **"Plan out of sync — Refresh strategic plan"** banner with a one-click re-run that regenerates only the plan + budget allocations, preserving accepted assets.
5. **Publish Campaign** button runs a preflight check; only enables handoff to Bundle.social when it passes.

## Backend changes

### DB migration
Add nullable columns to `campaigns`:
- `hero_image_url text`
- `blog_title text`
- `short_video_url text`
- `target_market_refined text` (JSON string of augmented persona/psychographic profile)
- `psychological_approach text`
- `plan_version int default 1`
- `plan_inputs_hash text` (hash of {budget, channels, addons, focus, dates}) — used to detect drift
- `assets_accepted jsonb default '{}'` (e.g. `{ "strategy": true, "blog": false, "posts": {"<post_id>": true} }`)

Grants + RLS follow existing `campaigns` policies (no new tables).

### New edge function: `generate-strategic-plan`
Inputs: `campaignId`. Auth: owner / admin / assigned manager (mirror `generate-content-hub`).
Steps:
1. Load campaign, profile, budget, channels, add-ons, KB (profile + market_analysis + audience_analysis + brand_guidelines + platform posting rules + campaign-focus-tagged custom docs).
2. Ask AI (Gemini 2.5 Pro) to:
   - Augment target market + psychographic profile (writes back to `target_market_refined`).
   - Pick a psychological approach (writes back to `psychological_approach`).
   - Produce the strategic plan markdown → `campaigns.strategy`.
   - Produce a budget allocation across channels + add-ons → `campaign_budgets.allocations` (does NOT flip `accepted`).
3. Update `plan_version++` and `plan_inputs_hash`, set `generation_status='plan_ready'`.

### Refactor `generate-content-hub`
- Drop the "pickSuggestion" branch's UI role in the new autonomous flow (function still supports it for the existing Content Hub dialog).
- New autonomous mode: reads refined target market + psychological approach from the campaign and produces:
  - Eye-popping **blog title** → `blog_title`
  - 1000-1500 word **blog article** with H2/H3, first-paragraph hook, stats/quotes/illustration prompts, single CTA → `blog_article` (raise word target from 800-1200).
  - Hero image (generate via `generate-post-image` style call, upload to `post-media` bucket) → `hero_image_url`.
  - YouTube script → `youtube_script` (kept).
  - Set `generation_status='content_ready'`.

### Refactor `generate-campaign-content`
Add:
- Extract 3-5 **short-segment posts per social platform** from the blog (already partially there — tighten prompt to dissect specific blog segments and reference `psychological_approach`).
- Generate a **30-second short video** for the primary social channel from the blog highlights, saved on the video-suitable channel's first post (`video_url`) — use existing `generate-video` function; fall back to hero image if video fails.
- Continue email funnel + SMS derivation.
- Do NOT set anything to `scheduled` — leave posts as `draft` pending user accept.
- Final status: `generation_status='completed'`.

### Orchestrator: `run-campaign-agent`
New edge function that chains the three steps in the background (single `EdgeRuntime.waitUntil` chain) so the client only makes one call after campaign creation. Updates `generation_status` at each phase (`planning` → `plan_ready` → `writing_content` → `content_ready` → `deriving_posts` → `completed` / `failed`). Idempotent per `plan_inputs_hash`.

### New edge function: `refresh-strategic-plan`
Recomputes plan + budget allocations only (skips blog/posts). Called from the "Refresh strategic plan" banner. Preserves accepted posts.

### New edge function: `publish-campaign-preflight`
Runs server-side:
- Strategy present & accepted.
- Blog article + hero image + title present & accepted.
- Every campaign channel has ≥1 post, each with non-empty text and (for social/video channels) an image or video URL.
- Post scheduled_start within campaign start/end range; per-channel post counts respect campaign duration (min 1, sane cadence).
- Campaign `start_date` and `end_date` set; `end_date > start_date` and `start_date >= today` (unless already active).
- Budget accepted and allocations sum to total.
- Bundle.social team + at least one connected social profile for every social channel present.
Returns `{ ok: boolean, checks: [{name, ok, message}] }`.

### `publish-campaign` edge function
On preflight pass:
- Mark posts as `scheduled`.
- Call existing `bundle-social-publish-post` for each social post at its `scheduled_start`, or enqueue via `bundle-social-cron-publish`.
- Set `campaigns.status='scheduled'`.

## Frontend changes

### `CreateCampaignDialog`
- Make "Campaign Agent" the visually primary button. Reword copy: "The agent will build your strategic plan, blog, and posts."
- No other behavior change to the dialog itself.

### `Dashboard.handleCreateCampaign`
- After inserting campaign + budget: if `mode === 'agent'`, call `run-campaign-agent` (invoke, non-blocking) and navigate to `/campaign/:id?generating=1`.

### `CampaignEditNew`
- Detect `?generating=1` OR `generation_status in (planning|writing_content|deriving_posts|content_ready|plan_ready)` → show a full-screen `GenerationProgress` overlay with the phase list (existing polling logic already refetches every 4s; extend to the new statuses).
- When `generation_status='completed'`, dismiss overlay.
- Add **Blog Article panel** at top of the review area:
  - Hero image, `blog_title` (large), first paragraph highlighted, rest of markdown.
  - Accept / Edit / Regenerate controls; writes `assets_accepted.blog`.
- Add **Strategic Plan panel** with Accept/Edit/Regenerate controls (persists `assets_accepted.strategy`).
- Per-post Accept toggle in the existing channel post cards (writes `assets_accepted.posts[id]`).
- **Plan-drift banner**: compute current inputs hash on the client, compare against `plan_inputs_hash`; when different, show banner with "Refresh strategic plan" button → calls `refresh-strategic-plan`.
- **Publish button**:
  - Calls `publish-campaign-preflight` first.
  - Opens a checklist modal showing pass/fail per check with jump-to links.
  - "Publish now" button enabled only when all pass; calls `publish-campaign`.

### New components
- `src/components/campaign/GenerationProgress.tsx` — phase list overlay driven by `generation_status`.
- `src/components/campaign/BlogArticlePanel.tsx` — hero + title + markdown + accept controls.
- `src/components/campaign/PublishPreflightDialog.tsx` — checklist modal.
- `src/components/campaign/PlanDriftBanner.tsx`.

### Hooks
- Extend `useCampaignsNew` with `assets_accepted`, `hero_image_url`, `blog_title`, `plan_inputs_hash`, `plan_version` typing helpers.
- New `useCampaignAgent` hook exposing `runAgent(campaignId)`, `refreshPlan(campaignId)`, `preflight(campaignId)`, `publish(campaignId)`.

## Out of scope (deferred)
- Redesigning the Campaign Agent chat UI itself.
- Analytics / performance feedback loop from Bundle.social results.
- OAuth migration for `channel_credentials` (existing pre-prod TODO).

## Technical notes
- All AI calls remain OpenRouter (`google/gemini-2.5-pro` for plan + blog; `google/gemini-2.5-flash` for post derivation) per existing project pattern.
- Hero image + short video use the existing `generate-post-image` / `generate-video` edge functions and upload to the `post-media` bucket.
- Preflight and publish run server-side to keep credentials off the client.
- All new edge functions require auth and reuse the owner/admin/manager access check from `generate-content-hub`.
