## Findings

- The campaign is not actually reaching the publish function. The browser only called `publish-campaign-preflight`.
- Preflight is returning `ok: false`, so **Publish now** is disabled. The hidden failing checks are:
  - `internal_email: has posts` → no drafted posts
  - `youtube: has posts` → no drafted posts
- The Fit Campaign button currently redistributes only existing scheduled items. It does not create missing posts for selected channels, and it may leave the preflight dialog showing stale results after dates are changed.
- The publish function still runs Bundle.social handoff inline for every social post, which can cause the app to appear stuck if it ever reaches publish with many media uploads.

## Plan

1. **Fix Fit Campaign scheduling**
   - Update the schedule component so Fit Campaign uses the campaign start/end dates as date-only boundaries.
   - Redistribute all existing channel posts evenly inside the campaign window.
   - Preserve each post’s time when possible, but clamp every scheduled date/time inside the campaign window.
   - After fitting, refresh the parent campaign data so the campaign page and preflight checks see the new dates immediately.

2. **Make missing-channel blockers obvious**
   - In the preflight dialog, keep the Publish button disabled when checks fail, but add a clear failed-check summary at the bottom so users do not need to scroll to discover why publishing is blocked.
   - Change the disabled publish label to something like **Resolve checks first** when preflight fails.

3. **Correct preflight rules for non-social channels**
   - Treat email/SMS-style channels differently from social post channels.
   - Do not block Bundle.social publishing because `internal_email` has no `channel_posts`; email nurture should be validated through the email funnel/drip data instead.
   - For YouTube/TikTok, keep requiring generated video/post content if the platform is selected as a social publishing channel.

4. **Add an auto-repair path for empty selected social platforms**
   - If a selected social platform such as YouTube has no posts, show a clear action in preflight/schedule: **Generate missing posts**.
   - Wire this to the existing campaign generation flow so the agent creates missing platform posts instead of leaving the campaign unpublishable.

5. **Prevent publish from hanging**
   - Refactor `publish-campaign` to return quickly after preflight passes.
   - Mark campaign/posts as queued/scheduled, then dispatch Bundle.social posting work in the background with status updates.
   - The UI should close the preflight modal after a successful queue response and show a status message such as **Campaign queued for publishing**.

6. **Surface post handoff status**
   - Show Bundle.social results/errors from `channel_posts.publish_error` near the schedule/posts area.
   - If a platform is not connected or Bundle.social rejects a post, users will see the exact post/platform that failed instead of the app appearing frozen.

## Technical notes

- Frontend files likely affected:
  - `src/components/campaign/CampaignScheduler.tsx`
  - `src/components/campaign/PublishPreflightDialog.tsx`
  - `src/pages/CampaignEditNew.tsx`
- Backend functions likely affected:
  - `supabase/functions/publish-campaign-preflight/index.ts`
  - `supabase/functions/publish-campaign/index.ts`
- No database schema change appears required for the core fix, because existing post status and publish error fields can be reused.