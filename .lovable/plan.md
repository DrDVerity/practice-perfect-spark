## Goal

Replace the category tile grid at the top of `/knowledge-base` with a "Suggested Reports" checklist, and fix the "Open file" link so PDFs render in the browser instead of forcing a download.

## 1. Suggested Reports section (replaces category tiles)

Location: `src/pages/KnowledgeBase.tsx`, the `Category Tiles` grid (lines ~714-734).

Suggested report types (the AI-generatable doc types only — excludes `custom` and `system_prompt`):
- `platform_rules`
- `audience_analysis`
- `market_analysis`
- `competitive_landscape`
- `demographics`
- `brand_guidelines`

Eligibility rule: only show a suggestion if the user has **no document of that `doc_type` that is less than 30 days old** (i.e. `updated_at` within 30 days). If a fresh one exists, hide it from the list. Stale (>30 days) or missing → show it.

UI layout (card under the page header, before search/filter):
```
Suggested Reports
[☐] Generate all selected
─────────────────────────────────
[☐] Platform Rules           Not in KB
[☐] Audience Analysis        Last generated 45 days ago — refresh recommended
[☐] Market Analysis          Not in KB
...
                                       [Generate Selected (n)]
```

- Left-column checkbox per row, aligned under a master "select all" checkbox at the top (indeterminate when partial).
- Row shows report label + small muted status ("Not in KB" or "Last generated X days ago").
- Demographics row, when selected, still needs the questionnaire — clicking Generate Selected will open the existing demographics questionnaire dialog inline (or generate using saved profile answers if previously filled; for now: if demographics is among the selected, open the existing `showGenerateDialog` flow for demographics first, then continue with the rest).
- "Generate Selected" button calls the existing `generateDocument(type, defaultPrompt)` loop sequentially with a progress toast. Reuses `DOC_TYPE_PROMPTS` defaults.
- After generation, the list re-evaluates and freshly-generated items disappear from suggestions.
- If the suggestions list is empty, show a small muted message: "All suggested reports are up to date."

Removed:
- The `allDocTypes` tile grid and `handleTileClick` filter-by-tile behaviour. Filtering still available via the existing search; we drop the click-to-filter affordance because the tiles are gone. (Keep `getDocsByType` — still used elsewhere.)

Kept:
- "Add Document" button (manual + uploads).
- "Generate Analysis Reports" button (bulk firecrawl-driven flow) — unchanged.
- Documents list table below.

## 2. Fix "Open file" link

Current behaviour (lines ~870-898): clicking Open file fetches the file as a blob and calls `window.open(blobUrl, '_blank')`. For PDFs, Chrome/Edge/Brave will sometimes treat `blob:` URLs without a filename hint as a download instead of opening the built-in viewer.

Fix:
- For PDFs (detect via `mime_type === 'application/pdf'` or `.pdf` extension), create the blob with `new Blob([buffer], { type: 'application/pdf' })` so the type is preserved, then open the blob URL in a new tab.
- Better: open the **signed URL directly** in a new tab using `window.open(fileUrl, '_blank', 'noopener,noreferrer')`. The earlier blob approach was added to bypass Brave Shields; that workaround forced the download behaviour. Instead:
  1. First try `window.open(fileUrl, '_blank')` — modern browsers render the PDF inline using their built-in viewer.
  2. If the window fails to open (popup blocked) OR for known-blocked environments, fall back to the blob approach with explicit `application/pdf` MIME type.
- Keep the `<button>` element (don't revert to `<a download>`).

## Technical notes

- No DB / edge function / migration changes.
- Only `src/pages/KnowledgeBase.tsx` is touched.
- `Checkbox` component from `@/components/ui/checkbox` is already in shadcn — use it for the suggestions list.
- 30-day check: `(Date.now() - new Date(doc.updated_at).getTime()) < 30 * 86400000`. Pick the most-recent doc of each `doc_type` to evaluate.
