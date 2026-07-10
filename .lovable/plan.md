# Plan

## Part 1 — Admin Dashboard: reflect "Owner" state

**Goal:** When an admin promotes a user via "Set as Business Owner", show the user's role as **Owner** and turn the action icon black (indicating "already owner").

**Changes**
- `src/pages/AdminDashboard.tsx`:
  - Extend the clients query to also fetch each user's `account_members.role`. Compute `isOwner` per row (any membership with role = `owner`).
  - Role column: show a solid **Owner** badge (black bg / white text) when `isOwner`; keep existing label otherwise.
  - "Set as Business Owner" icon button: when `isOwner` → render icon in solid black, disabled, tooltip "Already business owner". Otherwise current style.
  - Invalidate the clients query after the `admin-set-business-owner` mutation succeeds so the row updates without reload.
- No backend changes — `admin-set-business-owner` already upgrades all memberships to `owner`.

## Part 2 — Landing Page Generator upgrade

**Goal:** Replace the current generic landing page output with a high-converting sales page derived from the campaign's blog + brand guidelines + target audience, with a clear CTA using the client's real phone number and a working contact form.

### 2a. Brand guidelines in KB (auto-managed)
- Reuse the existing `knowledge_base` table (`doc_type = 'brand_guidelines'`).
- New Edge Function `generate-brand-guidelines`:
  - Inputs: `user_id`.
  - Uses Firecrawl `branding` format on the practice website to extract colors, fonts, logo. Falls back to defaults if scrape fails.
  - Combines with practice profile + top KB reports; asks the model to produce a JSON block (`{colors, fonts, tone, voice, doNotUse, logoUrl, phone, address}`) plus a markdown doc.
  - Upserts into `knowledge_base` for the client (`doc_type='brand_guidelines'`).
- Trigger:
  - Called on-demand from `generate-landing-page` if none exists.
  - **Auto-refresh**: called from the profile save path when the user updates `practice_name`, `website_url`, `campaign_focus`, or `target_audience`. Implement as a Postgres trigger on `profiles` that calls a lightweight edge invocation via `pg_net`, OR (simpler) call the function from the frontend after a successful profile save in `useProfile.ts`. Plan uses the **frontend hook** approach for reliability and to keep secrets server-side.

### 2b. Client phone number
- The scraper (`generate-brand-guidelines`) parses the client website for a phone number (Firecrawl markdown → regex for `tel:` links and NANP/international phone patterns) and stores it on the brand guidelines JSON.
- `generate-landing-page` reads `phone` from brand guidelines and uses it in click-to-call CTAs.
- If not found, falls back to `profiles.phone` (if column exists) or omits the phone CTA — no fake number.

### 2c. Blog key-point extraction
- In `generate-landing-page`, load the accepted blog from `campaigns.content_hub` (or the equivalent stored field).
- First AI pass produces a JSON "Page Brief": `{headline, subheadline, valueProp, keyPoints[5], features[], benefits[], objections[], socialProof[], faq[]}`, all scoped by campaign `focus` + `target_audience` and the campaign strategic plan (authoritative source).
- Second AI pass renders the HTML using brand tokens + the brief.

### 2d. Landing page structure (high-conversion best practices)
Sections in order:
1. Hero: value-prop headline, target-audience subhead, primary CTA (scrolls to form), trust strip.
2. Problem / Agitation (from blog pain points).
3. Solution + 3–5 Features → Benefits mapped to target audience.
4. Social proof (KB testimonials/reviews if present; otherwise trust strip only).
5. How it works (3 steps).
6. Offer.
7. FAQ (from blog objections).
8. Final CTA with **click-to-call phone** (`tel:` link) + **contact form** posting to `landing-page-lead` endpoint.
9. Footer with practice name, address, legal.

Design uses brand-guideline tokens (colors, fonts), inline `<style>`, mobile-first, semantic HTML, single H1, meta/OG tags, JSON-LD LocalBusiness.

### 2e. Leads capture
- New table `public.landing_page_leads`:
  - Columns: `id`, `campaign_id`, `account_id`, `name`, `email`, `phone`, `message`, `source_url`, `created_at`.
  - RLS: `INSERT` allowed to `anon` (public form); `SELECT`/`UPDATE`/`DELETE` restricted to account members via `is_account_member(auth.uid(), account_id)`.
  - GRANTs: `INSERT` to `anon`; full CRUD to `authenticated`; `ALL` to `service_role`.
- New Edge Function `landing-page-lead` (public, no JWT):
  - Validates payload with zod (name/email/phone/message length + email format).
  - Rate-limited by IP via existing `check_and_consume_rate_limit`.
  - Inserts row.
  - Invokes `send-transactional-email` with template `landing-page-lead-notification` to the account owner.
  - Inserts an in-app message via existing `messages` table so the client sees a notification in the dashboard.
- New React Email template `landing-page-lead-notification.tsx` in `_shared/transactional-email-templates/` (registered in `registry.ts`).
- **Dashboard surfacing**: add a "Leads" section on the campaign detail page (`CampaignEditNew.tsx`) showing a paginated list of leads for that campaign with name/email/phone/message/date.

### 2f. Files touched
- **Migrations**: create `landing_page_leads` table with GRANTs + RLS.
- **New edge functions**: `generate-brand-guidelines/index.ts`, `landing-page-lead/index.ts`.
- **Edited**: `supabase/functions/generate-landing-page/index.ts` (brand-guideline load, blog brief extraction, new HTML generator, real phone/form wiring).
- **New template**: `_shared/transactional-email-templates/landing-page-lead-notification.tsx` + registry update.
- **Frontend**:
  - `src/pages/AdminDashboard.tsx` — Owner badge & disabled icon.
  - `src/hooks/useProfile.ts` — invoke `generate-brand-guidelines` after profile update.
  - `src/pages/CampaignEditNew.tsx` — Leads panel.
- **Optional**: add `phone` column to `profiles` if the plan needs a manual override (only if user asks later — auto-scraped for now).

## Technical notes
- Landing page still served via existing `serve-landing-page` + `LandingView.tsx` — the contact form uses `fetch` to the public `landing-page-lead` function URL with `campaign_id` in the body (never trust client-supplied `account_id`; look it up server-side from campaign).
- Email prerequisites: relies on existing app-email infrastructure. If `check_email_domain_status` shows no domain, the notification email will fail silently and the in-app message still fires; we'll surface a warning in the admin dashboard rather than block leads.
- Reuse existing OpenRouter model config; cap tokens per section to avoid credit errors (previous fix).
- No changes to auth/RLS on existing tables.
