# Multi-Location Workspaces

Add a workspace layer so a single practice account can manage multiple locations, each with its own team members, knowledge base, campaigns, and channels. Group-level KB is automatically merged with each location's KB whenever AI runs.

## Hierarchy

```text
Account (practice group, billed entity)
 ├── Group Knowledge Base (shared with all locations)
 ├── Members (Account Owner only at this level for now)
 └── Locations (1..N)
      ├── Location KB (merged with Group KB at read time)
      ├── Location Members (Account Owner + future location roles)
      ├── Campaigns / Channels / Posts
      └── Connected social channels
```

Single-location practices keep working unchanged — every existing account is auto-migrated to one default location named after their practice.

## In Scope

1. New tables: `accounts`, `locations`, `account_members`, `location_members`.
2. Migrate existing data: one `account` per current `profiles.user_id`, one default `location` per account, current user becomes `Account Owner` of both.
3. Add `location_id` (nullable on group-level rows, required on location-level rows) to `campaigns`, `campaign_vault`, `channel_credentials`, `channel_posts`'s parent chain, and `knowledge_base`. KB rows also get a `scope` of `group` or `location`.
4. Replace `is_manager_of(user, client)` membership checks with new `is_account_member(user, account)` and `is_location_member(user, location)` security-definer functions; rewrite RLS on every affected table to use them.
5. Invite flow: Account Owner invites a member by email → email-based invite token → on signup/login, member joins the account and is granted access to one or more locations.
6. UI:
   - **Workspace switcher** in the header: shows current Account → Location, lets the user switch locations they belong to.
   - **Settings → Locations**: add/rename/delete locations, list members per location, send invites, revoke access.
   - **Settings → Members**: list all account members, see which locations each belongs to, change their location assignments.
   - **Knowledge Base page**: tabbed "Group KB" / "Location KB" — group tab only editable by Account Owner; location tab editable by location members. AI always sees both merged.
7. Active-location context (React context + persisted in `localStorage`): every existing campaign/channel/post query filters by active `location_id`; every insert stamps it.
8. Keep `manager_assignments` and `is_manager_of` working as a deprecated shim during transition; admin view-as keeps functioning.

## Out of Scope (this plan)

- Bundle.social scheduling rebuild (follow-up plan, will key off `location_id` for team/channel ownership).
- Location-level non-owner roles (Location Admin / Editor / Viewer). Schema leaves room; UI only exposes "Account Owner" + "Member" for now per your answer.
- Per-doc KB overrides — both KBs are merged, no precedence.
- Cross-location reporting/rollups.

## Technical Details

### New tables

- `accounts` — `id`, `name`, `owner_user_id`, `created_at`. One row per practice group.
- `locations` — `id`, `account_id`, `name`, `address`, `timezone`, `created_at`. Multiple per account.
- `account_members` — `account_id`, `user_id`, `role` (`owner` | `member`), `created_at`. PK `(account_id, user_id)`.
- `location_members` — `location_id`, `user_id`, `created_at`. PK `(location_id, user_id)`. Membership = access to that location's data.
- `account_invites` — `id`, `account_id`, `email`, `token`, `invited_locations uuid[]`, `expires_at`, `accepted_at`.

### Security-definer helpers

```sql
is_account_member(_user uuid, _account uuid) returns boolean
is_account_owner (_user uuid, _account uuid) returns boolean
is_location_member(_user uuid, _location uuid) returns boolean
```

All `SECURITY DEFINER`, `STABLE`, `SET search_path = public` — same pattern as existing `is_admin`/`is_manager_of`. Avoids recursive RLS.

### Schema additions

- `profiles.account_id uuid` (the account the user primarily belongs to; nullable for admins).
- `campaigns.location_id uuid not null` (backfilled to each account's default location).
- `campaign_vault.location_id uuid not null` (same backfill).
- `channel_credentials.location_id uuid not null`.
- `knowledge_base.account_id uuid not null`, `knowledge_base.location_id uuid null`, `knowledge_base.scope text check (scope in ('group','location'))`. Backfill all existing KB rows as `scope='location'` on the user's default location, plus copy any "shared" docs to `scope='group'` (we'll just leave them as location for the migration — owner can promote later via UI).
- All existing `user_id` columns stay (audit trail), but RLS no longer routes through them.

### RLS rewrite (per affected table)

Pattern:
```sql
-- SELECT
using ( is_admin(auth.uid())
     or is_location_member(auth.uid(), location_id) )
-- INSERT / UPDATE / DELETE  
with check ( is_location_member(auth.uid(), location_id) )
```

Group-scoped KB rows use `is_account_member` instead.

### Active location context

- `src/contexts/WorkspaceContext.tsx` exposes `{ account, locations, activeLocation, setActiveLocation }`.
- Loaded once on auth, persisted to `localStorage` (`activeLocationId`).
- All data hooks (`useCampaigns`, `useKnowledgeBase`, `useChannelCredentials`, etc.) read `activeLocation.id` and pass it in queries + inserts.

### KB merge at read time

Wherever AI edge functions pull KB (`kb-search`, prompt assembly in `campaign-generate`, etc.), query:
```sql
select * from knowledge_base
where account_id = $1
  and (scope = 'group' or location_id = $2)
```
No precedence logic — concatenate both into the prompt.

### Migration order

1. Create new tables + helpers.
2. Backfill: one account + one location per existing user; populate `*_members`; stamp `location_id` on all existing rows.
3. Make new columns `NOT NULL`.
4. Replace RLS policies on each affected table (drop old, create new).
5. Ship UI: switcher → settings → invites → KB tabs.

## Open Questions

1. **Invites**: send via Resend (need to add the connector) or just generate a copy-paste invite link for now?
2. **Admin impersonation**: keep the `?clientId=` query param working by mapping `clientId` → that user's account/default location, OK?
3. **Existing `parent_account_id` on `profiles`**: deprecate it (we have a real `accounts` table now) or keep as a denormalized pointer? Recommend deprecating.
