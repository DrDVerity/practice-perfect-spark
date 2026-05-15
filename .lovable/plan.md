# Generate Strategy — Budget Prompt, Manager Handoff, Ayrshare Split

## 1. Budget prompt before strategy generation

When the user clicks **Generate Strategy** in `CampaignAgentDialog.tsx`:

1. Open a small **Budget Prompt dialog** asking:
   > "Enter a campaign budget if you want paid advertising included. Leave blank for an organic social-only campaign."
   - Single numeric input + helper text.
   - Buttons: **Generate with Budget** / **Generate Organic-Only (no spend)**.
2. Pass the chosen mode to `campaign-agent`:
   - `budgetMode: 'paid' | 'organic'`
   - `budgetTotal: number | 0`
3. Update `campaign-agent/index.ts` system prompt:
   - **Organic mode:** Generate a social-media-only plan, no paid ads, no boosted posts, no budget table. Strategy must explicitly state "$0 spend / organic only".
   - **Paid mode:** Calculate optimal allocation across channels/vectors for best ROI, include the budget table.

## 2. Strategy approval action buttons

After the streamed strategy finishes rendering in `CampaignAgentDialog`, show three buttons under the report:

- **Accept Strategy** — saves strategy, triggers manager handoff (if budget) + Ayrshare generation.
- **Edit** — opens the strategy in an editable textarea, save updates `campaigns.strategy`.
- **Regenerate** — re-runs generate with same inputs.

(Replaces the current Generate Strategy / Generate Campaign buttons post-generation.)

## 3. Manager handoff on Accept (paid budget only)

On **Accept** when `budgetTotal > 0`:

1. Look up `manager_assignments` for this campaign's `user_id`.
2. If none exists, find or create a manager profile for **Alyssa** (seed a `profiles` row + `user_roles` `manager` if missing) and insert a `manager_assignments` row assigning Alyssa to the client. Flag this as a new assignment.
3. Generate a **PDF** of the full strategic plan (including budget allocation + ad placements). Use `jspdf` client-side from the markdown strategy.
4. Call new edge function `notify-manager-strategy`:
   - Inputs: `managerEmail`, `managerUserId`, `clientName`, `campaignName`, `campaignId`, `strategyMarkdown`, `budgetTotal`, `budgetAllocations`, `pdfBase64`, `isNewAssignment`.
   - Sends email via Lovable transactional email (`send-transactional-email`) with two new templates:
     - `manager-strategy-handoff` — existing manager.
     - `manager-new-assignment` — first-time assignment + strategy.
   - PDF is attached as a download link (Supabase storage upload to `kb-files` bucket, signed URL).
   - Also inserts a `messages` row to manager (subject "New campaign strategy: {name}", body = summary + link to PDF) so it lights up the manager dashboard.

## 4. Ayrshare MCP generation (Accept always)

On **Accept** (regardless of budget):

1. Build a **shortened focused campaign summary** by stripping all paid/budget sections from the strategy:
   - Drop sections: Budget Allocation Table, paid Ad Content & Creative for paid placements, KPIs tied to ad spend.
   - Keep: Executive Summary, Target Audience, Channel Strategy (organic only), Content Calendar, organic post copy.
   - Implementation: regex pre-filter + AI condense pass (new helper in `topic-blog-research`-style edge function `summarize-organic-campaign`).
2. Call existing Ayrshare flow (`ayrshare-publish-post` is per-post; for campaign-wide generation we wire into `generate-content-hub` which already creates posts from a brief). Pass the organic-only summary as the brief.
3. Posts are created in `channel_posts` with `status='draft'` — user can review/schedule.

## 5. Manager dashboard update

`ManagerDashboard.tsx` already lists assigned campaigns + messages. New assignment + new message will surface automatically once the rows are inserted. Add a small "New" badge for assignments created in the last 24h (already partially supported via `created_at` — verify display).

## Technical details

**New / changed files:**
- `src/components/campaign/BudgetPromptDialog.tsx` — new modal.
- `src/components/campaign/CampaignAgentDialog.tsx` — replace Generate Strategy click → open BudgetPromptDialog; add Accept/Edit/Regenerate buttons after stream; on Accept run handoff + Ayrshare flow; PDF generation via `jspdf`.
- `supabase/functions/campaign-agent/index.ts` — accept `budgetMode` + adjust system prompt for organic vs paid.
- `supabase/functions/notify-manager-strategy/index.ts` — new edge function (handles Alyssa fallback, sends email + inserts message).
- `supabase/functions/summarize-organic-campaign/index.ts` — new edge function: returns budget-stripped summary.
- `supabase/config.toml` — register the two new functions (`verify_jwt = true`).
- `supabase/functions/_shared/transactional-email-templates/manager-strategy-handoff.tsx` — new template.
- `supabase/functions/_shared/transactional-email-templates/manager-new-assignment.tsx` — new template.
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register templates.
- `package.json` — add `jspdf`.

**Alyssa seeding:** Edge function checks for a profile with email `alyssa@synergydental.agency` (configurable constant). If absent, creates auth user via service role + profile + `user_roles.manager`. Idempotent.

**Email infra:** Requires Lovable Emails. If email domain is not yet configured, the agent will trigger the setup dialog before this feature can send mail; messaging + dashboard update still works.

**Out of scope:** Real-time ad spend tracking, Ayrshare boost API (not supported by Ayrshare).
