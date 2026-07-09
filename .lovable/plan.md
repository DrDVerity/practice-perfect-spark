## Goals

1. After the "Create new campaign" form is submitted, the agent should deterministically generate a strategic plan grounded in the form inputs AND the client's KB, ask clarifying questions when critical inputs are missing, then generate an information-rich blog article that becomes the source of truth for social posts.
2. The public "Get a campaign" / "Build a free campaign" flow must actually use the entered website + focus when producing the 3 sample posts.
3. Fix the "Failed to create account" error admins are hitting when creating a new client.

---

## 1. Create-account failure (admin dashboard)

**Cause:** `admin-create-client` calls `auth.admin.createUser` with the email the admin typed. When that email already exists in `auth.users` (from a prior test or a deleted-but-not-purged account), Supabase returns `422 email_exists` → surfaced as "Failed to create account". Auth logs confirm this exact 422 today.

**Fix:**
- In `admin-create-client`: before creating, look up existing auth user by email.
  - If found and has no `profile` row → reuse that user_id (create/patch profile, continue Bundle.social team setup).
  - If found and already has a profile → return a clear 409 with message "An account with this email already exists" so the UI shows a targeted toast instead of a generic failure.
- In `CreateClientDialog`: display the specific server error message (already does via `err.message`) and add an inline hint when the error is the duplicate case.
- No schema change.

---

## 2. Clarifying-questions gate before plan generation

**Behavior:** When the campaign form is submitted, before kicking off `run-campaign-agent`, run a lightweight readiness check. If any of the following are missing or too thin, prompt the user in-dialog and block generation until answered (or explicitly skipped):
- Campaign focus (min ~10 chars, not just a product word)
- Target market (must exist; empty = ask)
- Budget (must be > 0 for paid channels or explicitly "organic only")
- Practice/brand identity available in KB (practice analysis OR brand guidelines doc present for this account) — if none, ask "What business is this campaign promoting?" and store the answer on the campaign.

Implementation:
- New small edge function `campaign-readiness-check` (or reuse `publish-campaign-preflight` shape) that returns `{ ok, questions: [...] }`.
- `CreateCampaignDialog` shows the questions inline as a second step; answers are written to the campaign row (focus/target_audience/notes) before `run-campaign-agent` is invoked.

---

## 3. Strategic plan must be grounded in campaign form + client KB

Building on the recent identity-drift fixes, extend `_shared/campaign-agent.ts` `runStrategicPlan`:
- Explicitly load and pass to the model, in this priority order:
  1. Campaign form fields (name, focus, target_audience, budget, dates, selected channels).
  2. Client KB documents scoped to the campaign's `account_id`, filtered to the categories the user listed: **practice analysis, brand guidelines, competitive landscape, market analysis**, plus any KB doc whose title/tokens overlap the campaign focus/target.
  3. Profile business identity (practice_name, website_url).
- Exclude: unrelated client reports, image/video assets, and any KB doc whose tokens don't overlap campaign focus/target/business identity (mirrors current content-hub filter).
- Prompt updates: require the plan to cite which KB inputs it used (stored in `campaigns.strategy_sources` JSON for transparency) and to fail loudly if the business identity is ambiguous instead of inventing one.

---

## 4. Blog article: information-rich, illustrated, source of truth for social

Update `generate-content-hub`:
- After the article brief step, generate a **long-form structured article** with required sections: intro, key data points, at least 2 supporting visuals, comparison, conclusion/CTA.
- Visual asset generation:
  - Hero image (already exists) — keep.
  - 2–3 additional inline visuals: a stat/infographic card, a comparison chart, and either a process diagram or a second supporting image. Generated via existing `generate-image` / infographic prompt patterns and stored on `campaign_vault` linked to the blog record so they render inside the article body, not just as a hero.
- Store the finalized blog (title, sections, visuals) as the canonical brief that `generate-campaign-content` reads when producing social posts, so posts stay on-message.

Scope note: this reuses existing image generation; no new provider.

---

## 5. "Build a free campaign" (public lead flow) using the entered website + focus

**Observed:** The 3 generated posts ignore the visitor's entered website and focus.

**Plan:**
- Trace the free-campaign entry point (public landing CTA → whichever function currently produces the 3 sample posts; likely `generate-post` or a variant used unauthenticated).
- Ensure the request payload includes `{ website_url, focus, target_market }` from the form.
- On the server, when no `campaignId` is present, build an ad-hoc brief from those inputs (optionally enrich by a quick Firecrawl scrape of the website to extract business name + services) and pass it into the same prompt path used by authenticated post generation.
- Guardrails: if website scrape fails, still honor the entered focus verbatim; never fall back to the admin account's profile defaults.

---

## 6. Verification

- Create a fresh client with a fresh email → succeeds; retry with the same email → clear "already exists" message.
- Create a new campaign with focus "Best hiring decision" + target "dental practice owners" → readiness check passes → strategic plan mentions practice-owner ROI, cites KB sources, no patient/dental-treatment drift → blog article generated with 2–3 inline visuals → social posts derive from that blog.
- Missing focus → readiness dialog blocks generation and asks.
- Public "Build a free campaign" with a real dental site + focus "Invisalign for adults" → 3 posts reference the entered site's business and the entered focus.

---

## Technical details

- Edge functions touched: `admin-create-client`, `_shared/campaign-agent.ts`, `generate-content-hub`, `generate-campaign-content`, public free-campaign function (to be identified), plus new `campaign-readiness-check`.
- Frontend touched: `CreateClientDialog.tsx` (better error), `CreateCampaignDialog.tsx` (readiness questions step), `BlogArticlePanel.tsx` (render inline visuals), free-campaign landing component (send website+focus).
- DB: optional `campaigns.strategy_sources jsonb` column via migration for transparency; no destructive changes.
- No changes to Bundle.social publishing.

---

## Open questions before I build

1. For the readiness gate, should missing KB (no practice analysis / brand guidelines) **block** generation, or just warn and proceed using only the form inputs?
2. For the free public campaign flow, is it OK to run a Firecrawl scrape of the entered website to enrich the brief (uses Firecrawl credits), or should we only use the raw form inputs?
3. On duplicate email during admin create-account: do you want it to **reuse** the existing auth user (attach a new profile if none) or always **reject** with "already exists"?
