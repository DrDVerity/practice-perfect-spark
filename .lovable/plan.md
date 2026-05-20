# Account structure: impersonation, team invites, shared Bundle.social

## What we have today

The codebase has a clean multi-tenant model that's only partially wired up:

```text
accounts (the "client account" — one per practice)
  └─ account_members (owner + members)
       └─ location_members (which locations each user can access)
  └─ locations
profiles.user_id            → keyed by auth user, holds bundle_social_team_id
profiles.parent_account_id  → legacy sub-account model (admin-create-sub-account)
account_invites             → token-based invites (already implemented in WorkspaceSettings)
```

Gaps:

- **Admin "impersonation"** is just a `?clientId=` query param on `/dashboard` and `/knowledge-base`. It doesn't cover Schedule, Channel editor, Campaign editor, Workspace Settings, or KB writes. There's no session-level swap and no banner.
- **Team invites** exist in `WorkspaceSettings` but the entry point is buried — owners don't discover it from the Dashboard.
- **Bundle.social** is keyed on `profiles.bundle_social_team_id`. When an invited team member signs in, their own profile has no team, so publish/connect calls fail for them even though the owner has a connected team.

## What we'll build

### 1. Full-session admin impersonation with a banner

- New `ImpersonationProvider` (sessionStorage-backed) exposes `impersonatedUserId` and `effectiveUserId` (= impersonatedUserId ?? auth user id).
- `WorkspaceContext` rebased on `effectiveUserId` so when an admin impersonates a client, the whole app (Dashboard, Schedule, KB, Channels, Campaign editor, Workspace Settings) loads that client's account, locations, campaigns, and channels exactly as the owner sees them.
- Persistent top banner: "Viewing as {practice_name} — Exit impersonation". Visible on every authenticated page.
- Admin starts impersonation from the existing AdminDashboard client rows ("View as client" button, replaces today's `/dashboard?clientId=` link).
- Backwards compat: existing `?clientId=` links auto-promote to a real impersonation session on load.

### 2. Owners adding team members (keep invite flow, polish it)

- Keep `account_invites` as the canonical model. Mark the `parent_account_id` / `admin-create-sub-account` path as deprecated (we won't rip it out in this pass).
- Add a "Team" entry point on the Dashboard sidebar/header for owners that deep-links to `/account` (the existing Workspace Settings page) on the Invites tab.
- AcceptInvite already handles `account_members` + `location_members`. We'll add a check that prevents creating a new Bundle.social team for the invitee (see #3).

### 3. Bundle.social: members share the owner's team

- `bundle_social_team_id` stays on `profiles` for the **owner only**. Stop provisioning a team for invited members.
- Add a SECURITY DEFINER helper `public.bundle_social_team_for_user(_user_id uuid)` that returns the team id of the owner of the user's primary account. Falls back to the user's own profile (covers admin-created standalone clients).
- Update the three places that read `bundle_social_team_id`:
  - `useProfile` / `useBundleSocial` (frontend hook) — resolve via the helper.
  - `supabase/functions/bundle-social-get-connect-link` — look up owner's team for the effective user.
  - `supabase/functions/bundle-social-publish-post` — same.
- AcceptInvite: no Bundle.social call. The invited member transparently uses the owner's connected channels.
- Owner-facing copy in WorkspaceSettings → Team tab: "Team members publish through your connected Bundle.social channels."

## Technical details

### Files added

- `src/contexts/ImpersonationContext.tsx` — provider + `useImpersonation()` hook, sessionStorage key `impersonatedUserId`.
- `src/components/ImpersonationBanner.tsx` — sticky top banner, fetches impersonated practice name, "Exit" button.
- Migration: `bundle_social_team_for_user(uuid) returns text` SECURITY DEFINER function.

### Files edited

- `src/App.tsx` — wrap auth routes with `ImpersonationProvider`, mount banner.
- `src/contexts/WorkspaceContext.tsx` — use `effectiveUserId` instead of `user.id` when loading account/locations.
- `src/hooks/useProfile.ts` — when fetching profile under impersonation, fetch the impersonated profile; resolve `bundle_social_team_id` via the helper.
- `src/hooks/useBundleSocial.ts` — pass `effectiveUserId` (or impersonated user) to edge functions.
- `src/pages/AdminDashboard.tsx` — replace `navigate('/dashboard?clientId=…')` with `startImpersonation(clientUserId)`.
- `src/pages/Dashboard.tsx`, `src/pages/KnowledgeBase.tsx` — drop bespoke `clientId` handling in favor of `effectiveUserId`; keep a one-time migration that converts `?clientId=` into an impersonation session.
- `src/pages/WorkspaceSettings.tsx` — add intro copy on the Invites tab clarifying Bundle.social sharing; add a "Team" CTA on Dashboard.
- `supabase/functions/bundle-social-get-connect-link/index.ts` — resolve owner's team via the new RPC.
- `supabase/functions/bundle-social-publish-post/index.ts` — same.
- `src/pages/AcceptInvite.tsx` — no Bundle.social provisioning for invitees.

### Out of scope (call out, don't build)

- Removing the `parent_account_id` / `admin-create-sub-account` legacy path.
- Migrating existing per-member `bundle_social_team_id` rows (any pre-existing member team ids will simply be ignored in favor of the owner's).
- OAuth migration for `channel_credentials` (already tracked as a separate pre-prod item).
