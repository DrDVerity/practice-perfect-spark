/**
 * bundle-social-publish-post
 *
 * Publishes a single channel_post via Bundle.social.
 *
 * POST body:
 *   { postId: string }       — on-demand
 *   OR { trigger: "cron" }   — cron sweeps all due posts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BUNDLE_BASE = "https://api.bundle.social/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getBundleApiKey = () => {
  const raw = Deno.env.get("BUNDLE_SOCIAL_API_KEY")?.trim();
  if (!raw) return undefined;

  const explicitMatch = raw.match(/(?:BUNDLE_SOCIAL_API_KEY|x-api-key|apiKey)[\s"':=]+([^\s"'`,}]+)/i);
  return (explicitMatch?.[1] || raw)
    .trim()
    .replace(/^["'`“”‘’]|["'`“”‘’]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
    .trim();
};

const PLATFORM_MAP: Record<string, string> = {
  facebook:   "FACEBOOK",
  instagram:  "INSTAGRAM",
  linkedin:   "LINKEDIN",
  twitter:    "TWITTER",
  youtube:    "YOUTUBE",
  tiktok:     "TIKTOK",
};

interface PostRow {
  id: string;
  text_content: string | null;
  image_url: string | null;
  video_url: string | null;
  scheduled_start: string | null;
  status: string;
  bundle_social_post_id: string | null;
  publish_error: string | null;
  campaign_channel_id: string;
}

interface ChannelRow {
  platform: string;
  campaign_id: string;
}

interface ProfileRow {
  user_id: string;
  bundle_social_team_id: string | null;
}

async function publishPost(
  adminClient: ReturnType<typeof createClient>,
  apiKey: string,
  postId: string
): Promise<{ success: boolean; bundleSocialPostId?: string; error?: string }> {

  const { data: post, error: postErr } = await adminClient
    .from("channel_posts")
    .select("id, text_content, image_url, video_url, scheduled_start, status, bundle_social_post_id, publish_error, campaign_channel_id")
    .eq("id", postId)
    .maybeSingle() as { data: PostRow | null; error: any };

  if (postErr || !post) return { success: false, error: "Post not found" };
  if (post.bundle_social_post_id) return { success: true, bundleSocialPostId: post.bundle_social_post_id };

  const { data: channel, error: chanErr } = await adminClient
    .from("campaign_channels")
    .select("platform, campaign_id")
    .eq("id", post.campaign_channel_id)
    .maybeSingle() as { data: ChannelRow | null; error: any };

  if (chanErr || !channel) return { success: false, error: "Channel not found" };

  const bsPlatform = PLATFORM_MAP[channel.platform?.toLowerCase()];
  if (!bsPlatform) {
    return { success: false, error: `Platform "${channel.platform}" is not supported by Bundle.social` };
  }

  const { data: campaign, error: campErr } = await adminClient
    .from("campaigns")
    .select("user_id")
    .eq("id", channel.campaign_id)
    .maybeSingle();

  if (campErr || !campaign) return { success: false, error: "Campaign not found" };

  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("user_id, bundle_social_team_id")
    .eq("user_id", campaign.user_id)
    .maybeSingle() as { data: ProfileRow | null; error: any };

  if (profErr || !profile) return { success: false, error: "Profile not found" };

  if (!profile.bundle_social_team_id) {
    return {
      success: false,
      error: "Client does not have a Bundle.social team yet. Run bundle-social-create-team first.",
    };
  }

  const mediaUrls: string[] = [];
  if (post.image_url) mediaUrls.push(post.image_url);
  if (post.video_url) mediaUrls.push(post.video_url);

  const postBody: Record<string, any> = {
    teamId: profile.bundle_social_team_id,
    socialAccountTypes: [bsPlatform],
    data: {
      [bsPlatform]: {
        text: post.text_content || "",
        ...(mediaUrls.length > 0 && { media: mediaUrls }),
      },
    },
  };

  if (post.scheduled_start) {
    const scheduledDate = new Date(post.scheduled_start);
    if (scheduledDate > new Date()) {
      postBody.scheduledFor = scheduledDate.toISOString();
    }
  }

  const res = await fetch(`${BUNDLE_BASE}/post`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postBody),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const errMsg = data.message || data.error || `Bundle.social HTTP ${res.status}`;
    await adminClient
      .from("channel_posts")
      .update({ publish_error: errMsg })
      .eq("id", postId);
    return { success: false, error: errMsg };
  }

  const bundleSocialPostId: string = data.id || data.postId || "unknown";
  await adminClient
    .from("channel_posts")
    .update({
      bundle_social_post_id: bundleSocialPostId,
      published_at: new Date().toISOString(),
      publish_error: null,
      status: "published",
    })
    .eq("id", postId);

  return { success: true, bundleSocialPostId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = getBundleApiKey();
    if (!apiKey) throw new Error("BUNDLE_SOCIAL_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));

    if (body.trigger === "cron") {
      const { data: duePosts, error: dueErr } = await adminClient
        .from("channel_posts")
        .select("id")
        .eq("status", "scheduled")
        .lte("scheduled_start", new Date().toISOString())
        .is("bundle_social_post_id", null)
        .is("publish_error", null);

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

      console.log("[bundle-social-publish-post cron]", JSON.stringify(summary));

      return new Response(
        JSON.stringify({ processed: duePosts.length, results: summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    console.error("[bundle-social-publish-post]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
