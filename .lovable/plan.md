
# Dashboard KPI Refactor

## 1. Replace KPI grid with tabbed monthly line charts

Replace `CampaignKPIGrid` on `src/pages/Dashboard.tsx` with a new `PerformanceOverviewCharts` component:

- Two shadcn `Tabs` (default `leads`):
  - **Appointments** — single line, monthly totals.
  - **Leads / Impressions / Clicks** — three lines on one chart, monthly totals.
- Data source: aggregate `campaign_daily_metrics` for the account's campaign IDs, bucketed by month (trailing 12 months). Add `useCampaignMonthlyMetrics(campaignIds)` to `src/hooks/useCampaignMetrics.ts`.
- Colors from `KPI_BRAND` / `PLATFORM_COLORS` — navy for leads, gold for impressions, azure for clicks, success green for appointments.
- Recharts `LineChart` in a `Card` with header title matching each tab.

New file: `src/components/dashboard/PerformanceOverviewCharts.tsx`.

## 2. Reorder dashboard sections

In `src/pages/Dashboard.tsx` Performance block, new order:

1. `PerformanceOverviewCharts` (tabs)
2. `AnnualROIChart` (moved up)
3. Per-campaign activity grid (now monthly — see §3)

## 3. Per-campaign charts → monthly

Update `src/components/dashboard/CampaignActivityChart.tsx`:

- Aggregate `campaign_daily_metrics` by month (YYYY-MM) instead of by day.
- Keep stacked bar of views + clicks, one bar per month.
- Title/tooltip labels say "Monthly activity".
- Card remains clickable → opens existing `CampaignDailyDetailDialog` unchanged (daily platform breakdown preserved).

No schema or edge function changes. No changes to daily detail dialog.
