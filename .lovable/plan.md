## Goal
Generate real video files (MP4) for YouTube channel posts using Fal.ai, instead of returning a script with a null `video_url`.

## Approach

### 1. Update `generate-video` edge function
- Replace the current script-only stub with a real Fal.ai call.
- Default model: **`fal-ai/kling-video/v2/master/text-to-video`** (good quality/cost balance, 5–10s clips). Configurable via request param.
- Flow:
  1. Generate a short cinematic video prompt from the post topic/caption (via OpenRouter, same pattern as other functions).
  2. Submit job to Fal.ai using the queue API (`fal.queue.submit` → poll `fal.queue.status` → `fal.queue.result`) since video gen takes 1–5 minutes.
  3. Download the resulting MP4 from Fal's CDN.
  4. Upload to the existing `post-media` storage bucket under `videos/{post_id}.mp4`.
  5. Return the public URL.
- Auth header: `Authorization: Key ${FAL_AI_API_KEY}`.

### 2. Update post generation flow
- In `generate-campaign-content` (and the post-creation path), for YouTube posts: call `generate-video` and store the returned URL in `channel_posts.video_url`.
- Apply the same "don't regenerate if already exists" guard already used for images.

### 3. UI updates
- In `EditPostDialog` (and the post preview/card for YouTube): if `video_url` is present, render an HTML5 `<video controls>` element instead of (or alongside) the image.
- Add a "Generate Video" / "Regenerate Video" button for YouTube posts that calls `generate-video` with `force: true`.
- Show a loading state — video gen takes 1–5 min, so we'll need a polling/progress indicator.

### 4. Async handling
Because Fal video jobs are long-running, the edge function will use Fal's queue API and poll until complete (with a max wait, e.g. 8 min). If it exceeds, return a `request_id` the client can poll later.

## Open questions before I build

1. **Which Fal model?** Options:
   - **Kling v2 Master** — high quality, ~$1.40 per 5s clip
   - **Luma Dream Machine** — cinematic, ~$0.50 per 5s
   - **MiniMax Hailuo-02** — cheaper, ~$0.30 per 6s
   - **Veo 3** — top quality + native audio, ~$3+ per clip
2. **Clip length** — 5s, 10s, or configurable per post?
3. **Aspect ratio** — YouTube Shorts (9:16) or standard landscape (16:9)? Or detect from post type?
4. **Keep the image too?** YouTube posts currently get a thumbnail image — keep generating it as the video poster/thumbnail, or skip it once a video exists?

Once you confirm those, I'll implement.
