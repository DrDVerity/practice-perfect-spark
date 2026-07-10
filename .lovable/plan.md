
# Refactor `/get-started` Workflow

## Decisions locked in
- **Prospect key** = email captured in Basic Info. One prospect row per email; re-runs update in place. A new email = a new prospect row.
- **Sign-in promotion** = always promote the last prospect payload from this browser session to the authenticated user, even if the Google email differs from the form email.

## 1. Form UX (`CampaignDetailsStep.tsx`)

**Website URL normalization**
- On blur / on submit, if the value lacks a scheme, prepend `https://www.` (bare `domain.com`) or `https://` (already starts with `www.`).
- Re-validate the normalized URL. If Firecrawl later fails to scrape, surface a toast: "We couldn't reach that site — please include the `https://www.` prefix or check the URL."
- Same normalization applied to Landing Page URL.

**Target audience — multi-select + custom**
- Change `targetAudience` to `string[]` in `PracticeData` (`src/types/campaign.ts`).
- Suggestion chips become toggles (click to add, click again to remove) with a visible `selected` state.
- "+ Add custom" input beneath chips: typing + Enter appends a tag; every chip has an `×`.
- At the API boundary the array is joined into a comma-separated string so the existing `profiles.target_audience` / `campaigns.target_audience` text columns keep working.

## 2. Terminology (documentation only this pass)

Add a short section to `README.md` codifying:
- **User** = any authenticated identity (unique email).
- **Practice (Client)** = grouped by normalized `website_url`.
- **Roles**: Admin → Admin Manager → Owner → Practice Manager → User, with the assignment rules the user described.

Cross-account auto-merging by website URL is called out as a future migration — not implemented here.

## 3. Prospect ("temp") accounts

New tables (all writes via service role only):
- `public.prospect_accounts` — `id`, `email` unique, `practice_name`, `website_url`, `campaign_focus`, `target_audience`, `status`, `error`, `converted_user_id`, timestamps.
- `public.prospect_reports` — `id`, `prospect_id` fk, `doc_type` (`practice_analysis` | `competitive_analysis` | `audience_analysis` | `brand_guidelines`), `title`, `content`, `metadata jsonb`, timestamps.
- `public.prospect_campaigns` — `id`, `prospect_id` fk, `blog_title`, `blog_html`, `hero_image_url`, `illustrations jsonb`, `posts jsonb` (3 Facebook variations), `email_funnel jsonb`, timestamps.

RLS: no anon/authenticated policies. `service_role` gets full grants. Edge functions do all reads/writes; the preview page reads via a public edge function that returns the payload by `prospectId`.

## 4. Edge functions

**`get-started-generate` (new, public)** — orchestrator invoked when the user clicks *Generate Campaigns*.
1. Normalize `websiteUrl`.
2. Upsert `prospect_accounts` by `email` and set `status = 'generating_reports'`.
3. In parallel, generate the four grounding reports from the scraped site into `prospect_reports` (reusing existing generator logic with an optional `{ prospectId }` destination):
   - `practice_analysis` — from `generate-practice-report`.
   - `competitive_analysis` — from `generate-analysis-reports`.
   - `audience_analysis` — psychographics, pain points, key motivators, grounded in scrape + `campaignFocus` + selected audiences.
   - `brand_guidelines` — from `generate-brand-guidelines`.
4. Then generate content into `prospect_campaigns`:
   - 1,000–1,500 word blog article (reuse `generate-content-hub` prompt).
   - Hero image + 2–3 illustrations.
   - 3 Facebook post variations derived from the blog.
   - 6-email nurture funnel (reuse `generate-email-funnel` prompt).
5. Update `status = 'ready'` (or `'failed'` with `error`).

**`get-started-status` (new, public)** — polled by the Generating overlay: returns `{ status, error, prospectId }`.

**`get-started-fetch` (new, public)** — returns the prospect's reports + blog + 3 posts + email funnel for the Preview page render.

**`promote-prospect` (new, auth-required)** — called after Google sign-in in `CampaignPreview`; copies prospect reports into the user's KB, prospect blog/posts/emails into `campaigns` + related tables, sets `converted_user_id`.

Existing generators (`generate-brand-guidelines`, `generate-practice-report`, `generate-analysis-reports`, `generate-content-hub`, `generate-campaign-content`, `generate-email-funnel`) get a small refactor to accept an optional `{ prospectId }` and switch destination table. Prompts are unchanged.

All four public edge functions register in `supabase/config.toml` with `verify_jwt = false` (except `promote-prospect` which is `true`).

## 5. Preview page (`CampaignPreview.tsx`)

Replaces the current static "Gap Analysis" block with real generated content:

- **Reports strip** — one card per report (Practice, Competitive, Audience, Brand). "View" opens a modal with the markdown/HTML.
- **Blog article panel** — collapsible: hero image, article body, inline illustrations. Read-only.
- **3 Facebook post variations** — rendered as Facebook post mockups (avatar = practice initial, generated copy + image, like/comment/share row). Edit/Download stays behind the existing `LoginWall`.
- **Email funnel** — accordion of 6 emails (subject + preview), same rendering as `CampaignEmailFunnelPanel`, read-only.
- Existing "Get a free account" CTA stays; on successful sign-in, invoke `promote-prospect` with the `prospectId` stored in `sessionStorage` so promotion works even if the Google email ≠ form email.

## 6. Files touched

- `src/types/campaign.ts` — `targetAudience: string[]`.
- `src/components/onboarding/CampaignDetailsStep.tsx` — URL normalization, multi-select chips, custom-add input.
- `src/pages/Index.tsx` — invoke `get-started-generate`, store `prospectId`; pass array audience.
- `src/components/onboarding/GeneratingStep.tsx` — poll `get-started-status`, show real phase labels.
- `src/components/campaign/CampaignPreview.tsx` — new sections; sign-in triggers `promote-prospect`.
- New: `src/components/campaign/preview/FacebookPostMock.tsx`, `ReportPreviewCard.tsx`, `ProspectBlogPanel.tsx`.
- Migration for `prospect_accounts`, `prospect_reports`, `prospect_campaigns` + GRANTs + RLS.
- Edge functions: `get-started-generate`, `get-started-status`, `get-started-fetch`, `promote-prospect`; light refactors to the six existing generators listed above.
- `supabase/config.toml` — register the four new functions.
- `README.md` — terminology section.

## 7. Out of scope
- Cross-account auto-merging of existing production users by website URL.
- Admin UI for prospect leads (data is captured, UI can follow later).
- Storing selected audiences as structured tags (kept as delimited text for now).
