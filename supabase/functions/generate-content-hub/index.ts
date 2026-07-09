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

function extractJsonObject<T = any>(raw: string): T {
  const cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const obj = cleaned.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]) as T;
  throw new Error("No JSON object found");
}

function cleanSingleLine(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[-–—:\s]+|[-–—:\s]+$/g, "")
    .trim();
}

function deriveTopicFromStrategy(strategy?: string | null): string {
  const text = strategy || "";
  const coreMessage =
    text.match(/\*\*Core Message:\*\*\s*\*\*([\s\S]*?)\*\*/i)?.[1] ||
    text.match(/Core Message:\s*([\s\S]*?)(?:\n\n|\n\*|\n##|$)/i)?.[1] ||
    text.match(/##\s*Key Message[\s\S]*?\*\s*\*\*([^*\n][\s\S]*?)\*\*/i)?.[1] ||
    "";
  return cleanSingleLine(coreMessage).slice(0, 220);
}

function resolveContentTopic(campaign: any, explicitTopic?: string): string {
  return cleanSingleLine(
    explicitTopic ||
    campaign?.focus ||
    deriveTopicFromStrategy(campaign?.strategy) ||
    campaign?.content_topic ||
    [campaign?.name, campaign?.focus].filter(Boolean).join(" — ") ||
    campaign?.focus ||
    campaign?.name
  );
}

interface ArticleBrief {
  businessName: string;
  businessType: string;
  coreOffer: string;
  targetAudience: string;
  articleTopic: string;
  campaignPromise: string;
  mustInclude: string[];
  mustAvoid: string[];
}

function fallbackArticleBrief(opts: {
  topic: string;
  practiceName: string;
  businessDescription: string;
  campaignFocus: string;
  targetAudience: string;
}): ArticleBrief {
  return {
    businessName: opts.practiceName || "the business",
    businessType: opts.businessDescription || "business described by the strategic plan",
    coreOffer: opts.campaignFocus || opts.topic,
    targetAudience: opts.targetAudience || "the campaign's target audience",
    articleTopic: opts.topic,
    campaignPromise: opts.campaignFocus || opts.topic,
    mustInclude: [opts.topic, opts.campaignFocus].filter(Boolean),
    mustAvoid: ["unrelated seasonal promotions", "clinical service offers not present in the campaign topic"],
  };
}

async function generateArticleBrief(opts: {
  apiKey: string;
  topic: string;
  campaignName: string;
  campaignFocus: string;
  practiceName: string;
  websiteUrl: string;
  targetAudience: string;
  businessDescription: string;
  strategyExcerpt: string;
  kbExcerpt: string;
}): Promise<ArticleBrief> {
  const fallback = fallbackArticleBrief(opts);
  const system = `You are a campaign brief editor. Return ONLY valid JSON with keys:
{"businessName":string,"businessType":string,"coreOffer":string,"targetAudience":string,"articleTopic":string,"campaignPromise":string,"mustInclude":string[],"mustAvoid":string[]}

SOURCE PRIORITY — obey this order when sources conflict:
1) Campaign strategic plan and explicit campaign topic/focus are authoritative.
2) Profile fields are secondary.
3) Knowledge base excerpts are background only; ignore any KB material that conflicts with the strategic plan, campaign topic, or campaign focus.

Your job is to identify the business publishing the article, what it actually sells, who it is addressing, and what the article must be about. Do not invent a seasonal promotion or clinical service unless the campaign topic/focus explicitly says so.

IDENTITY GUARDRAIL — the publishing business is defined by the campaign focus, campaign name, and profile business name. Never adopt a business name, city, street address, phone number, or practice identity that appears in the KB excerpts unless it also matches the campaign focus/name or profile business name. KB reports for other practices are stale context, not the identity of the publisher.

  const user = `EXPLICIT CAMPAIGN TOPIC:
${opts.topic}

CAMPAIGN NAME:
${opts.campaignName || "(none)"}

CAMPAIGN FOCUS / OFFER:
${opts.campaignFocus || "(none)"}

LATEST STRATEGIC PLAN (AUTHORITATIVE):
${opts.strategyExcerpt || "(none)"}

PROFILE FIELDS:
- Profile/business name: ${opts.practiceName || "(unknown)"}
- Website: ${opts.websiteUrl || "N/A"}
- Profile campaign focus: ${opts.businessDescription || "(none)"}
- Profile target audience: ${opts.targetAudience || "(none)"}

KNOWLEDGE BASE EXCERPTS (BACKGROUND ONLY; ignore if contradictory):
${opts.kbExcerpt || "(none)"}

Build the approved article brief now. If the strategic plan says this is about Archer Marketing / an AI marketing agent / a marketing agency for dental practice owners, the brief must NOT become a patient-facing dental treatment promotion.`;

  try {
    const raw = await callAI(opts.apiKey, system, user, 0.2);
    const parsed = extractJsonObject<Partial<ArticleBrief>>(raw);
    return {
      businessName: cleanSingleLine(parsed.businessName) || fallback.businessName,
      businessType: cleanSingleLine(parsed.businessType) || fallback.businessType,
      coreOffer: cleanSingleLine(parsed.coreOffer) || fallback.coreOffer,
      targetAudience: cleanSingleLine(parsed.targetAudience) || fallback.targetAudience,
      articleTopic: cleanSingleLine(parsed.articleTopic) || fallback.articleTopic,
      campaignPromise: cleanSingleLine(parsed.campaignPromise) || fallback.campaignPromise,
      mustInclude: Array.isArray(parsed.mustInclude) ? parsed.mustInclude.map(cleanSingleLine).filter(Boolean).slice(0, 8) : fallback.mustInclude,
      mustAvoid: Array.isArray(parsed.mustAvoid) ? parsed.mustAvoid.map(cleanSingleLine).filter(Boolean).slice(0, 8) : fallback.mustAvoid,
    };
  } catch (e) {
    console.warn("[content-hub] brief extraction failed; using fallback", e);
    return fallback;
  }
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
  apiKey: string; topic: string; practiceName: string; targetAudience: string; campaignFocus: string; articleBrief: ArticleBrief;
}): Promise<string> {
  const system = `You write eye-popping, click-worthy blog headlines from an approved campaign brief. The headline MUST be about the approved article topic, aimed at the approved target audience, and reflect the campaign promise. Do NOT drift to unrelated subjects.
Return ONLY the title text — no quotes, no markdown, no explanation. 8-14 words. Concrete, benefit-driven, curiosity-inducing.`;
  const user = `APPROVED ARTICLE BRIEF:
${JSON.stringify(opts.articleBrief, null, 2)}

Original topic: ${opts.topic}
Campaign focus / offer: ${opts.campaignFocus}
Business publishing this: ${opts.practiceName}
Target audience: ${opts.targetAudience}`;
  const raw = await callAI(opts.apiKey, system, user, 0.9);
  return raw.replace(/^["'`]|["'`]$/g, "").split("\n")[0].trim().slice(0, 180);
}

async function generateBlogArticle(opts: {
  apiKey: string;
  topic: string;
  practiceName: string;
  businessDescription: string;
  campaignFocus: string;
  targetAudience: string;
  websiteUrl: string;
  kbExcerpt: string;
  strategyExcerpt: string;
  psychologicalApproach: string;
  targetMarketRefined: string;
  articleBrief: ArticleBrief;
  landingPageUrl?: string;
}): Promise<string> {
  const system = `You are a senior content writer. You write SEO-optimised blog articles from an APPROVED ARTICLE BRIEF. The brief is authoritative; knowledge base excerpts are only background.

CRITICAL — content fidelity rules (do not violate):
- The article MUST be about the approved articleTopic. Do NOT substitute a different subject, industry, product, or seasonal promotion.
- Write FROM the voice of the approved businessName/businessType, addressing the approved targetAudience.
- Reinforce the approved campaignPromise and coreOffer in every major section.
- If the approved business/coreOffer is a marketing agency, AI marketing agent, consultant, or business service for dental practices, the reader is the practice owner/operator — NOT a patient — and the article must be about marketing delegation, ROI, efficiency, growth, and the offer.
- Do NOT write a patient-facing dental treatment article unless the approved articleTopic/coreOffer explicitly names that treatment.
- Forbidden failure mode: do not mention teeth whitening, Invisalign, implants, veneers, smile makeovers, cleanings, appointments, weddings, graduations, vacations, or summer specials unless those exact ideas are in the approved brief.
- If KB excerpts mention old campaigns or clinical services that conflict with the approved brief, ignore them.

Style rules:
- 1000–1500 words
- Markdown headings (##, ###)
- FIRST paragraph must be a compelling hook (question, story, or striking statistic) tightly tied to the topic — no throat-clearing intros
- Use features, statistics, data, authoritative-sounding quotes, and illustration cues (charts/graphs/infographics)
- Where a chart/graph/infographic would add value, insert a markdown placeholder like: \`![Infographic: <description>](chart:<slug>)\` — do NOT invent real image URLs
- Cite general statistics with attribution when possible (industry body, well-known report)
- Include at least one blockquote (>) with an authoritative-sounding quote appropriate to the topic and industry
- Weave in local context naturally only if city/neighbourhood is present in the business info
- End with ONE clear CTA linking to the business or landing page
- No fabricated customer testimonials or identifiable case studies
- Professional but warm — the business owner speaking to their audience`;

  const user = `APPROVED ARTICLE BRIEF (AUTHORITATIVE — write from this):
${JSON.stringify(opts.articleBrief, null, 2)}

TOPIC (write about THIS — do not substitute): ${opts.articleBrief.articleTopic || opts.topic}

CAMPAIGN FOCUS / OFFER (reinforce this in the article): ${opts.campaignFocus || "(none — infer from topic)"}

BUSINESS PUBLISHING THIS ARTICLE:
- Name: ${opts.practiceName}
- Website: ${opts.websiteUrl || "N/A"}
- What the business does / context: ${opts.businessDescription || "(see knowledge base below)"}

TARGET AUDIENCE (write TO these people): ${opts.targetAudience}

${opts.landingPageUrl ? `Landing page for CTA: ${opts.landingPageUrl}` : ""}

Persona + psychographics (refined) for the target audience:
${opts.targetMarketRefined || "(none)"}

Psychological approach for this campaign — reflect it subtly in the framing:
${opts.psychologicalApproach || "(none)"}

Campaign strategy context:
${opts.strategyExcerpt || "(none)"}

Business knowledge base context:
${opts.kbExcerpt || "(none)"}

Write the full blog article now. Use markdown. Start directly with the article body — no preamble, no title (a title is written separately). Stay strictly on the APPROVED ARTICLE BRIEF, TOPIC, and CAMPAIGN FOCUS above. The opening paragraph must clearly signal the approved topic; if it could be mistaken for a dental treatment promotion, rewrite it before returning.`;

  return callAI(opts.apiKey, system, user, 0.45);
}

async function generateHeroImage(opts: {
  apiKey: string; topic: string; blogTitle: string; practiceName: string;
}): Promise<string | null> {
  try {
    const prompt = `Photorealistic, editorial hero image for a blog article titled "${opts.blogTitle}".
Topic: ${opts.topic}. Publishing business: ${opts.practiceName}.
Match the actual subject of the topic — do not default to clinical, medical, or dental imagery unless the topic is explicitly about that.
Bright, modern, professional composition evoking the topic. No on-screen text, no logos, no watermarks. Wide 16:9, shallow depth of field.`;
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
  const system = `You are a YouTube scriptwriter for the business described by the approved article.
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
  topicSource: "user_provided" | "ai_suggested",
  options: { regenerateBlogOnly?: boolean } = {}
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

    const { data: kbDocsRaw } = await supabaseAdmin
      .from("knowledge_base")
      .select("title, doc_type, content")
      .eq("user_id", campaign.user_id)
      .in("doc_type", [
        "audience_analysis", "market_analysis", "brand_guidelines",
        "competitive_landscape", "system_prompt", "business_dna", "custom",
      ])
      .order("updated_at", { ascending: false })
      .limit(20);

    // Determine the "publishing business" identity for THIS campaign so we can
    // exclude KB docs that are research on OTHER practices (very common when an
    // admin has been impersonating multiple clients under one account).
    const campaignBizTokens = [
      campaign.name,
      campaign.focus,
      profile?.practice_name,
      profile?.campaign_focus,
    ]
      .filter(Boolean)
      .flatMap((s: string) => String(s).toLowerCase().split(/[^a-z0-9]+/))
      .filter((w) => w.length >= 4);
    const bizTokenSet = new Set(campaignBizTokens);

    const isOtherPracticeReport = (title: string): boolean => {
      const t = (title || "").toLowerCase();
      const looksLikeReport =
        /practice intelligence report|competitive landscape|reputation.*sentiment|sentiment analysis|campaign research|blog:/i.test(t);
      if (!looksLikeReport) return false;
      // If the title mentions any campaign/business token, keep it. Else drop it.
      for (const tok of bizTokenSet) if (t.includes(tok)) return false;
      return true;
    };

    const kbDocs = (kbDocsRaw || []).filter((d: any) => !isOtherPracticeReport(d.title)).slice(0, 8);

    const kbExcerpt = kbDocs
      .map((d: any) => `[${d.title} — ${d.doc_type}]\n${(d.content || "").slice(0, 600)}`)
      .join("\n\n")
      .slice(0, 5000);

    const strategyExcerpt = (campaign.strategy || "").slice(0, 6000);
    const landingPageUrl = campaign.landing_page_url || undefined;
    const resolvedTopic = resolveContentTopic(campaign, topic);

    // Prefer per-campaign focus/audience over profile-level defaults so each
    // campaign's article stays on that campaign's topic and audience.
    const campaignFocus =
      (campaign.focus && String(campaign.focus).trim()) ||
      (profile?.campaign_focus && String(profile.campaign_focus).trim()) ||
      campaign.name || "";
    const targetAudience =
      ((campaign as any).target_audience && String((campaign as any).target_audience).trim()) ||
      (profile?.target_audience && String(profile.target_audience).trim()) ||
      "the business's core audience";

    // Compact business description built from what we actually know about the
    // publishing business — used to keep the article in the correct industry.
    const businessDescription = [
      profile?.practice_name ? `Business name: ${profile.practice_name}` : "",
      profile?.website_url ? `Website: ${profile.website_url}` : "",
      profile?.campaign_focus
        ? `Ongoing business focus / positioning: ${profile.campaign_focus}`
        : "",
    ].filter(Boolean).join("\n");




    const sharedOpts = {
      apiKey,
      practiceName: profile?.practice_name || "the business",
      campaignFocus,
      targetAudience,
      businessDescription,
      websiteUrl: profile?.website_url || "",
      kbExcerpt,
      strategyExcerpt,
      psychologicalApproach: (campaign as any).psychological_approach || "",
      targetMarketRefined: (campaign as any).target_market_refined || "",
      landingPageUrl,
    };

    const articleBrief = await generateArticleBrief({
      apiKey,
      topic: resolvedTopic,
      campaignName: campaign.name || "",
      campaignFocus,
      practiceName: sharedOpts.practiceName,
      websiteUrl: sharedOpts.websiteUrl,
      targetAudience: sharedOpts.targetAudience,
      businessDescription,
      strategyExcerpt,
      kbExcerpt,
    });
    const effectiveTopic = articleBrief.articleTopic || resolvedTopic;

    // Step A: eye-popping title
    console.log(`[content-hub] Generating blog title for topic="${effectiveTopic}" focus="${campaignFocus.slice(0,80)}"`);
    const blogTitle = await generateBlogTitle({
      apiKey, topic: effectiveTopic,
      practiceName: articleBrief.businessName || sharedOpts.practiceName,
      targetAudience: articleBrief.targetAudience || sharedOpts.targetAudience,
      campaignFocus: sharedOpts.campaignFocus,
      articleBrief,
    });

    // Step B: blog article
    console.log(`[content-hub] Generating blog article`);
    const blogArticle = await generateBlogArticle({ ...sharedOpts, topic: effectiveTopic, articleBrief });

    // Step C: hero image (best-effort — do not block on failure)
    console.log(`[content-hub] Generating hero image`);
    const heroImageUrl = await generateHeroImage({
      apiKey, topic: effectiveTopic, blogTitle, practiceName: articleBrief.businessName || sharedOpts.practiceName,
    });


    // Step D: YouTube script derived from article
    console.log(`[content-hub] Generating YouTube script`);
    const youtubeScript = await generateYouTubeScript({
      apiKey,
      topic: effectiveTopic,
      blogArticle,
      practiceName: articleBrief.businessName || sharedOpts.practiceName,
      targetAudience: articleBrief.targetAudience || sharedOpts.targetAudience,
      landingPageUrl,
    });

    const currentAccepted =
      campaign.assets_accepted && typeof campaign.assets_accepted === "object"
        ? campaign.assets_accepted
        : {};

    // Save everything onto campaign
    await supabaseAdmin
      .from("campaigns")
      .update({
        blog_title: blogTitle,
        blog_article: blogArticle,
        hero_image_url: heroImageUrl,
        youtube_script: youtubeScript,
        content_topic: effectiveTopic,
        topic_source: topicSource,
        assets_accepted: { ...currentAccepted, blog: false },
        generation_status: options.regenerateBlogOnly ? "completed" : "content_ready",  // signals Step 2 can now run
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
    const { campaignId, topic, pickSuggestion, regenerateBlogOnly } = body;
    if (!campaignId) throw new Error("campaignId is required");

    // Verify access
    const { data: campaign } = await adminClient
      .from("campaigns")
      .select("user_id, name, focus, target_audience, content_topic, strategy, landing_page_url")
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
    const resolvedTopic = resolveContentTopic(campaign, typeof topic === "string" ? topic : undefined);
    if (!resolvedTopic) throw new Error("Unable to resolve a blog topic from the campaign plan");

    const topicSource: "user_provided" | "ai_suggested" =
      body.topicSource === "ai_suggested" ? "ai_suggested" : "user_provided";

    // Mark processing
    await adminClient
      .from("campaigns")
      .update({ generation_status: "writing_content", generation_error: null })
      .eq("id", campaignId);

    // @ts-ignore Supabase Edge Runtime global
    EdgeRuntime.waitUntil(
      runContentHub(adminClient, apiKey, campaignId, resolvedTopic, topicSource, { regenerateBlogOnly: !!regenerateBlogOnly })
    );

    return new Response(
      JSON.stringify({ jobStarted: true, status: "writing_content" }),
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
