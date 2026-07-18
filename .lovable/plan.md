## Diagnosis

The report viewer is calling `generate-report-pdf`, and that function still queries `public.prospect_documents`. The live database has `prospect_reports` instead, which is why every prospect report fails with:

```text
Could not find the table 'public.prospect_documents' in the schema cache
```

I also confirmed the `/get-started` report generation pipeline writes reports into `prospect_reports`, not `prospect_documents`.

## Plan

1. **Fix the report PDF Edge Function**
   - Update `supabase/functions/generate-report-pdf/index.ts` to read from `prospect_reports`.
   - Keep the same request body and response shape so existing UI buttons continue to work.
   - Preserve the branded print-ready PDF formatting.

2. **Remove direct backend host coupling in the frontend report opener**
   - Refactor `CampaignPreview.tsx` to call `supabase.functions.invoke('generate-report-pdf')` instead of manually building a backend URL.
   - Convert the returned PDF response to a local `Blob` URL.
   - This keeps the report flow aligned with the rest of the app and avoids hardcoded project host fallback logic.

3. **Use the existing in-app PDF renderer for preview reports**
   - Replace the iframe-based PDF display in `CampaignPreview.tsx` with the existing `PdfCanvasViewer` component already used for Weekly Marketing Reports.
   - Keep download support via the generated Blob.
   - This avoids browser PDF plugin/ad-blocker failures across report types.

4. **Verify**
   - Confirm `generate-report-pdf` now loads an existing prospect report from `prospect_reports`.
   - Verify the `/get-started` report modal opens without the missing-table error and renders through the canvas PDF viewer.