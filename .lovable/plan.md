## Diagnosis

The current click path calls Bundle.social's direct `/social-account/connect` endpoint when a specific platform icon is selected. That endpoint returns raw provider OAuth URLs, e.g. `https://www.facebook.com/...`, which Facebook refuses to load inside the app preview iframe. The last live request confirmed the backend returned a raw Facebook OAuth URL despite `forceBrowserOAuth`.

Bundle.social's current docs say the correct flow for apps like this is the hosted portal flow: `POST /api/v1/social-account/create-portal-link`, which returns a `https://bundle.social/connect?...` URL and lets Bundle.social handle OAuth, page/channel selection, and return flow. The Bundle.social MCP server is local stdio only; no hosted remote MCP is available yet, so this app should use the same API-key-backed hosted portal endpoint from the backend function.

## Plan

1. **Backend link generation**
   - Update `supabase/functions/bundle-social-get-connect-link/index.ts` so platform icon clicks use `create-portal-link`, not direct `social-account/connect`.
   - When a platform is requested, send `socialAccountTypes: [PLATFORM]` so the hosted Bundle.social page opens directly scoped to Facebook/Instagram/LinkedIn/X/YouTube/TikTok.
   - Include hosted-flow fields recommended by Bundle.social: `disableAutoLogin: true`, `withBusinessScope: true` for Facebook/Instagram-capable flows, `showModalOnConnectSuccess: true`, `language: "en"`, and a reasonable expiry.
   - Keep the existing “all platforms” portal behavior for generic Add Channel.
   - Remove or bypass the old direct-connect disconnect/retry branch for this connection flow because it is tied to the direct OAuth endpoint that produces blocked provider URLs.

2. **Frontend opening behavior**
   - Update `src/components/channel/ChannelCredentialModal.tsx` so the returned link is always exposed immediately as a real clickable `Open Bundle.social` link and copyable URL.
   - Keep trying `window.open`, but never navigate the iframe to provider URLs.
   - Adjust button/messaging so users understand they are opening Bundle.social’s hosted connection page, not Facebook/Instagram directly.

3. **Connected-platform cards**
   - Keep `ConnectedPlatformsDialog.tsx` behavior where platform icons open the connection modal for that platform.
   - Ensure existing connected platform cards can still reconnect/add another account through the same hosted Bundle.social portal.

4. **Verification**
   - Confirm a Facebook platform click returns a `bundle.social` hosted URL, not `facebook.com`.
   - Confirm Instagram/X still return hosted Bundle.social portal links.
   - Confirm popup-blocked users can still use the visible link/copy fallback.