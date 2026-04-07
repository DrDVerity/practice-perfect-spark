

## Plan: Manager Role Enforcement, Campaign Modalities, Smart Practice Reports, and Campaign Agent

This plan covers four areas: (1) manager role behavior, (2) additional campaign modality tiles, (3) smart practice report caching, and (4) a KB-based "system prompt" section with a campaign agent button.

---

### 1. Manager Role — Acts as Admin for Assigned Clients

**Current state**: `isManager` and `managedClientIds` already exist in `useAuth`. RLS policies already grant managers access to assigned client data. The UI already shows admin-like features when `isAdmin || isManager`.

**Changes needed**: Minimal. The manager already functions as an admin for assigned clients. We will:
- Ensure the Manager Dashboard (currently shares `/admin` route) shows only assigned clients' data, not all clients — verify and fix filtering in `AdminDashboard.tsx`
- No schema changes needed

### 2. Campaign Modality Tiles on `/campaign/:id`

**What**: Below the existing 3 channel cards (Social Media, Email, SMS), add a new "Campaign Add-Ons" section with small tiles for additional modalities.

**Modalities to include**:
- Google Ads
- Local Service Ads (LSA)
- Geotargeted Campaigns
- Influencer Marketing
- Direct Mail
- Billboards / OOH
- Radio / Podcast Ads
- Referral Programs
- Community Events / Sponsorships
- Content Marketing / Blog

**Behavior**: Clicking a tile opens a dialog with:
- A description of the modality and why it works for healthcare/dental practices
- An "Include in Campaign" button (adds a `campaign_channel` with a new platform type or stores as metadata)
- A "Close" button

**Schema change**: Add new platform enum values to support these modalities, OR store them as custom channel credentials. Given the existing `custom` platform type and credential system, we will use `channel_credentials` entries tagged to the campaign to track these add-ons without schema changes. Alternatively, we can add a `campaign_addons` table for cleaner separation.

**Recommended approach**: Create a new `campaign_addons` table:
```sql
CREATE TABLE public.campaign_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  addon_type text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_addons ENABLE ROW LEVEL SECURITY;
-- RLS: same pattern as campaign_channels (check campaign ownership)
```

### 3. Smart Practice Report Button

**What**: The "Practice Report" button on `/campaign/:id` should check if a report exists in the KB (`doc_type = 'market_analysis'` or a dedicated type) created within the last 6 months. If yes, hide the button. If no, show it.

**Changes**:
- In `CampaignEditNew.tsx`, query the KB for practice report documents for the campaign owner
- Check `updated_at` — if any report is < 6 months old, hide the button
- When generating a report via `GeneratePracticeReportDialog`, save it to the KB (it may already do this — verify)
- Pass the existing report content to generation functions so they use it instead of regenerating

**Files**: `CampaignEditNew.tsx`, `GeneratePracticeReportDialog.tsx`

### 4. Knowledge Base — Agent System Prompt Section

**What**: On `/knowledge-base`, add a new document type `system_prompt` for the campaign agent's instructions.

**Changes**:
- Add `system_prompt` to the `kb_document_type` enum via migration
- Add a dedicated "Campaign Agent Instructions" section/tile on the KB page
- Users can write/edit a system prompt that instructs how the AI agent should create campaigns

**Campaign Agent Button on `/campaign/:id`**:
- Add a floating or header button "Campaign Agent" on the campaign edit page
- Clicking it opens a chat-style dialog
- The agent uses the system prompt from KB + practice report + campaign context to assist
- Calls the AI gateway edge function with the system prompt and campaign data
- Displays suggestions for content, channels, scheduling

---

### Files to Create/Modify

| File | Changes |
|------|---------|
| **Migration SQL** | Add `campaign_addons` table; add `system_prompt` to `kb_document_type` enum |
| `src/pages/CampaignEditNew.tsx` | Add modality tiles section, smart report button logic, campaign agent button + dialog |
| `src/pages/KnowledgeBase.tsx` | Add system prompt tile/section |
| `src/hooks/useKnowledgeBase.ts` | Add `system_prompt` to `KBDocumentType` |
| `src/hooks/useCampaignAddons.ts` | New hook for CRUD on `campaign_addons` table |
| `src/components/campaign/CampaignAddonDialog.tsx` | New — dialog showing addon description + include button |
| `src/components/campaign/CampaignAgentDialog.tsx` | New — chat dialog for campaign agent |
| `src/pages/AdminDashboard.tsx` | Filter manager view to only assigned clients |

### Technical Details

- The campaign agent will call `supabase.functions.invoke('generate-post')` or a new edge function with the KB system prompt as context
- Modality tiles will be a static array of objects with `{ key, label, icon, description }` rendered as a grid of small cards
- The 6-month check uses `new Date(doc.updated_at) > sixMonthsAgo` on practice report KB docs
- Manager filtering in AdminDashboard uses `managedClientIds` from `useAuth` to filter profiles and campaigns queries

