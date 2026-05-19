# Migration: Ayrshare → Bundle.social

Replace all Ayrshare references with Bundle.social. `BUNDLE_SOCIAL_API_KEY` is already configured.

## Bundle.social API basics

Base URL: `https://api.bundle.social/api/v1`
Auth header: `Authorization: Bearer <BUNDLE_SOCIAL_API_KEY>`

Endpoints we'll use:
- `POST /team/` — create a sub-team (one per client)
- `POST /team/connect-social-account/` — returns a hosted OAuth link
- `POST /post/` — create + schedule/publish a post

## 1. Database migration

Rename columns (keep data, drop comments referencing Ayrshare):

```sql
ALTER TABLE public.profiles
  RENAME COLUMN ayrshare_profile_id TO bundle_social_team_id;

ALTER TABLE public.channel_posts
  RENAME COLUMN ayrshare_post_id TO bundle_social_post_id;

-- Recreate the pending-publish index with the new column name
DROP INDEX IF EXISTS idx_channel_posts_pending_publish;
CREATE INDEX idx_channel_posts_pending_publish
  ON public.channel_posts (status, scheduled_start)
  WHERE bundle_social_post_id IS NULL AND publish_error IS NULL;

COMMENT ON COLUMN public.profiles.bundle_social_team_id IS
  'Bundle.social team ID for this client.';
COMMENT ON COLUMN public.channel_posts.bundle_social_post_id IS
  'Bundle.social post ID returned after publish.';
```

## 2. Edge functions

Rename directories and rewrite implementations:

| Old | New | Purpose |
|---|---|---|
| `ayrshare-create-profile` | `bundle-social-create-team` | Create client sub-team |
| `ayrshare-get-social-link` | `bundle-social-get-connect-link` | Hosted OAuth link |
| `ayrshare-publish-post` | `bundle-social-publish-post` | Publish a single post |
| `ayrshare-cron-publish` | `bundle-social-cron-publish` | Cron sweep |

Update `supabase/config.toml` blocks. Delete old functions via `delete_edge_functions`.

## 3. Frontend renames

- `src/hooks/useAyrshare.ts` → `src/hooks/useBundleSocial.ts`. Methods: `createTeam`, `getConnectLink`, `publishPost`.
- `src/hooks/useProfile.ts` — replace `ayrshare_profile_id` with `bundle_social_team_id`; `hasSocialToken` → `hasBundleSocialTeam`.
- Update all callers: `CreateClientDialog`, `CampaignAgentDialog`, `ChannelCredentialModal`, `ChannelEdit`, `Schedule`.
- All user-facing copy says "Bundle.social" or generic "social publishing" — never "Ayrshare".

## 4. Cleanup

- Delete `supabase/functions/ayrshare-*` dirs.
- Old migrations stay in history (don't rewrite history).
- Leave the cron schedule comment in the new cron function pointing at the new function URL.

## Risk

- Any client with a non-null `ayrshare_profile_id` will keep that value under the new column name but it's an Ayrshare key, not a Bundle.social team ID. On next publish attempt the API call will fail. Acceptable per user's "full swap now" choice — old IDs will need to be re-provisioned.
