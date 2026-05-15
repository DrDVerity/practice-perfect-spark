/**
 * ayrshare-publish-post
 *
 * Publishes a single channel_post via Ayrshare using the agency multi-profile pattern.
 * Can be called:
 *   1. On-demand from the frontend (immediate publish or schedule)
 *   2. By ayrshare-cron-publish for automated scheduled delivery
 *
 * POST body:
 *   { postId: string }                          ← channel_posts.id
 *   OR { trigger: "cron" }                      ← cron sweeps all due posts itself
 *
 * Required env vars:
 *   AYRSHARE_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const AYRSHARE_BASE = "https://app.ayrshare.com/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Ayrshare platform name mapping from Archer's PlatformType
const PLATFORM_MAP: Record<string, string> = {
  facebook:   "facebook",
  instagram:  "instagram",
  linkedin:   "linkedin",
  twitter:    "twitter",
  youtube:    "youtube",
  tiktok:     "tiktok",
};

interface PostRow {
  id: string;
  text_content: string | null;
  image_url: string | null;
  video_url: string | null;
  scheduled_start: string | null;
  status: string;
  ayrshare_post_id: string | null;
  publish_error: string | null;
  campaign_channel_id: string;
}

interface ChannelRow {
  platform: string;
  campaign_id: string;
}

interface ProfileRow {
  user_id: string;
  ayrshare_profile_id: string | null;
}

// ── Core publish logic for one post ──────────────────────────────────────────
async function publishPost(
  adminClient: ReturnType<typeof createClient>,
  apiKey: string,
  postId: string
): Promise<{ success: boolean; ayrsharePostId?: string; error?: string }> {

  // 1. Fetch the post
  const { data: post, error: postErr } = await adminClient
    .from("channel_posts")
    .select("id, text_content, image_url, video_url, scheduled_start, status, ayrshare_post_id, publish_error, campaign_channel_id")
    .eq("id", postId)
    .maybeSingle() as { data: PostRow | null; error: any };

  if (postErr || !post) return { success: false, error: "Post not found" };

  // Skip if already published or has a permanent error
  if (post.ayrshare_post_id) return { success: true, ayrsharePostId: post.ayrshare_post_id };

  // 2. Fetch the channel to get platform
  const { data: channel, error: chanErr } = await adminClient
    .from("campaign_channels")
    .select("platform, campaign_id")
    .eq("id", post.campaign_channel_id)
    .maybeSingle() as { data: ChannelRow | null; error: any };

  if (chanErr || !channel) return { success: false, error: "Channel not found" };

  const ayrPlatform = PLATFORM_MAP[channel.platform?.toLowerCase()];
  if (!ayrPlatform) {
    return { success: false, error: `Platform "${channel.platform}" is not supported by Ayrshare` };
  }

  // 3. Fetch the campaign to get user_id, then the profile for ayrshare_profile_id
  const { data: campaign, error: campErr } = await adminClient
    .from("campaigns")
    .select("user_id")
    .eq("id", channel.campaign_id)
    .maybeSingle();

  if (campErr || !campaign) return { success: false, error: "Campaign not found" };

  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("user_id, ayrshare_profile_id")
    .eq("user_id", campaign.user_id)
    .maybeSingle() as { data: ProfileRow | null; error: any };

  if (profErr || !profile) return { success: false, error: "Profile not found" };

  if (!profile.ayrshare_profile_id) {
    return {
      success: false,
      error: "Client does not have an Ayrshare profile yet. Run ayrshare-create-profile first.",
    };
  }

  // 4. Build Ayrshare request body
  const postBody: Record<string, any> = {
    post: post.text_content || "",
    platforms: [ayrPlatform],
  };

  // Attach media if present
  const mediaUrls: string[] = [];
  if (post.image_url) mediaUrls.push(post.image_url);
  if (post.video_url) mediaUrls.push(post.video_url);
  if (mediaUrls.length > 0) postBody.mediaUrls = mediaUrls;

  // Schedule for future if scheduled_start is in the future
  if (post.scheduled_start) {
    const scheduledDate = new Date(post.scheduled_start);
    if (scheduledDate > new Date()) {
      // Ayrshare expects ISO 8601 UTC
      postBody.scheduleDate = scheduledDate.toISOString();
    }
  }

  // 5. Call Ayrshare POST /post with the client's Profile-Key header
  const ayrRes = await fetch(`${AYRSHARE_BASE}/post`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Profile-Key": profile.ayrshare_profile_id,   // ← multi-profile magic
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postBody),
  });

  const ayrData = await ayrRes.json();

  if (!ayrRes.ok || ayrData.status === "error") {
    const errMsg = ayrData.message || ayrData.error || `Ayrshare HTTP ${ayrRes.status}`;
    // Save error to DB so admin can see it in the UI
    await adminClient
      .from("channel_posts")
      .update({ publish_error: errMsg })
      .eq("id", postId);
    return { success: false, error: errMsg };
  }

  // 6. Save success state
  const ayrsharePostId: string = ayrData.id || ayrData.postIds?.[0] || "unknown";
  await adminClient
    .from("channel_posts")
    .update({
      ayrshare_post_id: ayrsharePostId,
      published_at: new Date().toISOString(),
      publish_error: null,
      status: "published",
    })
    .eq("id", postId);

  return { success: true, ayrsharePostId };
}

// ── Entry point ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("AYRSHARE_API_KEY");
    if (!apiKey) throw new Error("AYRSHARE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));

    // ── Cron sweep mode ───────────────────────────────────────────────────────
    if (body.trigger === "cron") {
      // Find all posts that are due and not yet published
      const { data: duePosts, error: dueErr } = await adminClient
        .from("channel_posts")
        .select("id")
        .eq("status", "scheduled")
        .lte("scheduled_start", new Date().toISOString())
        .is("ayrshare_post_id", null)
        .is("publish_error", null);   // Don't retry failed posts automatically

      if (dueErr) throw dueErr;
      if (!duePosts || duePosts.length === 0) {
        return new Response(
          JSON.stringify({ processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = await Promise.allSettled(
        duePosts.map((p: { id: string }) => publishPost(adminClient, apiKey, p.id))
      );

      const summary = results.map((r, i) => ({
        postId: duePosts[i].id,
        ...(r.status === "fulfilled" ? r.value : { success: false, error: String(r.reason) }),
      }));

      console.log("[ayrshare-publish-post cron]", JSON.stringify(summary));

      return new Response(
        JSON.stringify({ processed: duePosts.length, results: summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Single-post on-demand mode ────────────────────────────────────────────
    // Require auth for on-demand calls from the frontend
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { postId } = body;
    if (!postId) throw new Error("postId is required");

    const result = await publishPost(adminClient, apiKey, postId);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[ayrshare-publish-post]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
