## 1. Budget + Duration on "Create New Campaign"

### Dialog UI (`src/components/dashboard/CreateCampaignDialog.tsx`)
Add two required fields under "Topic / Focus", before the three mode buttons:

- **Total Budget** — number input with a `$` prefix (USD only for now). Required, must be > 0.
- **Campaign Duration** — number input + unit selector (Days / Weeks / Months). Required, must be > 0.

Disable all three mode buttons (Reuse / Agent / Self) until `name`, `budget > 0`, and `duration > 0` are all valid. Add inline validation with red helper text.

Extend `CreateCampaignSubmit` to include `budgetAmount: number`, `durationValue: number`, `durationUnit: 'days' | 'weeks' | 'months'`.

### Persistence (`src/pages/Dashboard.tsx` → `handleCreateCampaign`)
After the `campaigns` row is created (both self and view-as-client branches), insert a `campaign_budgets` row:

```ts
await supabase.from('campaign_budgets').insert({
  campaign_id: createdId,
  total_amount: data.budgetAmount,
  allocations: {},
  accepted: false,
});
```

Also persist duration on the campaign itself. The `campaigns` table doesn't have duration columns today, so add them via migration:

- `duration_value integer`
- `duration_unit text` (check constraint: 'days' | 'weeks' | 'months')
- `start_date date` (defaults to today on insert) — useful so the Calendar view has an anchor

Then include `duration_value`, `duration_unit`, `start_date: today` in the `campaigns` insert payload.

If the budget insert fails, surface a toast but keep the campaign (budget can be re-saved from the Budget step).

### Downstream
`useCampaignBudget` already reads/writes `campaign_budgets` — no change needed. The existing Budget step inside the campaign will show the pre-seeded total and accept further allocation edits.

## 2. Media tab inside Knowledge Base

The Knowledge Base already uses the private `kb-files` bucket and a `knowledge_base` table with a `doc_type` column. We'll piggyback on that — no new bucket, no new table.

### Changes to `src/pages/KnowledgeBase.tsx`
- Add a new top-level tab **"Media"** alongside the existing Documents/Suggested Reports tabs.
- Introduce a new `KBDocumentType` value `'media'` (image/video/other binary assets) in `src/hooks/useKnowledgeBase.ts` and the type-label/color maps.
- The Media tab renders a responsive gallery grid:
  - Image thumbnails (signed URL) with name + size on hover.
  - Video tiles with a play overlay; click opens a lightbox using the existing `KBDocumentViewer`.
  - Other files fall back to a file-icon tile with a download action.
- Upload zone at the top of the Media tab — same drag-and-drop pattern already used for KB uploads, but tags new entries with `doc_type = 'media'`.
- Filter chips: All / Images / Videos / Other (based on MIME type stored in `knowledge_base.metadata` or inferred from file extension).
- Delete + rename use the existing KB mutations.

### Campaign-side access (out of scope of this pass, noted only)
Future work: a "Pick from Media Library" button inside `EditPostDialog` to pull images/videos directly from this tab. Not built now — confirm with user before adding.

## Technical Notes

- Migration runs first; client code updates follow after types regenerate.
- No new RLS policies needed — `campaign_budgets` policies already cover insert by campaign owners, and `knowledge_base` already supports the `'media'` doc type once added to the TS enum (the column is plain text).
- Currency hard-coded to USD for now; structure leaves room for a currency column later.
- Validation uses zod on the dialog submit handler (budget > 0, duration > 0, integers only).

## Files touched

- `supabase/migrations/<new>.sql` — add `duration_value`, `duration_unit`, `start_date` to `campaigns`.
- `src/components/dashboard/CreateCampaignDialog.tsx` — new fields + validation + extended submit payload.
- `src/pages/Dashboard.tsx` — pass new fields into insert, seed `campaign_budgets`.
- `src/hooks/useKnowledgeBase.ts` — add `'media'` doc type + label/color.
- `src/pages/KnowledgeBase.tsx` — new Media tab, gallery grid, filter chips, upload zone.
