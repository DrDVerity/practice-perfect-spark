# Connect Bundle.social Channel Awareness to Strategy Flow

Make the strategic plan flow channel-aware: generate the *ideal* plan first, then reconcile it against what's actually connected in Bundle.social, let the user edit, refine, accept, and connect missing accounts before campaign development begins.

## User-facing flow

1. **Generate ideal strategy** (unchanged). Agent produces the best plan without filtering by current Bundle.social connections.
2. **Connection check banner.** After the plan renders, the app fetches the client's connected social channels from Bundle.social and shows a panel above the plan:
   - Green check for each recommended channel already connected.
   - Amber warning listing channels the plan requires that are *not* yet connected, e.g. *"To implement this plan you'll need to connect: Instagram, LinkedIn, TikTok."*
3. **Edit mode on the strategy.** A new **Edit Plan** toggle makes the strategy markdown editable inline (textarea / rich editor). User can change channel choices, budgets, tactics, etc.
4. **Refine Plan button** (appears only after an edit). Clicking it sends the edited plan back to the agent, which:
   - Validates feasibility (channels exist, budget math works, schedule is realistic).
   - Rewrites the plan to be internally consistent and implementable.
   - Returns the rewritten plan plus a short note: *"Plan has been rewritten to account for your edits and is ready to accept."*
5. **Accept Plan.** On acceptance:
   - If any recommended channels are still unconnected, launch a **Connect Channels wizard**: one Bundle.social connect link per missing platform, presented one at a time.
   - Each step has **Connect** and **Skip this platform** buttons.
   - When all are handled, if any were skipped, the agent silently rewrites the plan to remove/replace skipped channels and shows the final accepted version.
6. **Proceed to campaign development & scheduling** (existing `parse-strategy-allocations` → channels/posts/budget seeding flow runs against the final accepted plan).

## Technical plan

### Data layer (steps 1–2 from prior discussion)

- **New edge function `bundle-social-list-channels`** — given the caller's effective `bundle_social_team_id` (reuse `bundle_social_team_for_user` RPC), call Bundle.social `GET /team/{teamId}` (or equivalent connected-accounts endpoint) and return a normalized list: `[{ platform: 'INSTAGRAM', connected: true, accountName, accountId }, ...]`. `verify_jwt = true`.
- **New hook `useBundleSocialChannels(profileUserId?)`** in `src/hooks/useBundleSocial.ts` (or a sibling file) — React Query, 5-min stale time.
- **Profile cache (optional, lightweight):** add `profiles.bundle_social_connected_channels jsonb` + `..._refreshed_at timestamptz` via migration so the strategy agent can read it without an extra HTTP call. Refresh on demand and after the connect wizard completes.

### Strategy generation (unchanged behavior, new metadata)

- `campaign-agent` keeps producing the ideal plan with no channel filtering.
- After streaming finishes, the strategy review UI runs `useBundleSocialChannels` and computes `requiredChannels` (parsed from `campaign_channels` rows the agent recommended) vs `connectedChannels`. Render the banner described above.

### Edit + Refine

- `CampaignAgentDialog` (or wherever the strategy markdown is shown) gets:
  - `isEditing` state, `editedStrategy` string.
  - **Edit Plan / Save** toggle.
  - **Refine Plan** button visible only when `editedStrategy !== originalStrategy`.
- New edge function **`refine-campaign-strategy`** — takes `{ campaignId, editedStrategy, connectedChannels }`, calls the same OpenRouter model with a "validate + rewrite for implementability" system prompt, returns the rewritten markdown. Saves to `campaigns.strategy` on success.

### Accept + Connect wizard

- New component **`ConnectChannelsWizard`** (modal). Props: `missingPlatforms: string[]`, `profileUserId`.
  - For each platform: call existing `bundle-social-get-connect-link` (it already returns a hosted OAuth URL). Show **Connect** (opens link in new tab) and **Skip**.
  - After Connect, poll `bundle-social-list-channels` (or wait for user to click "I've connected, continue") to confirm.
  - Track `skipped: string[]`.
- On wizard close: if `skipped.length > 0`, call `refine-campaign-strategy` once more with `{ ..., removeChannels: skipped }` so the saved plan reflects reality.
- Then run the existing acceptance path: `parse-strategy-allocations` → seed `campaign_channels`, `campaign_addons`, `campaign_budgets` → mark campaign `status = 'active'` → continue to scheduling.

### Files to touch

```text
supabase/functions/
  bundle-social-list-channels/index.ts        (new)
  refine-campaign-strategy/index.ts           (new)
supabase/config.toml                          (register new functions)
src/hooks/useBundleSocial.ts                  (add useBundleSocialChannels)
src/components/campaign/CampaignAgentDialog.tsx
  - connection banner
  - edit mode + Refine Plan button
  - Accept handler -> wizard
src/components/campaign/ConnectChannelsWizard.tsx   (new)
src/components/campaign/StrategyConnectionStatus.tsx (new, small)
```

Optional migration:
```text
supabase/migrations/<ts>_profile_bundle_channels_cache.sql
  ALTER TABLE profiles
    ADD COLUMN bundle_social_connected_channels jsonb,
    ADD COLUMN bundle_social_channels_refreshed_at timestamptz;
```

## Out of scope

- Replacing `channel_credentials` plaintext flow (already tracked as pre-prod TODO).
- Changing the scheduling UI itself.
- Auto-publishing or auto-posting decisions.

## Open question (one)

Should "Skip this platform" in the connect wizard **remove** the channel from the plan entirely, or **mark it as deferred** (keep in plan, flag as "not yet connected") so the user can come back later? Default in this plan: remove and rewrite. Tell me if you want deferred instead.
