import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_HINTS: Record<string, string> = {
  facebook: "Conversational, community-driven. 3-6 short sentences. Single CTA. Warm, local feel.",
  instagram: "Visual-first. Caption: hook + benefit. 5-10 hashtags. CTA: link in bio or DM.",
  linkedin: "Professional, outcome-focused. 3-6 bullet insights. CTA: 'Learn more' or 'Refer a patient'.",
  twitter: "Hook in 1-2 lines. One value statement + link. Concise.",
  youtube: "Educational. Hook + value preview + CTA to learn more.",
  tiktok: "Hook in 0-3s. Casual, simple. Brief CTA. Trending feel.",
  email: "Subject line 5-8 words. Body: hook + value + CTA. Skimmable. Mobile-first.",
  sms: "<=160 chars. Personal. Action-oriented. Include opt-out.",
};

interface GeneratedPost {
  title: string;
  text_content: string;
  image_prompt: string;
  needs_video?: boolean;
  scheduled_offset_days: number;
}

async function generatePostsForChannel(opts: {
  apiKey: string;
  platform: string;
  channelType: string;
  campaignName: string;
  practiceName: string;
  websiteUrl: string;
  targetAudience: string;
  campaignFocus: string;
  strategyExcerpt: string;
  kbExcerpt: string;
  postCount: number;
  campaignDays: number;
  landingPageUrl?: string;
}): Promise<GeneratedPost[]> {
  const platformHint = PLATFORM_HINTS[opts.platform.toLowerCase()] ?? PLATFORM_HINTS.facebook;
  const systemPrompt = `You are an expert healthcare/dental marketing content strategist.
Create on-brand ${opts.platform} (${opts.channelType}) posts.
Platform guidance: ${platformHint}

Use the campaign strategy and knowledge base context to ensure every post supports the plan, audience, and offers.

Return ONLY valid JSON (no commentary, no markdown fences) matching this exact schema:
{ "posts": [ { "title": string, "text_content": string, "image_prompt": string, "needs_video": boolean, "scheduled_offset_days": number } ] }`;

  const userPrompt = `Practice: ${opts.practiceName}
Website: ${opts.websiteUrl || "N/A"}
Campaign: ${opts.campaignName}
Campaign focus: ${opts.campaignFocus || "general practice growth"}
Target audience: ${opts.targetAudience || "adults 25-55, local"}
Campaign duration: ${opts.campaignDays} days

Strategy excerpt:
${opts.strategyExcerpt || "(use general best practices for this channel)"}

Knowledge base context:
${opts.kbExcerpt || "(none provided)"}

${opts.landingPageUrl ? `Landing page URL (include in EVERY post's CTA): ${opts.landingPageUrl}` : "(no landing page URL — use a generic CTA)"}

Generate ${opts.postCount} unique posts spread across the campaign. For each post:
- title: 5-10 word ATTENTION-GRABBING headline (specific, benefit-driven, curiosity or urgency)
- text_content: ready-to-publish post body with hook, value, and a clear CTA${opts.landingPageUrl ? ` ending with the landing page link ${opts.landingPageUrl}` : ""}
- image_prompt: 1-2 sentences describing the visual to generate (no text overlay)
- needs_video: true ONLY if the post benefits from a short video; otherwise false
- scheduled_offset_days: integer 0..${Math.max(0, opts.campaignDays - 1)} representing days from campaign start

Respond with the JSON object only.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("Text gen failed", resp.status, t);
    throw new Error(`AI text generation failed: ${resp.status}`);
  }
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return JSON");
  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed.posts) ? parsed.posts : [];
}

async function generateImage(apiKey: string, prompt: string, platform: string): Promise<string | null> {
  try {
    const enhanced = `Professional, high-quality marketing image for ${platform}. ${prompt}. Style: clean, modern, no text overlays, photorealistic.`;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: enhanced }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) {
      console.warn("Image gen failed:", resp.status);
      return null;
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch (e) {
    console.warn("Image gen error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId, strategy } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load campaign + channels
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("*, campaign_channels(*)")
      .eq("id", campaignId)
      .single();
    if (campErr || !campaign) throw new Error("Campaign not found");

    // Authorization: caller must own, be admin, or assigned manager
    const ownerId: string = campaign.user_id;
    let allowed = caller.id === ownerId;
    if (!allowed) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleRow) allowed = true;
    }
    if (!allowed) {
      const { data: mgrRow } = await supabase
        .from("manager_assignments")
        .select("id")
        .eq("manager_user_id", caller.id)
        .eq("client_user_id", ownerId)
        .maybeSingle();
      if (mgrRow) allowed = true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channels = campaign.campaign_channels || [];
    if (channels.length === 0) {
      return new Response(JSON.stringify({ error: "Campaign has no channels" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Owner profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("practice_name, website_url, target_audience, campaign_focus, email")
      .eq("user_id", ownerId)
      .single();

    // KB context (owner)
    const { data: kbDocs } = await supabase
      .from("knowledge_base")
      .select("title, doc_type, content")
      .eq("user_id", ownerId)
      .in("doc_type", [
        "audience_analysis",
        "market_analysis",
        "brand_guidelines",
        "demographics",
        "competitive_landscape",
        "system_prompt",
        "custom",
      ])
      .order("updated_at", { ascending: false })
      .limit(8);

    const kbExcerpt = (kbDocs || [])
      .map((d: any) => `[${d.title} — ${d.doc_type}]\n${(d.content || "").slice(0, 600)}`)
      .join("\n\n")
      .slice(0, 6000);

    const strategyText: string = (strategy && typeof strategy === "string" ? strategy : campaign.strategy || "").slice(0, 6000);

    // Determine campaign window
    const now = new Date();
    const start = campaign.start_date ? new Date(campaign.start_date) : now;
    const end = campaign.end_date ? new Date(campaign.end_date) : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    const campaignDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const postCount = Math.min(6, Math.max(2, Math.round(campaignDays / 3)));

    let totalCreated = 0;

    for (const ch of channels) {
      try {
        const posts = await generatePostsForChannel({
          apiKey: LOVABLE_API_KEY,
          platform: ch.platform,
          channelType: ch.channel_type,
          campaignName: campaign.name,
          practiceName: profile?.practice_name || "the practice",
          websiteUrl: profile?.website_url || "",
          targetAudience: profile?.target_audience || "",
          campaignFocus: profile?.campaign_focus || "",
          strategyExcerpt: strategyText,
          kbExcerpt,
          postCount,
          campaignDays,
        });

        for (const p of posts) {
          // Generate image (best-effort)
          let imageUrl: string | null = null;
          if (p.image_prompt) {
            imageUrl = await generateImage(LOVABLE_API_KEY, p.image_prompt, ch.platform);
          }

          const offset = Math.max(0, Math.min(campaignDays - 1, Math.round(p.scheduled_offset_days || 0)));
          const scheduledStart = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000);
          // Default 30-min publish window
          const scheduledEnd = new Date(scheduledStart.getTime() + 30 * 60 * 1000);

          const { error: insErr } = await supabase.from("channel_posts").insert({
            campaign_channel_id: ch.id,
            title: p.title?.slice(0, 200) || campaign.name,
            text_content: p.text_content || "",
            image_url: imageUrl,
            video_url: null, // video gen is async/expensive — flagged in metadata for follow-up
            scheduled_start: scheduledStart.toISOString(),
            scheduled_end: scheduledEnd.toISOString(),
            status: "draft",
          });
          if (insErr) {
            console.error("Insert post error:", insErr);
            continue;
          }
          totalCreated++;
        }
      } catch (chErr) {
        console.error(`Channel ${ch.platform} failed:`, chErr);
      }
    }

    return new Response(
      JSON.stringify({ postsCreated: totalCreated, channelsProcessed: channels.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-campaign-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
