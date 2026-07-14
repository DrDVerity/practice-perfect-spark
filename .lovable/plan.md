## Hierarchical Acceptance Structure for Campaigns

Refactor the campaign edit page (`src/pages/CampaignEditNew.tsx`) to introduce a top-down "Accept" cascade, plus fix missing email-funnel generation for existing campaigns with email channels.

---

### 1. Top of page — replace "Refresh Strategic Plan" and "Campaign Agent"

- **Remove** the `PlanDriftBanner` "Refresh strategic plan" banner button from the top of the campaign page (keep the drift-detection logic, but silence the banner or convert it into a subtle inline hint on the Strategic Plan row).
- **Remove** the top-right "Campaign Agent" header button (line ~1021–1028) that sits next to `Publish Campaign`.
- **Add** an `Accept Campaign` button in its place. Clicking it:
  - Sets `assets_accepted` for every section: `plan`, `budget`, `blog`, `funnel`, `channels`, `landing`, `vectors`, plus every child (each channel, each post, each drip series, each funnel email, each vector).
  - Marks `budget.accepted = true`.
  - Confirms via a small dialog ("Accept all assets in this campaign?").
- Keep the `Publish Campaign` button unchanged.

### 2. "Campaign Setup" band (below the blog) — replace inline Campaign Agent button

- Replace the current "Campaign Agent" button in the row of section-header controls with an **Accept** button that cascades acceptance to every underlying section (same effect as top-level Accept, but scoped to setup sections: Focus, Strategic Plan, Budget, Landing Page, Channels, Vectors).
- The floating "Campaign Agent" FAB (bottom/top-right) stays — it's still the entry point to open the agent dialog.

### 3. Per-section Accept icon (next to the Edit pencil)

Add a `CheckCircle` accept icon next to the `Pencil` "Edit" affordance on every section row:

| Section | Cascade on Accept |
|---|---|
| Focus | Marks focus text accepted (no children) |
| Strategic Plan | `assets_accepted.plan = true` |
| Budget | `budget.accepted = true` + all allocations |
| Landing Page | `assets_accepted.landing = true` + all funnel emails |
| Channels | Every channel + every generated post accepted |
| Vectors | Every add-on accepted |
| Blog (existing) | Already has Accept — keep as-is (accepts image + text + article together) |

Visual state: accepted icon turns green + shows `✓ Accepted` badge; clicking again toggles off.

### 4. Post-level acceptance (already partially wired)

When a user drills into a specific platform and opens a post, the existing Edit dialog already has: Edit, Regenerate, Accept. Confirm this remains intact and that cascade from the Channels-level Accept marks every child post `accepted = true` in `channel_posts`.

### 5. Email funnel bug fix

The user reports an email channel exists but no email sequence was developed. Two paths to remediate:
- **Auto-heal on load**: if campaign has an email channel and `campaign_email_funnel` rows are 0 and `generation_status` isn't in-progress, show a "Generate email sequence" prompt in the Landing Page → Email Funnel panel (already surfaced there) and/or automatically invoke `generate-email-funnel` when Accept is triggered on the Landing or Channels section.
- **Add a manual "Generate" button** in `CampaignEmailFunnelPanel` if not already present, so users can trigger the sequence for legacy campaigns.

---

### Technical Notes

- `setAssetAccepted(key, value)` helper already exists in `CampaignEditNew.tsx` — extend it to a `setAssetsAccepted(keys[])` batch helper and a `acceptCampaignCascade()` method that also updates child tables (`channel_posts.accepted`, `campaign_drip_messages.accepted`, `campaign_email_funnel.accepted` — add column if missing, `campaign_budgets.accepted`).
- New reusable `<AcceptSectionButton accepted onToggle />` component to keep the accept UI consistent across all section headers.
- Migration (small): add `accepted BOOLEAN DEFAULT false` to `campaign_email_funnel` and `campaign_addons` if not already present; verify `channel_posts.accepted` exists (it does).
- Keep `PlanDriftBanner` component file but stop rendering it at the top; optionally surface drift as a small badge on the Strategic Plan row.
- No changes to backend orchestrator required except optionally auto-invoking `generate-email-funnel` when Accept is clicked on a campaign that has email channels but no funnel rows.

### Files to modify
- `src/pages/CampaignEditNew.tsx` (main refactor)
- `src/components/campaign/AcceptSectionButton.tsx` (new)
- `src/components/campaign/CampaignEmailFunnelPanel.tsx` (add manual generate button if missing)
- Migration: add `accepted` columns where missing
