## Goal

1. Fix "Investment" label color in the AnnualROIChart dark-theme tooltip/legend so it's readable.
2. Add a **Weekly Marketing Report** — a branded PDF styled after the uploaded Archer sample, auto-emailed every Monday to the practice owner, practice manager, and assigned marketing manager, and viewable in-app.

## 1. Dark-theme "Investment" color

- `src/components/dashboard/AnnualROIChart.tsx` currently uses `KPI_BRAND.navy` (`#001F5B`) for the Investment series — nearly invisible on the dark card.
- Add a lighter azure token (`KPI_BRAND.azureLight` = `#7CB8E8`) to `src/lib/kpiColors.ts`.
- Chart keeps navy in light theme, switches to the lighter azure when `.dark` is active, via a `useTheme()` check (already imported elsewhere). Applies to the area stroke/fill and the Legend/Tooltip text (Recharts colors both from the series color, so a single swap fixes both).

## 2. Weekly Marketing Report

### Data model
New table `weekly_reports`:
- `account_id`, `week_start` (Mon), `week_end` (Sun), `pdf_url` (Storage), `metrics_json` (raw numbers used), `generated_at`.
- Unique on `(account_id, week_start)`.
- RLS: account members read own; admins + assigned managers read all.
- GRANT to `authenticated` and `service_role`.

New storage bucket `weekly-reports` (private, signed URLs).

### PDF generator — `supabase/functions/generate-weekly-report/index.ts`
Uses `pdf-lib` (same pattern as `generate-strategy-pdf` / `generate-report-pdf`). Input: `{ accountId, weekStart? }`. Pulls:
- Practice name + locations from `accounts`/`locations`.
- Campaigns for the account; `campaign_daily_metrics` and `campaign_financials` for the week (includes `is_test` rows, per your answer).
- Aggregates: total spend, leads (from `leads`), booked patients (`appointments`), cost/booked, weekly budget from `campaign_budgets` or account setting, per-platform breakdown, per-location split when the account has >1 location.

Renders sections styled after the sample:
1. Cover: "Archer / Practice Perfect — Weekly Executive Marketing Report", practice name, date range, report date.
2. Executive Summary — spend vs budget, total leads, booked patients, avg cost/booked.
3. Weekly Budget Utilization bar.
4. Marketing Funnel (Impressions → Clicks → Leads → Booked) with conversion % between stages.
5. "Core Metrics We Track" (static explainer copy, tuned per plan).
6. Location-by-Location table (only when the account has ≥2 locations; otherwise a single consolidated table).
7. Organic Social & Community metrics from platform metrics.
8. Key Takeaways & Action Items — auto-derived from the data (biggest CPL, lowest conv location, best-performing platform, budget over/under). Falls back to templated copy when the practice is new.

Uploads PDF to `weekly-reports` bucket, upserts `weekly_reports` row, returns signed URL.

### Delivery — auto-email every Monday
- New edge function `weekly-report-cron` (invoked by pg_cron Monday 07:00 America/Los_Angeles):
  - Enumerate every non-prospect account with ≥1 active campaign.
  - For each: call `generate-weekly-report`; collect recipient set (`owner_user_id` of account, all `role='manager'` members of that account, and every `manager_assignments.manager_user_id` where `client_user_id = owner`).
  - Send via `send-transactional-email` with a new template `weekly-marketing-report` (React Email) that shows headline numbers and links to the signed PDF.
- Schedule via `net.http_post` cron (Supabase insert, not migration, per Lovable rules).

### In-app surface
- `src/pages/Dashboard.tsx`: new "Weekly reports" card above KPIs — lists the last 8 reports with date range + "View PDF" + "Email me a copy" (invokes generator on demand).
- Admin/Manager side (`ManagerDashboard`, `AdminDashboard`): same list per client they oversee.

### Email templates
Requires app-email infra. If not yet set up, plan runs `email_domain--check_email_domain_status` first; if no domain, show the setup dialog before scaffolding. Then `setup_email_infra` + `scaffold_transactional_email` and add the `weekly-marketing-report` template.

## Technical details

- Files added:
  - `supabase/functions/generate-weekly-report/index.ts`
  - `supabase/functions/weekly-report-cron/index.ts`
  - `supabase/functions/_shared/transactional-email-templates/weekly-marketing-report.tsx`
  - `src/components/dashboard/WeeklyReportsCard.tsx`
  - `src/hooks/useWeeklyReports.ts`
- Files changed:
  - `src/lib/kpiColors.ts` (add `azureLight`)
  - `src/components/dashboard/AnnualROIChart.tsx` (theme-aware Investment color)
  - `src/pages/Dashboard.tsx`, `src/pages/ManagerDashboard.tsx`, `src/pages/AdminDashboard.tsx` (surface reports)
  - `_shared/transactional-email-templates/registry.ts` (register new template)
- DB: 1 migration for `weekly_reports` + RLS + GRANTs + storage bucket.
- Cron: scheduled via `supabase--insert` (per Lovable rules for user-scoped cron).
- Libraries: `pdf-lib@1.17.1` (already vendored), no new deps.
- Test-data safety: uses `is_test` rows so Ohana's seeded metrics produce a full sample report immediately.
