# Campaign Edit Page — Strategy Modal, Section Reorder, Emoji Picker, Custom-Vector Fix

## 1. Full-window Campaign Strategy editor

Replace the inline strategy accordion editor with a full-screen Dialog that opens when the user clicks the **Campaign Strategy** card (anywhere on the row/card body).

- Open: clicking the card opens a near full-window Dialog (~max-w-5xl, ~85vh) titled "Campaign Strategy Report".
- Body: a large editable Textarea (markdown source) — always in edit mode while the dialog is open. Live word/char count.
- Footer (sticky, bottom of the window):
  - **Accept** — saves the edits and runs the existing `acceptPlanAndGenerate()` (auto-builds channels, addons, budget, kicks off asset generation). Closes the dialog.
  - **Edit** — no-op visual cue (the body is already editable); kept as a labelled state indicator. (Will simply focus the textarea.)
  - **Regenerate** — relabel of "Generate new". Calls the campaign-agent dialog to regenerate the strategy from scratch. Closes this dialog and opens the Agent dialog.
  - **Save as Draft** — saves the edited text to `campaigns.strategy` with `status='developing'`, closes the dialog, returns to `/campaign/:id`. Does NOT trigger asset generation.
  - **Delete** — confirm via AlertDialog, then clears `campaigns.strategy` to null, status back to `developing`, closes dialog. Opens the "Topic Suggestions" dialog window (the existing `CampaignAgentDialog` in topic-suggestion mode) so the user can pick a new direction.
- All buttons disabled while their respective mutation is pending; show spinners.

## 2. Reorder + rename campaign accordion sections

New order (top → bottom) on `/campaign/:id`:
1. **Focus** (existing) — with a new field added beneath Target Market:
   - **Budget Target** (dollar amount input). Stored on `profiles.budget_target` and shown alongside Campaign Focus / Target Market.
2. **Strategic Plan** (renamed from "Campaign Strategy"; clicking the row opens the full-window editor from §1 instead of inline edit).
3. **Budget** (renamed from "Campaign Budget"). The accordion row shows the saved Total Budget badge. Clicking it expands a read-only summary table with: Total Budget, every allocation line (channels + add-ons with % and $), and Remaining. An **Edit Budget** button (and clicking any row) opens the existing `CampaignBudgetDialog`, where Total Budget and every allocation amount/percent are editable and saved on Accept.
4. **Landing Page** (existing).
5. **Channels** (renamed from "Channels & Platforms Included").
6. **Vectors** (renamed from "Campaign Vectors").

The "Posting Schedule" accordion is removed from this page; the schedule remains reachable via the existing `/schedule` page and the Gantt preview that appears under the Strategic Plan section once dates are set.

## 3. Emoji picker in the Custom Vector dialog

In `AddCustomAddonDialog.tsx`, replace the plain `<Input>` for Icon with a button showing the current emoji that opens a Popover containing a searchable emoji grid. Use `emoji-picker-react` (lightweight, already-popular library) so we don't hand-roll one.
- Clicking the emoji field opens the popover.
- Selecting an emoji sets it and closes the popover.

## 4. Fix "Could not find the 'custom_icon' column" error

The `campaign_addons` table is missing `custom_label` and `custom_icon` columns (the code in `useCampaignAddons.ts` already assumes they exist). Run a migration to add both columns (nullable text), so custom vectors persist across refreshes and the "Add to Campaign Add-Ons" button stops erroring.

## Technical Details

- **Strategy modal**: new state `showStrategyDialog`; reuse existing `editStrategy`, `updateCampaign`, `acceptPlanAndGenerate`. Card click handler in the Strategic Plan accordion sets state. Delete uses `AlertDialog`, then sets `showAgentDialog=true` (topic-suggestion mode).
- **Budget Target field**: new nullable column `profiles.budget_target numeric`. Saved alongside `campaign_focus`/`target_audience` in the existing `saveFocus()` mutation. Display under Target Market in the Focus accordion.
- **Budget accordion**: renders a read-only table built from `useCampaignBudget` allocations (Total / per-line % + $ / Remaining). Both the table rows and the explicit "Edit Budget" button open `CampaignBudgetDialog`, which already supports editable Total + per-row % / $ inputs and saves via `upsertBudget`.
- **Reorder**: simply reorder `<AccordionItem>` blocks in `CampaignEditNew.tsx`. Remove the Posting Schedule accordion (data and `/schedule` page are unaffected).
- **Emoji picker**: `bun add emoji-picker-react`. Wrap in a `<Popover>` with `<PopoverTrigger>` showing the current emoji + chevron.
- **Migration**:
  ```sql
  ALTER TABLE public.campaign_addons
    ADD COLUMN IF NOT EXISTS custom_label text,
    ADD COLUMN IF NOT EXISTS custom_icon  text;
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS budget_target numeric;
  ```

## Open Question

You asked to reorder rows to only: Focus, Strategic Plan, Landing Page, Channels, Vectors. The page currently also has **Posting Schedule** and **Campaign Budget** accordions. The plan above removes both from the accordion list (budget moves into the Focus → Budget Target field; the schedule remains visible via the existing `/schedule` page and Gantt preview inside the Strategic Plan section). Confirm or tell me to keep one/both.
