import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { postId, title, content, platform, campaignName, practiceName } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let ownerId = caller.id;
    let strategy = "";
    if (postId) {
      const { data: post } = await supabase
        .from("channel_posts")
        .select("campaign_channel_id, campaign_channels!inner(campaigns!inner(user_id, strategy, name))")
        .eq("id", postId)
        .maybeSingle();
      const camp = (post as any)?.campaign_channels?.campaigns;
      if (camp) {
        ownerId = camp.user_id;
        strategy = (camp.strategy || "").slice(0, 2000);
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("practice_name, campaign_focus, target_audience, brand_voice")
      .eq("user_id", ownerId)
      .maybeSingle();

    const { data: kbDocs } = await supabase
      .from("knowledge_base")
      .select("title, doc_type, content, metadata")
      .eq("user_id", ownerId)
      .in("doc_type", ["brand_guidelines", "audience_analysis", "demographics", "custom"])
      .order("updated_at", { ascending: false })
      .limit(20);

    const kbExcerpt = (kbDocs || [])
      .filter((d: any) => (d.metadata as any)?.file_kind !== 'image')
      .map((d: any) => `[${d.title}]\n${(d.content || "").slice(0, 400)}`)
      .join("\n\n").slice(0, 2000);

    // Collect KB image references (logos, brand assets, past campaign visuals) so the image
    // generator stays consistent with materials the practice has already approved.
    const kbImageDocs = (kbDocs || [])
      .filter((d: any) => (d.metadata as any)?.file_kind === 'image' && (d.metadata as any)?.storage_path)
      .slice(0, 8);
    const kbImageSignedUrls = await Promise.all(
      kbImageDocs.map(async (d: any) => {
        const { data } = await supabase.storage
          .from("kb-files")
          .createSignedUrl((d.metadata as any).storage_path, 60 * 60);
        return data?.signedUrl ? `- ${d.title}: ${data.signedUrl}` : null;
      })
    );
    const kbImageRefs = kbImageSignedUrls.filter(Boolean).join("\n");

    // Pull a few recent campaign assets (images previously generated/approved) for stylistic continuity
    const { data: pastPosts } = await supabase
      .from("channel_posts")
      .select("title, image_url, campaign_channels!inner(campaigns!inner(user_id))")
      .eq("campaign_channels.campaigns.user_id", ownerId)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(6);
    const pastAssetRefs = (pastPosts || [])
      .map((p: any) => {
        const url = typeof p.image_url === 'string' ? p.image_url : '';
        // Skip data URIs / base64 (would blow up token limits)
        if (!url || url.startsWith('data:')) return null;
        return `- ${p.title || 'post'}: ${url.slice(0, 300)}`;
      })
      .filter(Boolean)
      .join("\n");

    const promptSystem = `You are an expert visual creative director for healthcare/dental marketing. Generate ONE highly descriptive image prompt (2-3 sentences) that visually captures and draws in the reader's attention for a specific social media post. No text overlays. Photorealistic, on-brand. Output JSON only: {"image_prompt": "..."}`;

    const promptUser = `Platform: ${platform}
Practice: ${practiceName || profile?.practice_name || ""}
Campaign: ${campaignName || ""}
Campaign focus: ${profile?.campaign_focus || ""}
Target audience: ${profile?.target_audience || ""}
Brand voice: ${profile?.brand_voice || ""}

Post title: ${title || ""}
Post content: ${content || ""}

Strategy excerpt:
${strategy}

Brand/Audience KB:
${kbExcerpt}

KB visual references (existing brand images, logos, reference photos already approved by practice):
${kbImageRefs || "(none)"}

Past campaign assets (use for stylistic continuity, color palette, mood):
${pastAssetRefs || "(none)"}

Use the KB and past assets to keep the visual style consistent with what this practice has already produced. Match color palette, mood, and tone.

Return JSON only.`;

    const promptResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: promptSystem },
          { role: "user", content: promptUser },
        ],
        temperature: 0.8,
      }),
    });
    if (!promptResp.ok) {
      const errText = await promptResp.text().catch(() => "");
      console.error("OpenRouter prompt-gen error", promptResp.status, errText.slice(0, 500));
      throw new Error(`Prompt generation failed: ${promptResp.status} ${errText.slice(0, 200)}`);
    }
    const promptData = await promptResp.json();
    const raw = promptData.choices?.[0]?.message?.content || "";
    const m = raw.match(/\{[\s\S]*\}/);
    let imagePrompt = title || content || "marketing image";
    if (m) {
      try { imagePrompt = JSON.parse(m[0]).image_prompt || imagePrompt; } catch { /* ignore */ }
    }

    const enhanced = `Professional, high-quality marketing image for ${platform}. ${imagePrompt}. Style: clean, modern, no text overlays, photorealistic.`;
    const imgResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: enhanced }],
        modalities: ["image", "text"],
      }),
    });
    if (!imgResp.ok) throw new Error(`Image generation failed: ${imgResp.status}`);
    const imgData = await imgResp.json();
    const imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("No image returned");

    return new Response(
      JSON.stringify({ imageUrl, imagePrompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-post-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
