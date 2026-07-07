/**
 * generate-content-hub
 *
 * NEW WORKFLOW — Step 1 of 2 (replaces direct post generation):
 *
 *   Step 1 (this function):
 *     a. Optionally suggest 5 resonant topics for the target audience, or accept a user-provided topic
 *     b. Write a full, well-researched blog article (~800-1200 words) on the chosen topic
 *     c. Derive a complete YouTube video script from the article
 *     d. Save both onto campaigns.blog_article + campaigns.youtube_script
 *
 *   Step 2 (generate-campaign-content — modified):
 *     Reads blog_article + youtube_script and derives platform-adapted posts for each channel
 *     instead of generating from scratch.
 *
 * POST body:
 *   {
 *     campaignId: string,
 *     topic?: string,           ← if provided, used directly (topic_source = 'user_provided')
 *     pickSuggestion?: boolean  ← if true, return 5 suggestions instead of generating content
 *   }
 *
 * When pickSuggestion=true, returns: { suggestions: string[] }
 * Otherwise returns: { jobStarted: true, status: 'processing' }
 *
 * Required env vars:
 *   OPENROUTER_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function callAI(
  apiKey: string,
  system: string,
  user: string,
  temperature = 0.7
): Promise<string> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI call failed ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── Topic suggestion ──────────────────────────────────────────────────────────

async function suggestTopics(opts: {
  apiKey: string;
  practiceName: string;
  campaignFocus: string;
  targetAudience: string;
  kbExcerpt: string;
}): Promise<string[]> {
  const system = `You are a healthcare content strategist. Return ONLY a JSON array of 5 strings — topic titles.
No explanation, no markdown, no wrapper object. Example: ["Topic A","Topic B","Topic C","Topic D","Topic E"]`;

  const user = `Practice: ${opts.practiceName}
Campaign focus: ${opts.campaignFocus || "general practice growth"}
Target audience: ${opts.targetAudience || "local patients, adults 25-55"}
KB context: ${opts.kbExcerpt || "(none)"}

Suggest 5 blog/video topics that would resonate strongly with the target audience and support the campaign focus.
Topics should be educational, trust-building, and searchable. Avoid generic titles — make each specific and compelling.`;

  const raw = await callAI(opts.apiKey, system, user, 0.9);
  // Robust parse — strip any surrounding markdown fences
  const cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.slice(0, 5).map(String);
  } catch {
    // fallback: extract quoted strings
    const matches = cleaned.match(/"([^"]+)"/g);
    if (matches) return matches.slice(0, 5).map((s) => s.replace(/"/g, ""));
  }
  throw new Error("Could not parse topic suggestions from AI response");
}

// ── Blog article ──────────────────────────────────────────────────────────────

async function generateBlogTitle(opts: {
  apiKey: string; topic: string; practiceName: string; targetAudience: string;
}): Promise<string> {
  const system = `You write eye-popping, click-worthy blog headlines for a dental practice's target audience.
Return ONLY the title text — no quotes, no markdown, no explanation. 8-14 words. Concrete, benefit-driven, curiosity-inducing.`;
  const user = `Topic: ${opts.topic}\nPractice: ${opts.practiceName}\nAudience: ${opts.targetAudience}`;
  const raw = await callAI(opts.apiKey, system, user, 0.9);
  return raw.replace(/^["'`]|["'`]$/g, "").split("\n")[0].trim().slice(0, 180);
}

async function generateBlogArticle(opts: {
  apiKey: string;
  topic: string;
  practiceName: string;
  campaignFocus: string;
  targetAudience: string;
  websiteUrl: string;
  kbExcerpt: string;
  strategyExcerpt: string;
  psychologicalApproach: string;
  targetMarketRefined: string;
  landingPageUrl?: string;
}): Promise<string> {
  const system = `You are a healthcare content writer producing SEO-optimised, HIPAA-compliant blog articles for dental/wellness practices, written from the voice of the dentist and practice.

Rules:
- 1000–1500 words
- Use markdown headings (##, ###)
- The FIRST paragraph must be a compelling hook that engages the reader emotionally (question, story, or striking statistic) — no throat-clearing intros
- Focus on features, statistics, data, authoritative quotes, and illustrations (charts, graphs, infographics, and/or images). Where a chart/graph/infographic would add value, insert a markdown placeholder line like: \`![Infographic: <description>](chart:<slug>)\` — do NOT invent real image URLs
- Cite general statistics with attribution when possible (e.g. "According to the ADA…")
- Include at least one blockquote (>) with an authoritative-sounding quote appropriate to the topic
- Weave in local context naturally (city/neighbourhood references where provided)
- End with ONE clear CTA linking to the practice or landing page
- No patient testimonials or identifiable case studies
- Professional but warm — the dentist speaking to their community, not a textbook`;

  const user = `Topic: ${opts.topic}
Practice: ${opts.practiceName}
Website: ${opts.websiteUrl || "N/A"}
Campaign focus: ${opts.campaignFocus}
Target audience: ${opts.targetAudience}
${opts.landingPageUrl ? `Landing page for CTA: ${opts.landingPageUrl}` : ""}

Persona + psychographics (refined):
${opts.targetMarketRefined || "(none)"}

Psychological approach for this campaign — reflect it subtly in the framing:
${opts.psychologicalApproach || "(none)"}

Campaign strategy context:
${opts.strategyExcerpt || "(none)"}

Knowledge base context:
${opts.kbExcerpt || "(none)"}

Write the full blog article now. Use markdown. Start directly with the article body — no preamble, no title (a title is written separately).`;

  return callAI(opts.apiKey, system, user, 0.75);
}

async function generateHeroImage(opts: {
  apiKey: string; topic: string; blogTitle: string; practiceName: string;
}): Promise<string | null> {
  try {
    const prompt = `Photorealistic, editorial hero image for a dental practice blog article titled "${opts.blogTitle}".
Topic: ${opts.topic}. Practice: ${opts.practiceName}.
Bright, warm, modern clinical setting or lifestyle scene evoking confidence and wellbeing.
No on-screen text, no logos, no watermarks. Wide 16:9 composition, shallow depth of field.`;
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch { return null; }
}

// ── YouTube script ────────────────────────────────────────────────────────────

async function generateYouTubeScript(opts: {
  apiKey: string;
  topic: string;
  blogArticle: string;
  practiceName: string;
  targetAudience: string;
  landingPageUrl?: string;
}): Promise<string> {
  const system = `You are a YouTube scriptwriter for healthcare/dental practices.
Produce a complete, spoken-word video script derived from the blog article provided.

Format:
[HOOK] (0-10s) — pattern-interrupt opening question or surprising stat
[INTRO] (10-30s) — who this video is for, what they'll learn
[SECTION 1] / [SECTION 2] / [SECTION 3] — main educational content, conversational
[SOCIAL PROOF] — general outcome statements (no specific patient stories)
[CTA] (final 20s) — what to do next, where to go

Rules:
- Written as spoken dialogue, not prose — short sentences, natural pauses
- 4–7 minutes when read aloud (≈ 600–900 words of script)
- Include [B-ROLL SUGGESTION] notes in brackets for each section
- Include one on-screen text/graphic suggestion per section`;

  const user = `Topic: ${opts.topic}
Practice: ${opts.practiceName}
Audience: ${opts.targetAudience}
${opts.landingPageUrl ? `CTA URL: ${opts.landingPageUrl}` : ""}

Source blog article:
${opts.blogArticle.slice(0, 4000)}

Write the complete YouTube video script now. Start with [HOOK].`;

  return callAI(opts.apiKey, system, user, 0.8);
}

// ── Background job ────────────────────────────────────────────────────────────

async function runContentHub(
  supabaseAdmin: ReturnType<typeof createClient>,
  apiKey: string,
  campaignId: string,
  topic: string,
  topicSource: "user_provided" | "ai_suggested"
) {
  try {
    // Fetch campaign + profile + KB
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("*, campaign_channels(*)")
      .eq("id", campaignId)
      .single();
    if (!campaign) throw new Error("Campaign not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("practice_name, website_url, target_audience, campaign_focus")
      .eq("user_id", campaign.user_id)
      .single();

    const { data: kbDocs } = await supabaseAdmin
      .from("knowledge_base")
      .select("title, doc_type, content")
      .eq("user_id", campaign.user_id)
      .in("doc_type", [
        "audience_analysis", "market_analysis", "brand_guidelines",
        "competitive_landscape", "system_prompt", "custom",
      ])
      .order("updated_at", { ascending: false })
      .limit(6);

    const kbExcerpt = (kbDocs || [])
      .map((d: any) => `[${d.title}]\n${(d.content || "").slice(0, 500)}`)
      .join("\n\n")
      .slice(0, 4000);

    const strategyExcerpt = (campaign.strategy || "").slice(0, 3000);
    const landingPageUrl = campaign.landing_page_url || undefined;

    const sharedOpts = {
      apiKey,
      practiceName: profile?.practice_name || "the practice",
      campaignFocus: profile?.campaign_focus || campaign.name,
      targetAudience: profile?.target_audience || "local patients, adults 25-55",
      websiteUrl: profile?.website_url || "",
      kbExcerpt,
      strategyExcerpt,
      psychologicalApproach: (campaign as any).psychological_approach || "",
      targetMarketRefined: (campaign as any).target_market_refined || "",
      landingPageUrl,
    };

    // Step A: eye-popping title
    console.log(`[content-hub] Generating blog title for: "${topic}"`);
    const blogTitle = await generateBlogTitle({
      apiKey, topic,
      practiceName: sharedOpts.practiceName,
      targetAudience: sharedOpts.targetAudience,
    });

    // Step B: blog article
    console.log(`[content-hub] Generating blog article`);
    const blogArticle = await generateBlogArticle({ ...sharedOpts, topic });

    // Step C: hero image (best-effort — do not block on failure)
    console.log(`[content-hub] Generating hero image`);
    const heroImageUrl = await generateHeroImage({
      apiKey, topic, blogTitle, practiceName: sharedOpts.practiceName,
    });

    // Step D: YouTube script derived from article
    console.log(`[content-hub] Generating YouTube script`);
    const youtubeScript = await generateYouTubeScript({
      apiKey,
      topic,
      blogArticle,
      practiceName: sharedOpts.practiceName,
      targetAudience: sharedOpts.targetAudience,
      landingPageUrl,
    });

    // Save everything onto campaign
    await supabaseAdmin
      .from("campaigns")
      .update({
        blog_title: blogTitle,
        blog_article: blogArticle,
        hero_image_url: heroImageUrl,
        youtube_script: youtubeScript,
        content_topic: topic,
        topic_source: topicSource,
        generation_status: "content_ready",  // signals Step 2 can now run
        generation_error: null,
      })
      .eq("id", campaignId);

    console.log(`[content-hub] Done for campaign ${campaignId}`);
  } catch (err: any) {
    console.error("[content-hub] Error:", err.message);
    await supabaseAdmin
      .from("campaigns")
      .update({
        generation_status: "failed",
        generation_error: err.message,
      })
      .eq("id", campaignId);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const body = await req.json();
    const { campaignId, topic, pickSuggestion } = body;
    if (!campaignId) throw new Error("campaignId is required");

    // Verify access
    const { data: campaign } = await adminClient
      .from("campaigns")
      .select("user_id, name, strategy, landing_page_url")
      .eq("id", campaignId)
      .single();
    if (!campaign) throw new Error("Campaign not found");

    const isOwner = caller.id === campaign.user_id;
    const { data: adminRole } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    const { data: mgrRow } = await adminClient
      .from("manager_assignments").select("id")
      .eq("manager_user_id", caller.id).eq("client_user_id", campaign.user_id).maybeSingle();
    if (!isOwner && !adminRole && !mgrRow) throw new Error("Forbidden");

    // Fetch profile + KB for suggestions (needed in both branches)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("practice_name, target_audience, campaign_focus, website_url")
      .eq("user_id", campaign.user_id)
      .single();

    const { data: kbDocs } = await adminClient
      .from("knowledge_base")
      .select("title, doc_type, content")
      .eq("user_id", campaign.user_id)
      .in("doc_type", ["audience_analysis", "market_analysis", "brand_guidelines", "custom"])
      .order("updated_at", { ascending: false })
      .limit(4);

    const kbExcerpt = (kbDocs || [])
      .map((d: any) => `[${d.title}]\n${(d.content || "").slice(0, 400)}`)
      .join("\n\n").slice(0, 2000);

    // ── Mode A: return topic suggestions ─────────────────────────────────────
    if (pickSuggestion) {
      const suggestions = await suggestTopics({
        apiKey,
        practiceName: profile?.practice_name || "the practice",
        campaignFocus: profile?.campaign_focus || campaign.name,
        targetAudience: profile?.target_audience || "local patients",
        kbExcerpt,
      });
      return new Response(
        JSON.stringify({ suggestions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Mode B: generate content hub from topic ───────────────────────────────
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      throw new Error("topic is required when not using pickSuggestion mode");
    }

    const topicSource: "user_provided" | "ai_suggested" =
      body.topicSource === "ai_suggested" ? "ai_suggested" : "user_provided";

    // Mark processing
    await adminClient
      .from("campaigns")
      .update({ generation_status: "processing", generation_error: null })
      .eq("id", campaignId);

    // @ts-ignore Supabase Edge Runtime global
    EdgeRuntime.waitUntil(
      runContentHub(adminClient, apiKey, campaignId, topic.trim(), topicSource)
    );

    return new Response(
      JSON.stringify({ jobStarted: true, status: "processing" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[generate-content-hub]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: err.message === "Unauthorized" || err.message === "Forbidden" ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
