## Goal

Replace the current "evenly distribute all posts across the window" behavior in `CampaignScheduler.tsx` with a rescheduler that:

1. Preserves the original relative distribution of scheduled posts.
2. Keeps posts that share the same start/end dates grouped together.
3. Snaps each post's time-of-day (and, when needed, day-of-week) to platform best practices for engagement / lead generation.

## Scope

Frontend only — `src/components/campaign/CampaignScheduler.tsx`, inside the existing `fitCampaign` mutation. No backend, schema, or AI changes. The strategic plan already drives the initial distribution; Fit Campaign just needs to respect and rescale it into a new window.

## New Fit algorithm

Inside `fitCampaign.mutationFn`, replace the even-distribution loop with:

### 1. Compute the source window
- `srcStart = min(post.date)` across all slots, `srcEnd = max(post.date)`.
- `srcSpan = daysBetween(srcStart, srcEnd)` (0 if all on one day).

### 2. Compute the destination window
- `dstStart = campaign.start_date`, `dstEnd = campaign.end_date`.
- `dstSpan = daysBetween(dstStart, dstEnd)`.

### 3. Scale each post proportionally, preserving co-located clusters
For every slot:
- `ratio = srcSpan === 0 ? 0 : (slot.date − srcStart) / srcSpan`
- `newDay = round(dstStart + ratio * dstSpan)`, clamped to `[dstStart, dstEnd]`.
- Because two posts with identical source dates produce identical `ratio`, they land on the same `newDay` — same-date groupings are preserved automatically.
- Posts spread across N source days keep the same N-band shape inside the new window.

### 4. Snap to platform best-practice slots
Introduce a per-platform lookup used only inside Fit:

```ts
const BEST_PRACTICE = {
  facebook:      { days: [1,2,3,4], times: ['09:00','13:00'] },
  instagram:     { days: [1,2,3,4,5], times: ['11:00','14:00','19:00'] },
  linkedin:      { days: [2,3,4], times: ['08:00','12:00'] },
  twitter:       { days: [1,2,3,4,5], times: ['09:00','12:00','17:00'] },
  youtube:       { days: [4,5,6], times: ['15:00','17:00'] },
  tiktok:        { days: [2,3,4,5], times: ['10:00','19:00'] },
  internal_email:{ days: [2,3,4], times: ['09:00','10:00'] }, // Tue–Thu AM
  mailchimp:     { days: [2,3,4], times: ['09:00','10:00'] },
  beehive:       { days: [2,3,4], times: ['09:00','10:00'] },
  internal_sms:  { days: [2,3,4,5], times: ['11:00','17:00'] }, // avoid early/late
};
```

For each slot after step 3:
- If the platform has preferred `days`, walk outward (±1, ±2, …, max 3) from `newDay` to find the nearest weekday in that set, still inside the window; if none, keep `newDay`.
- Pick the platform time closest to the slot's current `time` (falls back to the first entry). This preserves the original AM/PM feel where possible.
- Add-ons (`kind === 'addon'`) have no platform — keep the original `time`, only apply the proportional date shift.

### 5. Preserve intra-day ordering
When multiple posts on the same platform land on the same new day, sort by their original `(date,time)` and assign successive best-practice times so they don't collapse onto one slot.

### 6. Dispatch via existing `bulkMove`
Build the same `moves: { slot, newDate, newTime }[]` array and call `bulkMove.mutateAsync({ moves })` — no changes to the mutation, DB writes, or toasts.

## Out of scope
- No changes to how the strategic plan / `generate-campaign-content` picks initial dates.
- No changes to drag-and-drop, budgets, or preflight.
- No new UI controls — the existing "Fit Campaign" button keeps its label and location.

## Verification
- Load a campaign with posts clustered on a few dates, change the campaign window, click Fit Campaign, confirm the same clustering shape appears inside the new window and each platform lands on a best-practice weekday/time.
