# Connect Bundle.social Channel Awareness to Strategy Flow

Make the strategic plan flow channel-aware: generate the *ideal* plan first, then reconcile it against what's actually connected in Bundle.social, let the user edit, refine, accept, **connect / defer / skip** missing accounts, and only then begin campaign development.

## User-facing flow

1. **Generate ideal strategy** (unchanged). Agent produces the best plan without filtering by current Bundle.social connections.
2. **Connection check banner.** After the plan renders, the app fetches the client's connected social channels from Bundle.social and shows a panel above the plan:
   - Green check for each recommended channel already connected.
   - Amber warning listing channels the plan requires that are *not* yet connected, e.g. *"To implement this plan you'll need to connect: Instagram, LinkedIn, TikTok."*
   - Grey note for any recommended vector that Bundle.social does **not** support (e.g. outbound email, direct mail, billboards, radio): *"Your account manager will handle: Outbound Email, Direct Mail."*
3. **Edit mode on the strategy.** A new **Edit Plan** toggle makes the strategy markdown editable inline. User can change channel choices, budgets, tactics, etc.
4. **Refine Plan button** (appears only after an edit). Sends the edited plan back to the agent, which validates feasibility (channels exist, budget math works, schedule is realistic), rewrites the plan to be internally consistent, and returns it.
5. **Accept Plan → Connect Channels wizard.** For every Bundle.social-supported channel the plan needs but the account is missing, present one step at a time with three actions:
   - **Connect** — open Bundle.social hosted OAuth link in a new tab; on return, poll `bundle-social-list-channels` to confirm.
   - **Defer** — *keep the channel in the plan and keep its budget allocation.* The plan will be optimized assuming the user will connect it before publishing. At acceptance time **and** again at publish time, the user is prompted to connect or skip these deferred channels.
   - **Skip** — *remove the channel from the plan entirely.* Its budget is removed and the rest of the plan is rewritten/rebalanced around the remaining channels.
6. **Final rewrite on wizard close.** If anything was skipped or deferred, call `refine-campaign-strategy` once with `{ connectedChannels, deferredChannels, skippedChannels, unsupportedChannels }`. The rewrite must:
   - Drop every skipped channel and its budget; rebalance remaining allocations.
   - Keep every deferred channel **in the plan and in the budget**, flagged as *"pending connection"*.
   - Keep every unsupported-by-Bundle.social vector (e.g. outbound email, direct mail) in the plan and budget, flagged as *"handled by your account manager"*.
   - Optimize tactics, cadence, and creative direction around the **currently connected + deferred** channels (assume deferred ones will be connected before publish).
7. **Pre-publish gate.** Before any scheduled post is sent (in `bundle-social-cron-publish` and the manual publish path), check whether all deferred channels for that campaign are now connected. If not, prompt the user to **Connect** or **Skip** each remaining deferred channel (skipping at this stage removes the channel + its remaining budget and re-runs `refine-campaign-strategy`).
8. **Proceed to campaign development & scheduling** against the final accepted plan (existing `parse-strategy-allocations` → `campaign_channels` / `campaign_addons` / `campaign_budgets` seeding).

## Technical plan

### Data layer

- **New edge function `bundle-social-list-channels`** — calls Bundle.social `GET /team/{teamId}`, returns `[{ platform, connected, accountName, accountId }]`. `verify_jwt = true`.
- **New hook `useBundleSocialChannels`** in `src/hooks/useBundleSocial.ts`, React Query, 5-min stale time.
- **Supported-platform map** (shared constant) — the Bundle.social-supported set: `facebook, instagram, linkedin, twitter, tiktok, youtube`. Everything else (`mailchimp, beehive, internal_email, internal_sms`, all `KNOWN_ADDON_KEYS`) is treated as **manager-handled** in the wizard and rewrite.
- **Migration** — extend `campaigns` (or add a sibling `campaign_channel_status` table) with:
  ```sql
  ALTER TABLE campaign_channels
    ADD COLUMN connection_status text NOT NULL DEFAULT 'pending'
      CHECK (connection_status IN ('connected','deferred','skipped','manager_handled','pending'));
  ```
  Used by the pre-publish gate and the UI badges.
- Optional `profiles.bundle_social_connected_channels jsonb` + `..._refreshed_at` cache, refreshed after the wizard completes.

### Strategy generation (unchanged behavior)

- `campaign-agent` keeps producing the ideal plan with no channel filtering.
- The review UI computes `requiredChannels` from the agent's output and diffs against `useBundleSocialChannels()` → splits into `connected`, `missingSupported`, `unsupported`.

### Edit + Refine

- `CampaignAgentDialog`: `isEditing`, `editedStrategy`, **Edit Plan / Save** toggle, **Refine Plan** button (visible when edited).
- New edge function **`refine-campaign-strategy`** — body: `{ campaignId, editedStrategy?, connectedChannels, deferredChannels, skippedChannels, unsupportedChannels }`. System prompt instructs the model to:
  - Remove skipped channels entirely (and their budget).
  - Keep deferred channels with their budget; tag them *"(pending connection)"*.
  - Keep unsupported-by-Bundle.social vectors with their budget; tag them *"(managed by your account manager)"*.
  - Optimize tactics + creative for the union of `connected ∪ deferred` Bundle.social channels.
  Saves to `campaigns.strategy`.

### Accept + Connect wizard

- **`ConnectChannelsWizard`** modal. Props: `missingPlatforms`, `unsupportedPlatforms`, `profileUserId`.
  - Per platform shows **Connect / Defer / Skip**.
  - Unsupported platforms shown in a separate "Your account manager will handle these" panel — read-only, auto-marked `manager_handled`.
  - Tracks `{ connected, deferred, skipped }` arrays; persists results to `campaign_channels.connection_status`.
- On close: call `refine-campaign-strategy` with the three buckets, then run existing acceptance path (`parse-strategy-allocations` → seed channels/addons/budget → `status='active'`).

### Pre-publish gate

- Add a check in `bundle-social-publish-post` and `bundle-social-cron-publish`: for the campaign owning the post, look up `campaign_channels` where `connection_status = 'deferred'`. If any of those platforms are still not connected in Bundle.social, refuse to publish and return `{ requiresConnection: true, platforms: [...] }`.
- Client-side, the Schedule page and any "Publish now" button surface this response by re-opening `ConnectChannelsWizard` in "deferred-only" mode (only Connect or Skip; no Defer this time).

### Files to touch

```text
supabase/functions/
  bundle-social-list-channels/index.ts        (new)
  refine-campaign-strategy/index.ts           (new)
  bundle-social-publish-post/index.ts         (add deferred-channel gate)
  bundle-social-cron-publish/index.ts         (add deferred-channel gate)
supabase/migrations/<ts>_campaign_channel_connection_status.sql  (new)
supabase/config.toml                          (register new functions)
src/hooks/useBundleSocial.ts                  (add useBundleSocialChannels)
src/components/campaign/CampaignAgentDialog.tsx
  - connection banner (connected / missing / unsupported)
  - edit mode + Refine Plan
  - Accept handler -> wizard
src/components/campaign/ConnectChannelsWizard.tsx   (new, supports Connect/Defer/Skip + deferred-only mode)
src/components/campaign/StrategyConnectionStatus.tsx (new)
src/lib/bundleSocialPlatforms.ts              (new: SUPPORTED_PLATFORMS constant)
src/pages/Schedule.tsx                        (surface pre-publish gate)
```

## Out of scope

- Replacing `channel_credentials` plaintext flow (pre-prod TODO).
- Scheduling UI redesign.
- Auto-publishing decisions.
