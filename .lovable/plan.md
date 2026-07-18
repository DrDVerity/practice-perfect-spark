## Plan

1. **Make report previews scrollable**
   - Update the report modal layout so the PDF canvas area has a constrained height and `min-h-0`/overflow behavior that lets the user scroll through every page.
   - Apply the same safe scroll container pattern to the reusable PDF canvas viewer so it works wherever reports are rendered.

2. **Fix "Open in new tab" so it does not rely on the browser PDF plugin**
   - Replace the blob/PDF-plugin new-tab link with an app route that renders the report through the same in-app `PdfCanvasViewer` canvas renderer.
   - Pass report identity through URL parameters, refetch the PDF from the backend function in the new tab, and render it inside the app UI instead of opening a raw PDF/blob URL.
   - Keep "Download PDF" as a blob download action for users who want the file.

3. **Enforce photographic blog imagery for the `/get-started` preview flow**
   - Replace the remaining "illustration" language in `get-started-generate` with "photographic image/photo" language for the blog article and hero.
   - Change `[ILLUSTRATION: ...]` placeholders and generated image prompts so they request real editorial photography only for the blog body and hero.
   - Add strong negative prompt language for blog/hero: no illustration, cartoon, drawing, painting, 3D render, CGI, vector art, clipart, or artistic render.
   - **Carousels are exempt** — allow the AI to pick the most appropriate visual style (photo OR illustration) per slide, whichever makes the carousel most compelling and draws the reader in. Update carousel image prompts to focus on visual impact and narrative pull rather than restricting the medium.

4. **Keep existing content-hub photographic safeguards**
   - Tighten the existing `generate-content-hub` prompts only where needed so charts/graphs remain charts, and blog scene/people/environment visuals stay photographic. Leave carousel logic free to use illustration where it makes the post stronger.

5. **Default the app to dark theme**
   - Keep dark as the default theme while preserving the user's explicit light-mode choice after they click the theme button.
   - Add a small theme initialization safeguard if needed so a first-time visitor lands in dark mode instead of briefly or persistently seeing light mode.

## Technical notes

- Main frontend files: `CampaignPreview.tsx`, `PdfCanvasViewer.tsx`, `App.tsx`, and a small new report-view route/component if needed.
- Main backend prompt file: `supabase/functions/get-started-generate/index.ts`.
- No database schema changes are needed.