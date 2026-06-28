import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_MODEL = "fal-ai/minimax/hailuo-02/standard/text-to-video";
const MAX_POLL_MS = 8 * 60 * 1000; // 8 minutes

async function buildCinematicPrompt(opts: {
  openrouterKey: string;
  platform?: string;
  postFocus?: string;
  campaignName?: string;
  practiceName?: string;
  targetAudience?: string;
}): Promise<string> {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write concise, cinematic text-to-video prompts (under 80 words). Describe camera movement, lighting, subject, mood, and setting. No on-screen text, no logos, no medical procedures shown explicitly. Friendly, professional, modern dental/healthcare aesthetic.",
          },
          {
            role: "user",
            content: `Write a single cinematic video prompt for a ${opts.platform || "YouTube"} post.
Topic: ${opts.postFocus || "modern dental practice promo"}
Practice: ${opts.practiceName || "an independent dental practice"}
Campaign: ${opts.campaignName || "general awareness"}
Audience: ${opts.targetAudience || "local adults 25-55"}
Return ONLY the prompt text.`,
          },
        ],
      }),
    });
    if (!r.ok) throw new Error(`prompt builder ${r.status}`);
    const j = await r.json();
    const txt = j.choices?.[0]?.message?.content?.trim();
    if (txt) return txt.replace(/^["']|["']$/g, "").slice(0, 800);
  } catch (e) {
    console.warn("Prompt builder fallback:", e);
  }
  return `Cinematic, warm-lit promo for ${opts.practiceName || "a modern dental practice"}. ${opts.postFocus || "Friendly team, bright welcoming clinic, smiling patients"}. Smooth slow camera push-in, shallow depth of field, natural light, professional, uplifting mood.`;
}

async function falSubmitAndWait(opts: {
  apiKey: string;
  model: string;
  input: Record<string, unknown>;
}): Promise<{ videoUrl: string; rawResult: any }> {
  const submitRes = await fetch(`https://queue.fal.run/${opts.model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${opts.apiKey}`,
    },
    body: JSON.stringify(opts.input),
  });
  if (!submitRes.ok) {
    const txt = await submitRes.text();
    throw new Error(`Fal submit failed (${submitRes.status}): ${txt}`);
  }
  const submitJson = await submitRes.json();
  const requestId: string = submitJson.request_id;
  const statusUrl: string = submitJson.status_url || `https://queue.fal.run/${opts.model}/requests/${requestId}/status`;
  const responseUrl: string = submitJson.response_url || `https://queue.fal.run/${opts.model}/requests/${requestId}`;

  const started = Date.now();
  while (Date.now() - started < MAX_POLL_MS) {
    await new Promise((r) => setTimeout(r, 5000));
    const sRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${opts.apiKey}` },
    });
    if (!sRes.ok) continue;
    const sJson = await sRes.json();
    console.log("Fal status:", sJson.status);
    if (sJson.status === "COMPLETED") {
      const rRes = await fetch(responseUrl, {
        headers: { Authorization: `Key ${opts.apiKey}` },
      });
      if (!rRes.ok) throw new Error(`Fal result fetch failed (${rRes.status})`);
      const rJson = await rRes.json();
      const videoUrl: string | undefined =
        rJson?.video?.url ?? rJson?.video_url ?? rJson?.url ?? rJson?.output?.video?.url;
      if (!videoUrl) throw new Error(`Fal completed but no video URL in result: ${JSON.stringify(rJson).slice(0, 500)}`);
      return { videoUrl, rawResult: rJson };
    }
    if (sJson.status === "FAILED" || sJson.status === "ERROR") {
      throw new Error(`Fal job failed: ${JSON.stringify(sJson).slice(0, 500)}`);
    }
  }
  throw new Error(`Fal job timed out after ${MAX_POLL_MS / 1000}s`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = (claimsData.claims as any).sub as string;
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rateOk } = await sb.rpc("check_and_consume_rate_limit", {
      _user_id: userId,
      _endpoint: "generate-video",
      _max_per_minute: 2,
    });
    if (rateOk === false) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const falKey = Deno.env.get("FAL_AI_API_KEY");
    if (!falKey) {
      return new Response(
        JSON.stringify({ success: false, error: "FAL_AI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY") || "";

    const body = await req.json().catch(() => ({}));
    const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
    const platform = clip(body.platform, 50);
    const postFocus = clip(body.postFocus, 500);
    const campaignName = clip(body.campaignName, 200);
    const practiceName = clip(body.practiceName, 200);
    const targetAudience = clip(body.targetAudience, 500);
    const explicitPrompt = clip(body.prompt, 1500);
    const postId = clip(body.postId, 100);
    const model = clip(body.model, 200) || DEFAULT_MODEL;
    const aspectRatio =
      clip(body.aspectRatio, 10) || (platform?.toLowerCase().includes("shorts") ? "9:16" : "16:9");
    const duration = typeof body.duration === "number" ? Math.min(10, Math.max(5, body.duration)) : 6;

    const videoPrompt =
      explicitPrompt ||
      (await buildCinematicPrompt({
        openrouterKey,
        platform,
        postFocus,
        campaignName,
        practiceName,
        targetAudience,
      }));

    console.log("Fal video prompt:", videoPrompt, "model:", model, "aspect:", aspectRatio);

    // Hailuo-02 expects { prompt, duration, prompt_optimizer }
    // Kling/Luma accept aspect_ratio; we pass all and let Fal ignore unused fields.
    const falInput: Record<string, unknown> = {
      prompt: videoPrompt,
      duration: String(duration),
      aspect_ratio: aspectRatio,
      prompt_optimizer: true,
    };

    const { videoUrl: falVideoUrl } = await falSubmitAndWait({
      apiKey: falKey,
      model,
      input: falInput,
    });

    // Download and re-host on Supabase Storage so URLs are stable
    let publicUrl = falVideoUrl;
    try {
      const dl = await fetch(falVideoUrl);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const blob = await dl.arrayBuffer();
      const path = `videos/${postId || userId}/${Date.now()}.mp4`;
      const { error: upErr } = await sb.storage
        .from("post-media")
        .upload(path, new Uint8Array(blob), {
          contentType: "video/mp4",
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data: pub } = sb.storage.from("post-media").getPublicUrl(path);
      publicUrl = pub.publicUrl;
    } catch (e) {
      console.warn("Re-hosting to storage failed, returning fal URL:", e);
    }

    // If a postId was provided, persist video_url on the post
    if (postId) {
      const { error: updErr } = await sb
        .from("channel_posts")
        .update({ video_url: publicUrl })
        .eq("id", postId);
      if (updErr) console.warn("Failed to update channel_posts.video_url:", updErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: publicUrl,
        prompt: videoPrompt,
        model,
        duration,
        aspectRatio,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-video error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
