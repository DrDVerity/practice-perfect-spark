# Bundle.social campaign scheduling — end-to-end wiring

Goal: make the campaign → schedule → publish workflow coherent and powered by Bundle.social instead of the legacy Ayrshare stubs. After this lands, a user can pick a campaign, choose channels and times, and trust that Bundle.social will actually publish on schedule.

## Scope

In scope (this plan):
1. Database columns + migration to track Bundle.social team, social accounts, and post IDs.
2. New Bundle.social edge functions (provision team, get connect URL, schedule post, cron sweep).
3. `useBundleSocial` hook replacing `useAyrshare`. Old hook becomes a thin re-export so nothing breaks while we migrate call sites.
4. Schedule page (`/schedule`) — connect-channel button via Bundle.social OAuth, real channel status, per-channel scheduling that calls the new edge function.
5. `CampaignScheduler` component — schedule each `channel_post` through Bundle.social, show synced status.
6. Cron job (pg_cron + pg_net) hitting the new cron-publish endpoint every minute.

Out of scope (follow-up plans, will note in chat):
- Inbox, Recycler, Analytics tab, Calendar view product features.
- Removing the legacy `ayrshare-*` edge functions and `useAyrshare` hook entirely (kept as deprecated shims so the build doesn't break mid-migration).
- Migrating `channel_credentials` from username/password to OAuth (pre-prod TODO already tracked).

## Architecture

```text
            ┌──────────────────────────┐
            │  /schedule  +  Campaign  │
            │     Scheduler UI         │
            └────────────┬─────────────┘
                         │ supabase.functions.invoke
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  bundle-schedule-post   bundle-connect-url             │
   │  bundle-create-team     bundle-cron-publish            │
   └────────────┬───────────────────────────────────────────┘
                │ fetch (Bearer BUNDLE_SOCIAL_API_KEY)
                ▼
        api.bundle.social  ←→  social networks (FB, IG, LI, X, TT, YT)
                │
                ▼ webhook (later plan) updates channel_posts.bundle_post_status
```

Identifiers we store:
- `profiles.bundle_team_id` — one Bundle.social team per practice (created on first use).
- `channel_credentials.bundle_social_account_id` + `bundle_platform` — the Bundle.social account ID returned when the user connects a channel via OAuth.
- `channel_posts.bundle_post_id`, `bundle_post_status`, `publish_error`, `published_at` — sync state from Bundle.social.

## Steps

### 1. Database migration

Add nullable columns; backfill nothing.

```sql
alter table profiles            add column bundle_team_id text;
alter table channel_credentials add column bundle_social_account_id text,
                                add column bundle_platform text;
alter table channel_posts       add column bundle_post_id text,
                                add column bundle_post_status text,
                                add column publish_error text,
                                add column published_at timestamptz;
create index on channel_posts (status, scheduled_start)
  where bundle_post_id is null and publish_error is null;
```

### 2. Edge functions (`supabase/functions/`)

All use `BUNDLE_SOCIAL_API_KEY` (already in secrets) against `https://api.bundle.social/v1`. CORS + JWT validate in code.

- `bundle-create-team` — POST `/teams` for a practice if no `bundle_team_id` yet, store it on `profiles`.
- `bundle-connect-url` — POST `/teams/{teamId}/oauth-url` for a given platform, return the hosted URL. Frontend opens in a new tab; user returns and we re-fetch accounts.
- `bundle-sync-accounts` — GET `/teams/{teamId}/social-accounts`, upsert into `channel_credentials` so the UI shows what's actually connected.
- `bundle-schedule-post` — given a `postId`, look up the channel + team + matching social account, POST `/posts` with `{ text, mediaUrls, scheduledAt, socialAccountIds }`. Save `bundle_post_id`, set `status = 'scheduled'`.
- `bundle-cron-publish` — sweep `channel_posts` where `status='scheduled'`, `scheduled_start<=now()`, `bundle_post_id is null`, `publish_error is null` and delegate to `bundle-schedule-post` (immediate publish path).

### 3. Frontend

- `src/hooks/useBundleSocial.ts` — `createTeam`, `getConnectUrl(platform)`, `syncAccounts`, `schedulePost(postId)`. Toasts on success/failure, react-query invalidations for `channel-with-posts`, `campaigns-new`, `channel-credentials`.
- `src/hooks/useAyrshare.ts` — replace body with `export { useBundleSocial as useAyrshare }` shim so unrelated screens compile until they get migrated.
- `/schedule` (`src/pages/Schedule.tsx`):
  - Replace "Add Channel" username/password flow's primary button with **Connect via Bundle.social** (per platform) that calls `getConnectUrl` and opens the OAuth tab. Keep manual credential entry as a secondary "Advanced" option.
  - On window focus after OAuth, run `syncAccounts` and refresh credentials.
  - Schedule dialog now calls `schedulePost` for each selected channel at the chosen datetime.
- `CampaignScheduler.tsx` — when user picks a date/time per channel, persist `channel_posts.scheduled_start` and call `bundle-schedule-post`. Show `bundle_post_status` badges (Scheduled / Published / Failed) on each row.

### 4. Cron job

Use `supabase--insert` to register pg_cron (contains project-specific URL + service key) — never commit it as a migration.

```sql
select cron.schedule(
  'bundle-cron-publish',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/bundle-cron-publish',
       headers := jsonb_build_object('Content-Type','application/json',
                                     'Authorization','Bearer <service-role>'),
       body := '{}'::jsonb
     ); $$
);
```

Also unschedule the old `ayrshare-cron-publish` job if it exists.

### 5. Verification

- Deploy edge functions, then `curl_edge_functions` each one with a smoke payload.
- Walk through `/schedule` in preview: connect a fake channel, schedule a draft 2 minutes ahead, watch cron flip `bundle_post_status` to `published`.
- Confirm `useAyrshare` consumers (`ChannelEdit.tsx`, `Schedule.tsx`, `CampaignScheduler.tsx`) still compile via the shim.

## Open questions before I start

1. **OAuth-first or keep manual credentials too?** Bundle.social does OAuth for the user — I plan to make that the primary path and keep the existing username/password form as a fallback for unsupported channels. OK?
2. **Team granularity:** one Bundle.social team per practice (`profiles.user_id`)? I assume yes, but if you want one team per workspace or per location, say so.
3. **Reminders:** you asked me to remind you to build the four new product features (Inbox, Recycler, Analytics tab, Calendar view) — I'll mention them in chat after this lands; do you want a tracked TODO in `mem://` too?
