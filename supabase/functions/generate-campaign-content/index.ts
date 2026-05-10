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
  internal_email: "Subject line 5-8 words. Body: hook + value + CTA. Skimmable. Mobile-first.",
  sms: "<=160 chars. Personal. Action-oriented. Include opt-out.",
};

interface GeneratedPost {
  title: string;
  text_content: string;
  image_prompt: string;
  needs_video?: boolean;
  scheduled_offset_days: number;
}

function isEmailChannel(platform: string, channelType: string) {
  const p = (platform || "").toLowerCase();
  const t = (channelType || "").toLowerCase();
  return t === "email" || p === "email" || p === "internal_email";
}

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    throw new Error(`AI text generation failed: ${resp.status} ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJson(raw: string): any {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI did not return JSON");
  return JSON.parse(m[0]);
}

async function generateSocialPosts(opts: {
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
  const systemPrompt = `You are an expert healthcare/dental marketing content strategist creating ${opts.platform} (${opts.channelType}) posts.
Platform guidance: ${platformHint}
Use the campaign strategy and KB context. Return ONLY valid JSON:
{ "posts": [ { "title": string, "text_content": string, "image_prompt": string, "needs_video": boolean, "scheduled_offset_days": number } ] }`;

  const userPrompt = `Practice: ${opts.practiceName}
Website: ${opts.websiteUrl || "N/A"}
Campaign: ${opts.campaignName}
Focus: ${opts.campaignFocus || "general practice growth"}
Audience: ${opts.targetAudience || "adults 25-55, local"}
Duration: ${opts.campaignDays} days

Strategy:
${opts.strategyExcerpt || "(use general best practices)"}

KB context:
${opts.kbExcerpt || "(none)"}

${opts.landingPageUrl ? `Landing page (include in CTAs): ${opts.landingPageUrl}` : ""}

Generate ${opts.postCount} unique posts. scheduled_offset_days: integer 0..${Math.max(0, opts.campaignDays - 1)}.
Respond JSON only.`;

  const raw = await callAI(opts.apiKey, systemPrompt, userPrompt);
  const parsed = extractJson(raw);
  return Array.isArray(parsed.posts) ? parsed.posts : [];
}

async function generateEmailFunnel(opts: {
  apiKey: string;
  campaignName: string;
  practiceName: string;
  websiteUrl: string;
  targetAudience: string;
  campaignFocus: string;
  strategyExcerpt: string;
  kbExcerpt: string;
  campaignDays: number;
  landingPageUrl?: string;
}): Promise<GeneratedPost[]> {
  const systemPrompt = `You are an expert lifecycle email copywriter for healthcare/dental practices.
Produce a 5-step email funnel: 1) Welcome 2) Value/Education 3) Social Proof 4) Offer 5) Reminder/Close.
Each email: punchy subject line (5-8 words) for "title", full email body (greeting, hook, value, single CTA, sign-off) for "text_content".
Return ONLY valid JSON:
{ "posts": [ { "title": string, "text_content": string, "image_prompt": "", "needs_video": false, "scheduled_offset_days": number } ] }`;

  const days = opts.campaignDays;
  const offsets = [0, Math.floor(days * 0.2), Math.floor(days * 0.4), Math.floor(days * 0.65), Math.max(0, days - 1)];
  const userPrompt = `Practice: ${opts.practiceName}
Website: ${opts.websiteUrl || "N/A"}
Campaign: ${opts.campaignName}
Focus: ${opts.campaignFocus}
Audience: ${opts.targetAudience}
Duration: ${days} days
Suggested offsets (days from start): ${offsets.join(", ")}

Strategy:
${opts.strategyExcerpt || "(use best practices)"}

KB:
${opts.kbExcerpt || "(none)"}

${opts.landingPageUrl ? `Every CTA must link to: ${opts.landingPageUrl}` : ""}

Generate exactly 5 emails using the suggested offsets. Respond JSON only.`;

  const raw = await callAI(opts.apiKey, systemPrompt, userPrompt);
  const parsed = extractJson(raw);
  const posts: GeneratedPost[] = Array.isArray(parsed.posts) ? parsed.posts : [];
  // Normalize offsets if model didn't follow
  return posts.slice(0, 5).map((p, i) => ({
    ...p,
    image_prompt: "",
    needs_video: false,
    scheduled_offset_days: typeof p.scheduled_offset_days === "number" ? p.scheduled_offset_days : offsets[i] ?? 0,
  }));
}

async function generateImage(apiKey: string, prompt: string, platform: string): Promise<string | null> {
  try {
    const enhanced = `Professional, high-quality marketing image for ${platform}. ${prompt}. Style: clean, modern, no text overlays, photorealistic.`;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: enhanced }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch {
    return null;
  }
}

// Concurrency-limited mapper
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      ret[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return ret;
}

async function runGeneration(supabase: any, campaignId: string, providedStrategy?: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  try {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*, campaign_channels(*)")
      .eq("id", campaignId)
      .single();
    if (!campaign) throw new Error("Campaign not found");

    const channels = campaign.campaign_channels || [];
    if (channels.length === 0) {
      await supabase
        .from("campaigns")
        .update({ generation_status: "completed", generation_error: "No channels — nothing to generate" })
        .eq("id", campaignId);
      return;
    }

    const ownerId = campaign.user_id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("practice_name, website_url, target_audience, campaign_focus, email")
      .eq("user_id", ownerId)
      .single();

    const { data: kbDocs } = await supabase
      .from("knowledge_base")
      .select("title, doc_type, content")
      .eq("user_id", ownerId)
      .in("doc_type", [
        "audience_analysis", "market_analysis", "brand_guidelines", "demographics",
        "competitive_landscape", "system_prompt", "custom",
      ])
      .order("updated_at", { ascending: false })
      .limit(8);

    const kbExcerpt = (kbDocs || [])
      .map((d: any) => `[${d.title} — ${d.doc_type}]\n${(d.content || "").slice(0, 600)}`)
      .join("\n\n").slice(0, 6000);

    const strategyText: string = (providedStrategy && typeof providedStrategy === "string"
      ? providedStrategy
      : campaign.strategy || "").slice(0, 6000);

    const now = new Date();
    const start = campaign.start_date ? new Date(campaign.start_date) : now;
    const end = campaign.end_date ? new Date(campaign.end_date) : new Date(start.getTime() + 14 * 86400000);
    const campaignDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const postCount = Math.min(6, Math.max(2, Math.round(campaignDays / 3)));

    const baseCtx = {
      apiKey: LOVABLE_API_KEY,
      campaignName: campaign.name,
      practiceName: profile?.practice_name || "the practice",
      websiteUrl: profile?.website_url || "",
      targetAudience: profile?.target_audience || "",
      campaignFocus: profile?.campaign_focus || "",
      strategyExcerpt: strategyText,
      kbExcerpt,
      campaignDays,
      landingPageUrl: campaign.landing_page_url || undefined,
    };

    // Step 1: generate text for all channels in parallel and bulk-insert post rows (no images yet)
    type InsertedRow = { id: string; image_prompt: string; platform: string };
    const insertedAll: InsertedRow[] = [];

    const channelResults = await Promise.allSettled(channels.map(async (ch: any) => {
      let posts: GeneratedPost[] = [];
      if (isEmailChannel(ch.platform, ch.channel_type)) {
        posts = await generateEmailFunnel(baseCtx);
      } else {
        posts = await generateSocialPosts({
          ...baseCtx,
          platform: ch.platform,
          channelType: ch.channel_type,
          postCount,
        });
      }

      if (posts.length === 0) return { channel: ch.id, inserted: 0 };

      const rows = posts.map((p) => {
        const offset = Math.max(0, Math.min(campaignDays - 1, Math.round(p.scheduled_offset_days || 0)));
        const scheduledStart = new Date(start.getTime() + offset * 86400000);
        const scheduledEnd = new Date(scheduledStart.getTime() + 30 * 60000);
        return {
          campaign_channel_id: ch.id,
          title: (p.title || campaign.name).slice(0, 200),
          text_content: p.text_content || "",
          image_url: null as string | null,
          video_url: null,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          status: "draft",
        };
      });

      const { data: inserted, error: insErr } = await supabase
        .from("channel_posts").insert(rows).select("id");
      if (insErr) {
        console.error("Insert error", ch.platform, insErr);
        return { channel: ch.id, inserted: 0 };
      }
      (inserted || []).forEach((row: any, i: number) => {
        insertedAll.push({
          id: row.id,
          image_prompt: posts[i]?.image_prompt || "",
          platform: ch.platform,
        });
      });
      return { channel: ch.id, inserted: inserted?.length || 0 };
    }));

    const totalInserted = channelResults.reduce((acc, r) =>
      acc + (r.status === "fulfilled" ? (r.value as any).inserted : 0), 0);

    // Step 2: generate images in parallel (best-effort), update rows as they come back
    const needImages = insertedAll.filter((r) => r.image_prompt);
    await mapLimit(needImages, 4, async (r) => {
      const url = await generateImage(LOVABLE_API_KEY, r.image_prompt, r.platform);
      if (url) {
        await supabase.from("channel_posts").update({ image_url: url }).eq("id", r.id);
      }
    });

    await supabase
      .from("campaigns")
      .update({
        generation_status: "completed",
        generation_error: null,
      })
      .eq("id", campaignId);
    console.log(`Generation done for ${campaignId}: ${totalInserted} posts`);
  } catch (e) {
    console.error("runGeneration failed:", e);
    await supabase
      .from("campaigns")
      .update({
        generation_status: "failed",
        generation_error: e instanceof Error ? e.message : String(e),
      })
      .eq("id", campaignId);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: campaign } = await supabase
      .from("campaigns").select("user_id").eq("id", campaignId).single();
    if (!campaign) throw new Error("Campaign not found");

    let allowed = caller.id === campaign.user_id;
    if (!allowed) {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (roleRow) allowed = true;
    }
    if (!allowed) {
      const { data: mgrRow } = await supabase
        .from("manager_assignments").select("id")
        .eq("manager_user_id", caller.id).eq("client_user_id", campaign.user_id).maybeSingle();
      if (mgrRow) allowed = true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark processing and dispatch background job
    await supabase
      .from("campaigns")
      .update({ generation_status: "processing", generation_error: null })
      .eq("id", campaignId);

    // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
    EdgeRuntime.waitUntil(runGeneration(supabase, campaignId, strategy));

    return new Response(
      JSON.stringify({ jobStarted: true, status: "processing" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-campaign-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
