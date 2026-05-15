# New Campaign Workflow Redesign

## 1. Create New Campaign dialog (rebuild)

Replace the date pickers with a focused, choice-driven flow.

Fields:
- **Campaign Name** (kept)
- **Topic / Focus** (new — free text, e.g. "Teeth Whitening Spring Promo")

Below the inputs, three large action buttons:
- **Reuse a Past Campaign**
- **Campaign Agent (AI design)**
- **I'll Design It Myself**

All three create the campaign first (name + focus saved, status `developing`, no dates), then branch:
- **Reuse** → opens the Past Campaigns picker (modal step 2 inside the same dialog).
- **Campaign Agent** → navigates to `/campaign/:id` and auto-opens the Campaign Agent dialog with the focus pre-filled.
- **I'll Design It Myself** → navigates to `/campaign/:id` (current behavior).

Topic/Focus is persisted to a new `campaigns.focus` column.

## 2. Past Campaigns picker

When "Reuse" is chosen, show a table of the account's past campaigns:

| Name | Last Used | Clicks (to date) | Cost |
|------|-----------|------------------|------|

- "Last Used" = `updated_at`.
- "Clicks" and "Cost" are not currently tracked → show `—` with a tooltip "Coming soon" until analytics are wired. (Flagged so we can hook real numbers later without UI churn.)
- Clicking a row clones that campaign's channels/add-ons/strategy into the new campaign and navigates to its edit page.

## 3. Campaign Agent reconfiguration

Remove the long hard-coded intro greeting (the "Hi! I'm your Campaign Agent…" block with the 5 numbered questions). Replace with a short one-liner:

> "Researching **{focus}** for **{campaignName}**…"

When the dialog opens, behavior depends on whether a focus is set:

**A. No focus provided** → Agent first proposes topics:
1. Pull the client's practice KB (audience, demographics, brand, past campaigns).
2. AI generates **3 suggested topic/focus options** tailored to that practice.
3. Render the 3 options as selectable cards plus a **4th "Enter your own focus…" input**.
4. User picks one (or types their own) → that becomes the campaign's `focus` (saved to the campaigns row) → continue to flow B.

**B. Focus is set** → automatically run **Topic Research → Blog Article**:
1. Search the **client's KB** for documents matching the focus.
2. Search the **agency KB** (admin-owned KB docs + past campaigns whose focus matches) for related material.
3. Use Firecrawl to scan online forums / social media for sentiment and opinions on the topic.
4. Feed everything to the AI and generate a **highly informative, helpful, engaging, humanized blog article** aimed at the client's target audience (pulled from their profile).
5. Stream the article into the chat and present **Approve / Regenerate / Edit Focus** buttons.
6. On Approve: save the article to the client's KB as `doc_type: 'custom'` titled `"Blog: {focus}"` and surface a toast.

The existing Generate Strategy / Generate Campaign / Print buttons remain available below.

## Technical details

**DB migration:**
```sql
ALTER TABLE public.campaigns ADD COLUMN focus text;
```

**Files to change:**
- `src/components/dashboard/CreateCampaignDialog.tsx` — full rewrite (remove dates, add focus + 3 buttons + past-campaigns step).
- `src/pages/Dashboard.tsx` — update `handleCreateCampaign` to accept `{ name, focus, mode }` and route accordingly; pass `?agent=1` when Agent mode chosen.
- `src/pages/CampaignEditNew.tsx` — read `?agent=1` query param and auto-open `CampaignAgentDialog`; pass `campaignFocus` from the loaded campaign.
- `src/components/campaign/CampaignAgentDialog.tsx` — strip the long intro; if no focus, fetch 3 AI-suggested topics (new edge function `suggest-campaign-topics`) and render selectable cards + free-text input; once focus is chosen, persist to `campaigns.focus` then auto-run blog research.
- `supabase/functions/suggest-campaign-topics/index.ts` — new edge function: pull client KB + profile, return 3 topic suggestions as JSON.
- `supabase/functions/topic-blog-research/index.ts` — new edge function: client KB search → agency KB search → Firecrawl forum/social search → AI compose blog article (streamed). Saves to KB on approve via existing `knowledge_base` insert (client side after approval).
- `supabase/config.toml` — register the new function with `verify_jwt = true`.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.

**Out of scope (flagged):** real click/cost analytics — placeholder columns for now.
