# Practice Dashboard KPIs + Test Data + Landing Page Hero

## 1. Data model (migration)

New tables (all with GRANTs + RLS scoped to account members; `is_test` boolean for easy purge):

- `campaign_daily_metrics` — per campaign + platform + day
  - `id`, `campaign_id`, `channel_id` (nullable), `platform` (text), `date` (date)
  - `impressions int`, `views int`, `clicks int`, `leads int`, `appointments int`, `spend numeric`
  - `is_test bool default false`
  - unique(`campaign_id`, `platform`, `date`)
- `campaign_financials` — per campaign + month rollup
  - `campaign_id`, `month` (date, first-of-month), `spend numeric`, `new_patients int`, `avg_patient_value numeric`, `revenue numeric`, `is_test bool`
- Add `avg_patient_value_general numeric default 2500`, `avg_patient_value_allonx numeric default 25000` to `profiles` (practice-level overrides; used when computing revenue).

RLS: account members can select rows for campaigns in their account; service_role full.

## 2. Dashboard KPI section (`src/pages/Dashboard.tsx`)

New "Performance" block above the campaigns table:

- **Per-campaign daily activity** — one small `recharts` stacked bar chart per running campaign. Stacks = views + clicks summed across platforms, one bar per day. Uses brand palette (Azure Blue, gold, dark blue, plus platform accent colors).
- Click chart → modal (`CampaignDailyDetailDialog`) with a multi-series line chart, one line per platform/channel, daily views & clicks toggle.
- **Annual ROI chart** (`AnnualROIChart`) — combo chart: monthly investment (bars) vs. monthly return (line), running-total overlay. Return = `new_patients * avg_patient_value` (general $2,500, All-on-X $25,000 unless overridden on profile or derived from PMS). Aggregates across all campaigns for the account.
- **Campaign KPI grid** — cards for totals: impressions, clicks, CTR, leads, appointments, cost/lead, cost/appointment, ROAS. Rendered from `campaign_daily_metrics` + `campaign_financials`.

New files:
- `src/components/dashboard/CampaignActivityChart.tsx`
- `src/components/dashboard/CampaignDailyDetailDialog.tsx`
- `src/components/dashboard/AnnualROIChart.tsx`
- `src/components/dashboard/CampaignKPIGrid.tsx`
- `src/hooks/useCampaignMetrics.ts` (fetch/aggregation with react-query)

Charts use `recharts` (already common in shadcn stack; add if missing) and pull colors from CSS tokens (`--primary`, `--accent`, plus platform tints in `src/lib/platformIcons`).

## 3. Ohana test data seed

Edge function `seed-ohana-test-data` (admin-only, callable from Admin Dashboard button "Seed Ohana test data"):

- Finds/creates account for "Ohana Dental Implants" (do not overwrite real data).
- Creates ~8–10 campaigns across the 12 months, mixing platforms Facebook, Instagram, X, TikTok, with vector tags (implants, cosmetic, hygiene, All-on-X, emergency, etc.).
- No posts, assets, reports, or landing pages generated. Only metrics rows.
- Monthly ad spend schedule: M1–M3 $2,000; M4–M6 $5,000; M7 $7,000; M8–M12 $5,000. Split across active campaigns per month.
- For each campaign/day, generates plausible impressions, clicks (CTR 1–3%), leads (2–6% of clicks), appointments (30–50% of leads). Deterministic seeded RNG so re-runs are stable.
- Every row tagged `is_test = true` on both metrics tables and campaigns (`campaigns.is_test` boolean added in migration).
- Companion function `purge-test-data` deletes everything where `is_test = true` for that account.

Admin Dashboard gets two buttons in the Actions menu: **Seed Ohana test data** and **Purge test data**.

## 4. Landing page hero guideline

Update `supabase/functions/generate-landing-page/index.ts`:

- Hero background image = campaign blog hero image (fallback: first accepted post image, then top image from practice website via existing Firecrawl scrape, then a free stock source like Unsplash source URL).
- Prompt update: pull secondary imagery from campaign posts + scraped practice site assets; note free image libraries (Unsplash, Pexels) as acceptable when nothing else is available.
- Store chosen hero URL on `campaigns.landing_hero_url` (new column) so regenerations stay consistent unless the blog hero changes.

Also update the design memory note referenced in `src/pages/archer` landing generation flow so future regenerations follow the same rule.

## Technical notes

- Charts read from Supabase via a single hook, cached 60s, so many small charts on the dashboard don't storm the DB.
- All new SQL migrations include `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role`, then `ENABLE ROW LEVEL SECURITY` + policies scoped via `is_account_member(auth.uid(), account_id)`.
- Test data flag makes cleanup a single `DELETE ... WHERE is_test`.
- No changes to campaign generation pipeline beyond the landing-page hero rule.
