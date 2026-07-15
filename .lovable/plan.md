## Changes to Channel/Post workflow, email generation, and blog panel

### 1. Per-post Accept indicator + "Accept All" button (`src/pages/ChannelEdit.tsx`)

- **DB**: add `accepted BOOLEAN NOT NULL DEFAULT false` to `channel_posts` (single migration; existing rows default to false).
- **`useCampaignsNew.ts`**: expose `accepted` on `ChannelPost` and add `togglePostAccepted({ id, channelId, accepted })` + `acceptAllPosts(channelId)` mutations.
- **ChannelEdit action row (per post)**: insert a check-circle button between the Publish (Send) icon and the Schedule (Calendar) icon.
  - `CheckCircle2` colored `text-green-600` when `post.accepted`, `text-red-500` when not.
  - Click toggles accepted; tooltip "Accepted" / "Not accepted".
- **Header**: add an "Accept All" button (Check icon) immediately to the left of the existing "Regenerate Posts" button. Calls `acceptAllPosts(channelId)`; disabled while pending; toast on success.

### 2. Email channel: carousel-first, image-per-post, distribution list selector

Applies when `channel.platform === 'internal_email'` on the ChannelEdit page and in `generate-campaign-content` for email channels.

- **Generator (`supabase/functions/generate-campaign-content/index.ts`)**: when channel is email and 3 broadcast posts are produced:
  - Post 1 = **carousel**: reuse the campaign blog article + any existing social carousel slides for this campaign as source. Follow the existing carousel prompt/guide already used for social carousels (same slide schema, 5–7 slides, saved as `format: 'carousel'` with slides JSON).
  - Posts 2 & 3 = standard email with an AI-generated image tailored to each post's title/hook (call `generate-post-image` with a per-post prompt, same as social image posts).
- **Distribution list selector (UI only on email channel view)**:
  - New `email_distribution_lists` table: `id, campaign_id, user_id (owner), name, source ('pms'|'import'|'manual'), row_count, storage_path, created_at`. RLS: owner-scoped + admin. GRANTs to `authenticated` + `service_role`.
  - Above the posts list on `ChannelEdit` (email only): a Select styled like other selects with:
    - **Existing lists** – lists already stored for this practice (label shows name + row count). Selecting one sets `channel.distribution_list_id` (new nullable column on `campaign_channels`).
    - **Import list** – opens a file dialog accepting `.csv, .xlsx, .xls, .gsheet` links; uploads to a new `distribution-lists` storage bucket, inserts a row with `source='import'`.
    - **New from PMS** – opens a small dialog where the user pastes / describes the SQL query for the PMS; creates a placeholder row with `source='pms'` and `row_count=0` and shows "Awaiting PMS response — drop the returned CSV here" (drop zone that later fills the same row).
  - No real PMS integration is wired yet — this feature stores the request and accepts the returned CSV upload.

### 3. Blog hero image regenerate control (`src/components/campaign/BlogArticlePanel.tsx` + parent)

- Add a "Regenerate image" button next to the existing "Regenerate blog" button in the panel header.
- Behavior mirrors post-image regeneration: opens a small popover/prompt like `ImageWithRegenerate` allowing the user to (a) type a change instruction and regenerate, or (b) regenerate fresh with no instruction.
- Wires to `generate-post-image` (or existing hero image endpoint used by `generate-content-hub`) with `{ campaignId, target: 'blog_hero', instruction }`; on success updates `campaigns.blog_hero_url` and refetches.

### Technical notes

- Migration adds: `channel_posts.accepted`, `campaign_channels.distribution_list_id`, `public.email_distribution_lists` table + RLS + GRANTs, storage bucket `distribution-lists` (private).
- Cascade: accepting all posts does not change the channel/campaign accept flags; those remain manual at their tiers.
- No changes to publishing, preflight, or Bundle.social integration.

### Files touched

- `supabase/migrations/<new>.sql`
- `src/hooks/useCampaignsNew.ts`
- `src/pages/ChannelEdit.tsx`
- `src/components/channel/EmailDistributionListSelect.tsx` (new)
- `src/components/campaign/BlogArticlePanel.tsx` + caller in `CampaignEditNew.tsx`
- `supabase/functions/generate-campaign-content/index.ts`
