## Goal

Encode explicit social-media scheduling rules and turn the Publish Preflight into an auto-fix pass that resolves everything it can before showing the user only what they must fix.

## 1. New scheduling rules (shared library)

Update `src/lib/scheduling.ts` with a documented `SCHEDULING_GUIDE` block and enforce:

- **Launch day cluster** — Facebook, Instagram, X/Twitter, LinkedIn each post on the campaign's Day 1 ("launch salvo").
- **First-week weighting** — remaining social posts are packed into the first 7 days of the campaign window, then spaced out afterward.
- **Max 1 post / platform / day** — if the fit algorithm would collide, push the extra post to the next available best-practice day for that platform.
- **Same-day duplicates** — if the plan explicitly requires two posts for the same platform on the same day, split into a morning slot (~09:00) and an evening slot (~19:00) instead of stacking mid-day.
- **Email cadence cap** — no more than one email (Patient Email / Mailchimp / Beehive) per 7-day rolling window per channel, **unless the email is part of a funnel / drip sequence** (identified by `campaign_email_funnel` rows or `campaign_drip_series` items), in which case the funnel's own cadence is preserved.
- **SMS cadence cap** — keep existing best-practice days but enforce min 3-day gap.

`fitPostsToWindow` and `snapDayToPlatform` get:
- a `campaignStart` / launch-day parameter,
- a "used slots" map so callers can honor cross-post uniqueness per day,
- a helper `rebalanceForCadence(posts, platform, { isFunnel })` for the weekly email rule that short-circuits when `isFunnel` is true.

`CampaignScheduler.fitCampaign` and `ChannelEdit`'s per-channel Fit Posts both call the updated helpers so the rules apply everywhere. Funnel/drip posts are tagged before being passed in so the cadence cap skips them.

## 2. Posting-guide note

Append a "Scheduling rules for social posts" section to the platform posting guide document generator (`supabase/functions/generate-platform-rules/index.ts`) so future AI generations bake the same rules in — including the funnel exception on the email cadence rule. Also surface a short summary in the Schedule tab legend (`CampaignScheduler.tsx`).

## 3. Preflight auto-fix pass

Refactor `supabase/functions/publish-campaign-preflight/index.ts` into a two-phase flow:

**Phase A — Detect (unchanged checks).** Run the existing checklist and label each failure with an `autofixable` flag:

| Failure | Auto-fix action |
|---|---|
| Missing SMS drip content | Invoke `generate-drip-series` for the SMS channel |
| Missing Patient Email drip / broadcast content | Invoke `generate-campaign-content` (email-only pass) |
| Missing per-channel posts | Invoke `generate-campaign-content` with `force: false` for that channel |
| Post `scheduled_at` outside campaign window | Re-run `fitPostsToWindow` for that channel and persist new `scheduled_at` |
| Post violates max-1/platform/day or email weekly cap (non-funnel) | Re-run the new cadence rebalance and persist |
| Missing landing page | Invoke `generate-landing-page` |
| Missing blog / hero asset | Invoke `generate-content-hub` (assets only) |

Non-autofixable (must stay user-actionable): missing email distribution list selection, unaccepted strategic plan, unconnected social account, missing budget.

**Phase B — Re-scan.** After auto-fixes complete (awaited in-line where fast, backgrounded where slow with a returned `pendingJobs` array), re-run the check list and return the final `PreflightResult` plus a `resolved[]` summary of what was fixed.

## 4. Preflight UI

Update `src/components/campaign/PublishPreflightDialog.tsx` and `src/hooks/useCampaignAgent.ts`:

- Add an "Auto-fix issues" button that calls preflight with `{ mode: "autofix" }`.
- Show a "Resolved by agent" section listing what was fixed.
- Keep the existing "Generate missing posts" button but hide it once auto-fix supersedes it.
- Remaining failures render with a clear "You must fix" heading (e.g. "Select an email distribution list").

## 5. Verification

- Unit-test the new cadence helpers in `src/lib/scheduling.ts` (launch-day salvo, per-day uniqueness, weekly email cap with funnel exception, morning/evening split).
- Manual: on the current campaign, open Publish Preflight → Auto-fix → confirm SMS drip is generated, out-of-window posts snap into range, and only the user-actionable items remain.

## Technical notes

- No DB schema changes required — all edits live in `channel_posts.scheduled_at`, `campaign_drip_series`, and existing content tables.
- Auto-fix invocations reuse the caller's JWT via the same `invokeSelf` pattern already in `run-campaign-agent`.
- Long-running jobs (drip generation, content hub) are launched with `EdgeRuntime.waitUntil`; the preflight response reports them as `pendingJobs` so the UI can poll and re-run preflight when done.
- Best-practice tables (`BEST_PRACTICE`) remain the single source of truth; new rules layer on top rather than replacing them.
- Funnel/drip detection reads `campaign_email_funnel.campaign_id` and `campaign_drip_series.channel_id` so the cadence exception is data-driven, not hardcoded per post.
