## Problem

The landing page link for campaign `fed454f6…` opens to a page that displays raw HTML source code instead of a rendered website.

## Root Cause

Supabase Storage **intentionally serves HTML files in public buckets as `Content-Type: text/plain` with a `Content-Security-Policy: default-src 'none'; sandbox` header**. This is a security default to prevent XSS attacks via uploaded HTML — and it cannot be overridden by setting the file's mimetype to `text/html` on upload.

I verified this directly:

```text
GET /storage/v1/object/public/landing-pages/<id>/index.html
  Content-Type: text/plain   ← browser shows source
  Content-Security-Policy: default-src 'none'; sandbox
  X-Content-Type-Options: nosniff
```

The previous fix uploaded the HTML to public storage and redirected to it — but storage strips the HTML rendering, so the browser correctly shows the source as plain text.

The campaign record currently has:
`landing_page_url = https://…/storage/v1/object/public/landing-pages/<id>/index.html`

## Fix

Stop relying on public storage for HTML. Instead, serve the HTML directly from the `serve-landing-page` edge function with a real `Content-Type: text/html` response. Edge function responses are NOT sandboxed — only the public Storage CDN is.

### Steps

1. **Rewrite `supabase/functions/serve-landing-page/index.ts`**
   - On GET, read `landing_page_html` from the campaign row.
   - Return it directly as the response body with:
     - `Content-Type: text/html; charset=utf-8`
     - `Cache-Control: public, max-age=60`
     - No redirect, no storage upload.
   - Keep the existing 404 fallback for missing campaigns/HTML.

2. **Update `generate-landing-page` edge function**
   - Stop uploading to the `landing-pages` storage bucket.
   - Set `landing_page_url` to the serve-landing-page function URL:
     `https://<project>.supabase.co/functions/v1/serve-landing-page?id=<campaignId>`
   - Continue saving `landing_page_html` to the campaigns table (source of truth).

3. **Repair the existing campaign record**
   - Run a one-line UPDATE so `fed454f6-6176-4819-9465-32a0147ca0b7` (and any other rows still pointing at the storage URL) gets the function URL. The HTML body is already in `landing_page_html`, so no regeneration is needed.

4. **Verify**
   - Curl the function URL and confirm `Content-Type: text/html` with no sandbox CSP.
   - Click the link in the campaign page and confirm the page renders.

### Technical notes

- `serve-landing-page` already deploys with `verify_jwt = false` (it must be publicly reachable), so no config change is required.
- The `landing-pages` storage bucket can stay; it just won't be used for HTML anymore. We can leave existing files in place; they'll be ignored.
- This also makes the link self-healing: regenerating the HTML updates `landing_page_html` and the same function URL keeps working.

### Files to change

- `supabase/functions/serve-landing-page/index.ts` (rewrite to inline HTML response)
- `supabase/functions/generate-landing-page/index.ts` (set `landing_page_url` to function URL, drop storage upload)
- One SQL UPDATE to repair existing campaign rows
