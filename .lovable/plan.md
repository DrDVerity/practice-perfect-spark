## Goal

When a visitor clicks "View report" on a prospect analysis card (`/get-started` → CampaignPreview), open a professional, print-ready branded PDF of that report instead of the current plain-text modal.

## Approach

Model on the existing `generate-strategy-pdf` edge function (pdf-lib, same style, no new deps).

### 1. New edge function: `generate-report-pdf`

- Public (no auth) — prospect visitors aren't signed in.
- Input: `{ prospectId, docType }` (or `{ content, title, practiceName }` fallback).
- Uses the service role to read `prospect_documents` (title/content/metadata) and the parent `prospect_accounts` (practice name, website).
- Renders a branded PDF with pdf-lib:
  - **Letterhead** on every page: Archer / Practice Perfect wordmark, dark-blue band, gold accent rule, practice name + report title on right.
  - Cover block: Report title, practice name, website, generated date.
  - Body: markdown-aware rendering — `#`/`##`/`###` sized headings, `-`/`*` bullets, `**bold**` inline, blank-line paragraph spacing, monospaced code fences skipped.
  - Footer on every page: "Prepared by Archer — Practice Perfect Marketing Agent" left, "Page N of M" right, generated date center.
  - US Letter, 1" margins, Helvetica family (pdf-lib built-ins), navy `#001f5b` headings, gold `#d4af37` rules, black body.
- Returns the PDF bytes directly (`Content-Type: application/pdf`, `Content-Disposition: inline; filename="…"`) so it can be opened in a new tab or embedded.
- Rate-limited via existing `check_and_consume_rate_limit` RPC keyed on IP + prospectId.

### 2. Update `CampaignPreview.tsx`

- Replace the current text modal with a PDF preview modal:
  - "View report" now calls the edge function via `supabase.functions.invoke('generate-report-pdf', { body: {...} })` with `responseType: 'blob'` (or fetch directly to get bytes), converts to an object URL, and shows it in a full-height `<iframe>` inside the existing Dialog.
  - Dialog gets **Open in new tab** and **Download PDF** buttons in the header.
  - Loading spinner while the PDF is generating; toast on error.
- Cache generated blob URLs per report in component state so re-opening is instant.

### 3. Nice-to-have polish

- Same edge function reused later for other reports (SWOT, competitor, etc.) — keyed by `docType`, so no per-report code.
- No DB changes, no new tables, no new secrets.

## Technical details

- Files added: `supabase/functions/generate-report-pdf/index.ts`
- Files changed: `src/components/campaign/CampaignPreview.tsx`
- Libraries: `pdf-lib@1.17.1` (already used by `generate-strategy-pdf`), no client-side PDF deps.
- Markdown rendering is a lightweight in-function tokenizer (headings, bullets, bold, paragraphs) — no external markdown lib needed for pdf-lib output.
- PDF returned inline as bytes; no storage bucket write required (reports are ephemeral to the visitor).
