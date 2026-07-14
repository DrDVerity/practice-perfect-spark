## Problem

The Schedule tab inside the campaign page renders `CampaignCalendarView`, a read‑only month grid. All the drag‑and‑drop, multi‑select, and "Fit Campaign" logic already exists — but in a different component (`CampaignScheduler`) that is only used on the standalone `/schedule/:id` route. That's why nothing draggable and no Fit Campaign button appears when the Schedule accordion is expanded.

## Fix

Swap the Schedule tab to use the interactive scheduler, and make small polish fixes.

### 1. `src/pages/CampaignEditNew.tsx` — Schedule accordion
- Replace `<CampaignCalendarView …/>` with `<CampaignScheduler campaignId={campaign.id} />`.
- Keep the "set start/end date first" empty state.
- Remove the now-unused `CampaignCalendarView` import if it isn't referenced elsewhere on the page.

### 2. `src/components/campaign/CampaignScheduler.tsx` — small hardening while we're in there
- The "Back to Campaign" button makes no sense when embedded inside the campaign page. Accept an optional `embedded?: boolean` prop; when true, hide the Back button and drop the outer `mb-6` / duplicate card chrome so it slots cleanly into the accordion body.
- Ensure the drag bubble's `onClick` still opens the edit dialog and only skips it when Shift/Ctrl/Meta is held (already true — keep as‑is).
- Confirm `Fit Campaign` button remains visible in the header row of the embedded view (it will, since we only hide "Back to Campaign").

### 3. Verify nothing else regresses
- Standalone `/schedule/:id` route keeps working (calls `<CampaignScheduler campaignId=… />` without `embedded`, so Back button still shows).
- Bubble drag/drop, multi‑select (Shift/Ctrl click), drop‑target ring, and `bulkMove` mutation are already implemented in `CampaignScheduler` — no changes needed to that logic.

## Result
- Expanding the Schedule tab shows the full interactive calendar with draggable bubbles.
- Users can Shift/Ctrl‑click multiple bubbles and drag the group to a new date.
- The "Fit Campaign" button appears in the Schedule tab header and redistributes posts across the campaign window.
