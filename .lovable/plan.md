# Fix "Connect Facebook" blocked-page issue

## Root cause
1. `bundle-social-get-connect-link` sends `forceBrowserOAuth: true` for **Instagram only**. Facebook then gets a raw `facebook.com/dialog/oauth` URL back, which refuses to render inside the Lovable preview iframe (`X-Frame-Options: DENY` → `ERR_BLOCKED_BY_RESPONSE`).
2. `ChannelCredentialModal.handleConnectViaBundleSocial` calls `window.open(url, '_blank', 'noopener,noreferrer')`. Inside the Lovable preview iframe, popup blockers and sandbox flags frequently swallow that call, so the URL loads into the iframe itself — where Facebook's frame-deny header trips.

## Changes

### 1. Edge function — `supabase/functions/bundle-social-get-connect-link/index.ts`
- Set `forceBrowserOAuth: true` for **all** direct-platform connects (Facebook, Instagram, LinkedIn, Twitter, YouTube, TikTok), not just Instagram. This makes Bundle.social host the intermediate broker page, which is safe to load in any context and handles the provider handoff itself.
- Redeploy the function.

### 2. Frontend — `src/components/channel/ChannelCredentialModal.tsx`
Make the connect action iframe-safe:
- Detect preview-iframe context (`window.top !== window.self`).
- Attempt `window.open(url, '_blank', 'noopener,noreferrer')` first.
- If the returned window handle is `null` (popup blocked / iframe-sandboxed), **do not** fall back to navigating the iframe. Instead:
  - Show the URL in a read-only input with a "Copy link" button and an "Open in new tab" anchor (`<a target="_blank" rel="noopener noreferrer">`), which the user can click as a real user-gesture navigation from top-level chrome.
  - Keep the existing "Connection page opened" success state for the happy path.
- Add a short helper note: "If nothing opens, use the link below in a new browser tab."

### 3. No DB or schema changes.

## Verification
- Reproduce in the Lovable preview: click Connected Platforms → Facebook → Connect. Expect the Bundle.social broker page to load (not the Facebook blocked page).
- Verify Instagram/Twitter still work end-to-end (broker → provider → return to `/dashboard`).
- Confirm the copy-link fallback appears when popups are blocked.

## Out of scope
- No changes to the Bundle.social team provisioning, disconnect-and-retry logic, or credential storage.
- No change to the manual (non-social) credential form.
