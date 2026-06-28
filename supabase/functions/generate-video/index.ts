import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_MODEL = "fal-ai/minimax/hailuo-02/standard/text-to-video";
const MAX_POLL_MS = 8 * 60 * 1000; // 8 minutes
const TARGET_DURATION = 10; // Hailuo-02 standard max; we narrate ~30s worth of script over the clip

async function buildScriptAndPrompt(opts: {
  openrouterKey: string;
  platform?: string;
  postFocus?: string;
  campaignName?: string;
  practiceName?: string;
  targetAudience?: string;
  landingUrl?: string;
  userDirection?: string;
  previousScript?: string;
}): Promise<{ voiceoverScript: string; videoPrompt: string }> {
  const ctaLine = "Click the link below to learn more and book your visit.";
  const fallback = {
    voiceoverScript:
      `Looking for a dental experience that actually feels good? ${opts.practiceName || "Our practice"} blends modern technology with a warm, judgement-free team — so every visit is gentle, efficient, and built around you. From routine cleanings to smile makeovers, we treat patients like neighbours, not numbers. New patients are welcome this month. ${ctaLine}`,
    videoPrompt: `Cinematic, warm-lit 30-second promo for ${opts.practiceName || "a modern independent dental practice"}. ${opts.postFocus || "Friendly team greeting smiling patients, bright welcoming clinic, gentle hands, modern equipment"}. Smooth slow camera push-ins and gentle dolly moves, shallow depth of field, natural daylight, professional uplifting mood. End on a calm hero shot of the smiling team. No on-screen text, no logos.`,
  };
  if (!opts.openrouterKey) return fallback;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write short marketing video assets for independent dental practices. Return STRICT JSON with two keys: `voiceover_script` and `video_prompt`. The voiceover_script must read naturally aloud in roughly 30 seconds (70-85 words), be warm and conversational, and END with a clear call-to-action telling the viewer to click the link below. The video_prompt is a single cinematic text-to-video prompt under 90 words describing camera movement, lighting, subject, mood, and setting; no on-screen text, no logos, no explicit medical procedures.",
          },
          {
            role: "user",
            content: `Platform: ${opts.platform || "YouTube"}
Practice: ${opts.practiceName || "an independent dental practice"}
Campaign: ${opts.campaignName || "general awareness"}
Audience: ${opts.targetAudience || "local adults 25-55"}
Post focus: ${opts.postFocus || "modern dental practice promo"}
Required CTA wording (must appear at the end of the voiceover, verbatim or near-verbatim): "${ctaLine}"
Return ONLY JSON: {"voiceover_script": "...", "video_prompt": "..."}`,
          },
        ],
      }),
    });
    if (!r.ok) throw new Error(`script builder ${r.status}`);
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(raw);
    const voiceoverScript = String(parsed.voiceover_script || "").trim();
    const videoPrompt = String(parsed.video_prompt || "").trim();
    if (!voiceoverScript || !videoPrompt) throw new Error("missing fields");
    // Ensure CTA is present
    const finalScript = /click the link below/i.test(voiceoverScript)
      ? voiceoverScript
      : `${voiceoverScript} ${ctaLine}`;
    return { voiceoverScript: finalScript, videoPrompt };
  } catch (e) {
    console.warn("Script builder fallback:", e);
    return fallback;
  }
}

async function falSubmitAndWait(opts: {
  apiKey: string;
  model: string;
  input: Record<string, unknown>;
}): Promise<{ videoUrl: string }> {
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
    if (submitRes.status === 403 && /exhausted balance|user is locked/i.test(txt)) {
      const err: any = new Error("Fal.ai account balance exhausted. Please top up at https://fal.ai/dashboard/billing to generate videos.");
      err.code = "FAL_BILLING";
      throw err;
    }
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
      if (!videoUrl) throw new Error(`Fal completed but no video URL: ${JSON.stringify(rJson).slice(0, 500)}`);
      return { videoUrl };
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
    const landingUrl = clip(body.landingUrl, 500);
    const explicitPrompt = clip(body.prompt, 1500);
    const postId = clip(body.postId, 100);
    const model = clip(body.model, 200) || DEFAULT_MODEL;
    const aspectRatio =
      clip(body.aspectRatio, 10) || (platform?.toLowerCase().includes("shorts") ? "9:16" : "16:9");

    const { voiceoverScript, videoPrompt: builtPrompt } = await buildScriptAndPrompt({
      openrouterKey,
      platform,
      postFocus,
      campaignName,
      practiceName,
      targetAudience,
      landingUrl,
    });
    const videoPrompt = explicitPrompt || builtPrompt;

    console.log("Fal video prompt:", videoPrompt, "model:", model, "aspect:", aspectRatio);

    // Persist script + mark processing immediately so the UI sees state right away
    if (postId) {
      const { error: upErr } = await sb
        .from("channel_posts")
        .update({ voiceover_script: voiceoverScript, video_status: "processing" })
        .eq("id", postId);
      if (upErr) console.warn("Failed to update post pre-generation:", upErr);
    }

    // Run Fal generation in the background so the client doesn't hit the 150s gateway idle timeout.
    const runJob = async () => {
      try {
        const falInput: Record<string, unknown> = {
          prompt: videoPrompt,
          duration: String(TARGET_DURATION),
          aspect_ratio: aspectRatio,
          prompt_optimizer: true,
        };
        const { videoUrl: falVideoUrl } = await falSubmitAndWait({
          apiKey: falKey,
          model,
          input: falInput,
        });

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
          console.warn("Re-hosting to storage failed, using fal URL:", e);
        }

        if (postId) {
          const { error: updErr } = await sb
            .from("channel_posts")
            .update({ video_url: publicUrl, video_status: "ready" })
            .eq("id", postId);
          if (updErr) console.warn("Failed to set channel_posts.video_url:", updErr);
        }
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Background video job failed:", msg);
        if (postId) {
          await sb
            .from("channel_posts")
            .update({ video_status: e?.code === "FAL_BILLING" ? "billing" : "failed" })
            .eq("id", postId);
        }
      }
    };
    // @ts-ignore EdgeRuntime is provided by Supabase
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runJob());
    } else {
      runJob().catch((e) => console.error("runJob detached error:", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "processing",
        voiceoverScript,
        prompt: videoPrompt,
        model,
        duration: TARGET_DURATION,
        aspectRatio,
        message: "Video generation started. The video will appear on the post when ready (1–5 minutes).",
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const code = error?.code;
    const isExpectedBillingFailure = code === "FAL_BILLING";
    if (isExpectedBillingFailure) {
      console.warn("generate-video billing unavailable:", msg);
    } else {
      console.error("generate-video error:", msg);
    }
    const status = isExpectedBillingFailure ? 200 : 500;
    return new Response(
      JSON.stringify({ success: false, error: msg, code }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
