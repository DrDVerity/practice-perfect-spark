
# Campaign Workflow Refactor

An end-to-end, KB-grounded pipeline triggered from the New Campaign form: ensure practice reports exist, generate a strategic plan, produce a rich blog with AI-placed illustrations, derive 3 social posts, draft a welcome + 5-email nurture funnel, present everything on the Campaign Page with WYSIWYG editing and per-image regeneration, and hand off to Bundle.social on approval.

## Phase 1 — Initialization & KB Grounding

- Single entry point: `CreateCampaignDialog` submit → new orchestrator `run-campaign-pipeline` (replaces the ad-hoc chain in `run-campaign-agent`).
- Orchestrator first calls new `ensure-kb-reports` which checks for each required `doc_type` in `knowledge_base` for the client:
  - `demographic_analysis`, `psychographic_analysis`, `competitive_analysis`, `practice_analysis`, `brand_guidelines`.
- Missing ones are generated sequentially (blocking, single-pass) by dedicated generators. Existing generators are reused where present; new ones added where not:
  - Reuse: `generate-practice-report`, `generate-analysis-reports`, `generate-brand-guidelines`.
  - New: `generate-demographic-report`, `generate-psychographic-report`, `generate-competitive-report` (each pulls from profile + website scrape via Firecrawl + KB).
- Progress surfaces via `campaigns.generation_status` values: `ensuring_kb` → `planning` → `writing_content` → `deriving_posts` → `drafting_funnel` → `completed` (extends existing `GenerationProgress` overlay).

## Phase 2 — Strategy & Plan

- `generate-strategic-plan` receives the full KB report bundle (loaded by orchestrator, not the model) as authoritative context.
- Prompt requires: campaign focus, target market, budget, KB reports; forbids inventing business identity.
- Output stored in `campaigns.strategy` (existing column) + new `campaigns.step_plan` JSONB (ordered phases with owners, dates, deliverables). Both render on Campaign Page.

## Phase 3 — Blog + Social Posts

- New `generate-article-brief` step: JSON brief keyed to focus/target market — `{headline, angle, keyPoints[5], sections[], illustrationPrompts[3], heroPrompt}`. Illustration prompts include a `sectionAnchor` string matching a section heading.
- `generate-content-hub` refactored to:
  1. Call article-brief step (strategic plan is authoritative source).
  2. Generate 1,000–1,500-word article (tone: friendly, professional, engaging, informative, helpful) with H2 sections matching brief.
  3. Generate hero image, upload to `post-media`, insert at top.
  4. Generate 2–3 illustrations from `illustrationPrompts` in parallel, upload, embed via HTML `<img>` at each `sectionAnchor` inside the article HTML.
  5. Store final HTML in `campaigns.content_hub.article_html` with `images[]` metadata for later regeneration.
- Post derivation (`generate-campaign-content`) unchanged in structure but reads the finalized article + brief and enforces **exactly 3 posts per channel**, each anchored to a distinct `keyPoint` from the brief.

## Phase 4 — Email Nurture Funnel

- New `generate-email-funnel` edge function. Produces 6 emails (welcome + 5 nurture: value, social proof, education, objection-handling, final CTA), each `{subject, previewText, bodyHtml, sendOffsetDays}`.
- Stored on new `campaign_email_funnel` table (one row per email, ordered).
- Reuses existing app-email infrastructure and welcome template pattern (React Email components under `_shared/transactional-email-templates/`); new template `campaign-nurture.tsx` renders any funnel email by props. Scheduling/automation wiring is a follow-up; for now emails are drafts editable on the Campaign Page and can be sent manually via existing `send-transactional-email`.
- Trigger source: `landing-page-lead` inserts (already capturing emails) enqueue the funnel to the new lead — kept out of scope of THIS refactor; called out as follow-up.

## Phase 5 — Review, Approval & Deployment

- Campaign Page (`CampaignEditNew.tsx`) gets four review sections: Strategy & Plan, Blog Article, Social Posts, Email Funnel. Each has an Accept toggle stored on the campaign / per-asset row.
- Blog article panel (`BlogArticlePanel.tsx`) upgraded:
  - **WYSIWYG editor** using Tiptap (`@tiptap/react` + StarterKit + Image + Link extensions) bound to `content_hub.article_html`.
  - Prominent buttons: **Edit** (toggle editor), **Regenerate Article** (existing), **Regenerate Hero**, and per-illustration **Regenerate Image** overlay button (reuses `ImageWithRegenerate`) that calls new `regenerate-article-image` edge function with the illustration prompt and section anchor.
  - Save persists cleaned HTML back to `content_hub`.
- New `PublishPreflightDialog` extension: checks all four asset groups are accepted, dates set, and Bundle.social team + channels connected.
- **Deploy**: existing `publish-campaign` invokes Bundle.social for the 3 posts per channel per schedule (already implemented — verified end-to-end after refactor).

## Data Model Changes

- `campaigns`: add `step_plan JSONB`, `article_accepted BOOLEAN`, `posts_accepted BOOLEAN`, `funnel_accepted BOOLEAN`, `strategy_accepted BOOLEAN`.
- New `campaign_email_funnel(id, campaign_id, order_index, subject, preview_text, body_html, send_offset_days, created_at, updated_at)` with GRANTs + RLS scoped via `is_account_member(auth.uid(), account_id_for_campaign)`.
- `knowledge_base.doc_type` values extended for the 5 required report kinds (already enum-free text; only convention change).

## Files Touched

- **New edge functions**: `run-campaign-pipeline`, `ensure-kb-reports`, `generate-demographic-report`, `generate-psychographic-report`, `generate-competitive-report`, `generate-article-brief`, `generate-email-funnel`, `regenerate-article-image`.
- **Edited edge functions**: `generate-content-hub` (brief → article → hero → illustrations pipeline), `generate-campaign-content` (3-per-channel key-point mapping), `publish-campaign-preflight` (new accept flags).
- **Retired**: `run-campaign-agent` (replaced by `run-campaign-pipeline`; kept as thin alias to avoid breaking callers).
- **New template**: `_shared/transactional-email-templates/campaign-nurture.tsx` + registry update.
- **Frontend**:
  - `src/components/dashboard/CreateCampaignDialog.tsx` — invoke `run-campaign-pipeline`.
  - `src/components/campaign/GenerationProgress.tsx` — extra phases.
  - `src/components/campaign/BlogArticlePanel.tsx` — Tiptap editor, per-image regenerate.
  - `src/pages/CampaignEditNew.tsx` — new Strategy/Plan, Email Funnel sections + accept toggles.
  - `src/components/campaign/PublishPreflightDialog.tsx` — new checklist entries.
  - New: `src/components/campaign/EmailFunnelPanel.tsx`, `src/components/campaign/StrategyPlanPanel.tsx`.
  - New hook: `src/hooks/useEmailFunnel.ts`.

## Technical Notes

- Illustration generation uses AI Gateway image models (Nano Banana 2 default) streamed server-side, uploaded to `post-media`, referenced by public URL — no base64 embedded in article HTML.
- All AI prompts include the Identity Guardrail + KB Relevance Filter established earlier; strategic plan is source-of-truth, KB reports are supporting context.
- Tiptap chosen for WYSIWYG (small, headless, matches shadcn styling); HTML sanitized on save with DOMPurify before persisting.
- Bundle.social handoff unchanged; preflight simply gates on the new accept flags.
- Nurture funnel is drafted + editable now; automated triggering from `landing_page_leads` is a follow-up task and NOT part of this refactor.
