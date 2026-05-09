## Goal
Make all three Campaign Dashboard summary cards (Total / Allocated / Remaining) open one consolidated budget dialog, and upgrade that dialog so editing the total recalculates row amounts from each row's percentage, with red highlighting for negatives and over-allocations.

## Scope
Frontend only. Two files touched:

1. `src/components/campaign/CampaignDashboardSection.tsx`
   - All three cards already call `onBudgetClick` — confirm wiring and add a small "Click to view & edit budget" hint via title attribute on each card so the affordance is consistent.

2. `src/components/campaign/CampaignBudgetDialog.tsx` — main work:
   - **Reactive total**: when the total budget input changes, recompute every row's `$ amount` from its existing `%` (instead of leaving stale amounts). Existing `handlePercentChange` / `handleAmountChange` keep working as today.
   - **Single consolidated table**: keep the current layout (Total Budget input on top, allocation table with Add-On / % / $ rows, then Total Allocated and Remaining summary rows in the same table). No structural redesign — it already matches the request.
   - **Red styling rules**:
     - Remaining `$` cell: red when `< 0` (already done) — keep.
     - Remaining `%` cell: red when allocated `> 100%`.
     - Total Allocated row: red when `> 100%` (both % and $ cells).
     - Per-row: when a row's `%` or `$` is negative, render that row's inputs with a red border + red text.
     - When total allocation `> 100%`, highlight the row(s) that pushed it over (any row whose cumulative running total exceeds 100%) in red so the user can see which allocations are the overage.
   - Keep the existing "Accept Budget Allocation" guard (already blocks > 100.5%).

## Behavior summary for the user
- Clicking any of the three cards (Total Budget, Allocated, Remaining) opens the same dialog.
- Editing total budget instantly rescales `$` columns from each row's `%`.
- Editing a row's `%` updates its `$` (and vice-versa) against the current total.
- Negative values and over-100% allocations are shown in red; the offending rows are flagged red individually.

## Out of scope
- No DB schema changes, no new edge functions, no changes to allocation persistence logic.
- Add-on list itself is still managed from the Add-Ons dialog.