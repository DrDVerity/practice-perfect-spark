## Problem

On the campaign page, clicking the **Social Media** tile (when at least one platform like YouTube is already connected) opens the "Social Media Channels" list dialog, which only shows existing channels and a delete button — there is no way to add another platform from there. The top-level "Add Channel" button still works, but users naturally try the tile they just used the first time.

## Fix

Add an **"Add Platform"** action inside the existing channels list dialog so users can add another platform of the same channel type without leaving the dialog.

### Change (single file: `src/pages/CampaignEditNew.tsx`)

In the `showChannelsDialog` Dialog (around line 1408):

1. Add an **"+ Add Platform"** button in the `DialogHeader` (right side, next to the title).
2. On click: close the channels list dialog and open the existing `showAddChannelDialog` with `selectedChannelType` preserved. The Add Channel dialog already filters out already-connected platforms, so it will only show the remaining options (e.g., Facebook, Instagram, LinkedIn, Twitter, TikTok when YouTube is connected).
3. If every platform for that channel type is already added, show a small muted message ("All platforms added") in place of the button.

No backend, schema, or business-logic changes. No other files touched.

## Verification

- On `/campaign/:id`, with YouTube already connected, click the **Social Media** tile → the channels list dialog now shows an **Add Platform** button → clicking it opens the Add Channel picker with Facebook/Instagram/LinkedIn/Twitter/TikTok available.
- Repeat for Email and Text/SMS tiles to confirm the same flow works once they have a platform.
