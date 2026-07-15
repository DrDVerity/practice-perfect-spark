## Goals

Address five UX/workflow issues in the campaign editor:

1. Post "Accept" button feels laggy.
2. "Campaign Agent at Work" panel needs modal-like blocking behavior with minimize.
3. Schedule Post dialog needs an explicit time selector after picking a date.
4. Add a "Fit Posts" button on the channel post page.
5. Sync campaign dates across strategy plan and schedule tab bi-directionally, with partial regeneration when the plan is already accepted.

---

## 1. Faster per-post Accept feedback (`src/pages/ChannelEdit.tsx`, `src/hooks/useCampaignsNew.ts`)

Root cause: the per-post Accept icon calls `updatePost.mutate({ accepted: !post.accepted })`, which awaits the round-trip then invalidates `channel-with-posts`, forcing a full refetch before the icon flips.

Changes:
- Convert the accept icon to use an **optimistic update** via `queryClient.setQueryData(['channel-with-posts', channelId], …)` before the mutation fires, then rollback on error.
- Show an inline `Loader2` spinner in place of the check/x icon while `updatePost.isPending && variables.id === post.id`.
- Alternatively (simpler): add a local `acceptingId` state and swap the icon for a spinner during the request; still keep optimistic cache write for instant color flip.
- Apply the same optimistic pattern to `acceptAllPosts` so the header row updates immediately.

## 2. Blocking + minimizable "Agent at Work" overlay (`src/components/campaign/GenerationProgress.tsx`, `src/pages/CampaignEditNew.tsx`)

- Wrap the panel in a fixed-position **backdrop overlay** (`fixed inset-0 bg-background/70 backdrop-blur-sm z-50`) centered card. This visually blocks the page while still letting the user scroll/read.
- Add a **Minimize** button in the top-right of the card. When clicked, the overlay collapses to a floating bottom-right pill:
  - Green pulsing dot + "Agent working…" while `generation_status` is in progress.
  - Red flashing dot + "Ready — click to review" when `generation_status === 'completed'` or `'failed'`.
  - Clicking the pill re-expands the overlay.
- Add a top-level `isAgentBusy` boolean derived from `generation_status` (anything not `completed`/`failed`/`null`). Pass it down and disable edit-triggering controls (Accept buttons, inline field edits, delete, regenerate) via a `disabled={isAgentBusy}` prop or a lightweight context. Read-only viewing/navigation remains enabled.
- Persist the minimized/expanded state in `sessionStorage` keyed by campaign id.

## 3. Schedule Post — explicit time picker (`src/pages/ChannelEdit.tsx`)

In the Schedule Post dialog:
- After a date is selected in the popover Calendar, automatically reveal a required **time input** (`<Input type="time">`) below the date button labeled "Select a time".
- Do the same for End Date.
- Disable "Save Schedule" until both date **and** time are set for the start (and end, if provided).
- Combine the picked date + time into the ISO stored in `scheduled_start` / `scheduled_end`.

## 4. "Fit Posts" button on channel post page (`src/pages/ChannelEdit.tsx`, reuse logic from `CampaignScheduler.tsx`)

- Add a **"Fit Posts to Campaign"** button in the header row of ChannelEdit (next to "Accept All").
- On click, call a new helper `fitPostsForChannel(channelId)` that:
  1. Reads campaign `start_date` / `end_date` from the parent campaign.
  2. Reads the strategic plan (`campaign.strategy`) and platform to determine cadence.
  3. Distributes this channel's posts across the campaign window, snapping each to the platform's best-practice weekday/time (same helper already used in `CampaignScheduler.tsx` — extract it into `src/lib/scheduling.ts` for reuse).
- Show toast progress; invalidate `channel-with-posts` on completion.

## 5. Bi-directional campaign date sync + partial plan refresh

- **Single source of truth**: `campaigns.start_date` / `end_date`.
- In `CampaignScheduler.tsx`, when the user changes the campaign window (existing controls), persist to `campaigns` (already done) and additionally:
  - Auto-run `fitCampaign()` to reflow all channels' posts into the new window using platform best-practices (existing logic).
  - If `assets_accepted.plan === true`, call a new edge function **`refresh-strategic-plan-dates`** that:
    - Loads the current `strategy` markdown.
    - Sends it to OpenRouter with a targeted prompt: "Only update the Content Calendar / Timeline / Schedule sections to match new start/end dates. Preserve every other section verbatim." (Mirrors the existing budget-change partial-refresh pattern.)
    - Writes the updated `strategy` back, keeps `assets_accepted.plan = true`, and toasts "Strategic plan schedule updated".
- In the Strategic Plan editor (top of `CampaignEditNew.tsx`), when the user edits the plan and it contains new date references, we don't parse dates from prose — instead, add explicit **Start / End date pickers** to the plan section header that write to `campaigns.start_date` / `end_date` and trigger the same `fitCampaign()` + partial refresh flow.
- Add a shared `useCampaignDates(campaignId)` hook that both the plan header and scheduler subscribe to, so a change in either place immediately updates the other via React Query invalidation.

---

## Technical Notes

- Extract platform best-practice slot logic from `CampaignScheduler.tsx` into `src/lib/scheduling.ts` so ChannelEdit's Fit Posts and the existing Fit Campaign share one implementation.
- New edge function `refresh-strategic-plan-dates` follows the same shape as existing `refresh-strategic-plan` but with a date-only prompt; register it in `supabase/config.toml`.
- No database schema changes required — `assets_accepted` JSONB, `channel_posts.accepted`, and `campaigns.start_date/end_date` already exist.
- `isAgentBusy` gating: prefer a small `AgentBusyContext` over prop-drilling since many descendant components need it.
- Optimistic accept: use `onMutate` in the `updatePost` mutation to update the cached posts array, and `onError` to roll back.
