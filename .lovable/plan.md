

## Plan: Platform Credential Gate + Schedule Page Improvements

### What changes

1. **Replace "Connect Accounts" / "Add Channel" dialogs on `/schedule` with the existing `ChannelCredentialModal`**
   - Remove the current inline `showConnectDialog` and `showAddChannelDialog` dialogs that only capture an account handle
   - Import and use `ChannelCredentialModal` (already exists) which captures platform name, URL, username, and password
   - Wire it to `useChannelCredentials` hook so credentials persist in the `channel_credentials` database table
   - The "Connected Channels" section will read from `useChannelCredentials` instead of local state

2. **Credential gate when scheduling**
   - When a user clicks "Schedule" on a draft campaign, check if a matching credential exists in `channel_credentials` for that campaign's platform
   - If no credential found, open the `ChannelCredentialModal` pre-filled with the platform name, requiring them to enter URL/username/password before proceeding
   - Once saved, continue to the schedule dialog

3. **"Ready to Schedule" table action icons**
   - Add an **edit icon** (pencil) on each draft campaign row that navigates to the campaign edit page
   - Add a **remove icon** (trash) on each draft campaign row that deletes or unschedules it
   - Add a **"Remove All"** icon (trash) next to the "Ready to Schedule" heading to clear all draft campaigns

### Files modified

- **`src/pages/Schedule.tsx`** — Main changes:
  - Remove local `connectedChannels` state; replace with `useChannelCredentials()` hook data
  - Remove the two inline dialog components (`showConnectDialog`, `showAddChannelDialog`)
  - Add `ChannelCredentialModal` component with add/edit/delete wired to the hook
  - Connected Channels section renders from `credentials` array with edit capability
  - `handleScheduleClick` checks `credentials` for matching platform before allowing scheduling
  - Add edit (pencil), remove (trash) icons per draft campaign row; add "Remove All" trash icon in the table header

### Technical details

- `useChannelCredentials` already handles CRUD with proper RLS policies
- `ChannelCredentialModal` already supports add/edit/delete modes
- The credential check will match `credential.platform_name.toLowerCase()` against the campaign's platform field
- "Remove" on a draft campaign will call `deleteCampaign` or update status to `canceled` from `useCampaigns`
- No database schema changes needed — `channel_credentials` table already exists with all required columns

