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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
      .select("title, doc_type, content")
      .eq("user_id", ownerId)
      .in("doc_type", ["brand_guidelines", "audience_analysis", "demographics"])
      .order("updated_at", { ascending: false })
      .limit(4);

    const kbExcerpt = (kbDocs || [])
      .map((d: any) => `[${d.title}]\n${(d.content || "").slice(0, 400)}`)
      .join("\n\n").slice(0, 2000);

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

Return JSON only.`;

    const promptResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: promptSystem },
          { role: "user", content: promptUser },
        ],
        temperature: 0.8,
      }),
    });
    if (!promptResp.ok) throw new Error(`Prompt generation failed: ${promptResp.status}`);
    const promptData = await promptResp.json();
    const raw = promptData.choices?.[0]?.message?.content || "";
    const m = raw.match(/\{[\s\S]*\}/);
    let imagePrompt = title || content || "marketing image";
    if (m) {
      try { imagePrompt = JSON.parse(m[0]).image_prompt || imagePrompt; } catch { /* ignore */ }
    }

    const enhanced = `Professional, high-quality marketing image for ${platform}. ${imagePrompt}. Style: clean, modern, no text overlays, photorealistic.`;
    const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
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
