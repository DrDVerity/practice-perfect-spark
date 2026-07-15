/**
 * generate-campaign-content  (REWRITTEN — Step 2 of the new content hub workflow)
 *
 * Reads campaigns.blog_article + campaigns.youtube_script and derives
 * platform-specific posts for every channel in the campaign.
 *
 * Social platforms  → extract 3-5 punchy posts adapted to platform tone
 * YouTube channel   → use youtube_script directly as the post's text_content
 * Email channels    → derive 3 patient broadcast emails from the blog article (sent to the practice's mailing list)
 * SMS channel       → derive 2-3 short SMS messages from the article

 *
 * Must be called AFTER generate-content-hub has set generation_status = 'content_ready'.
 * Will also work if called directly (falls back to strategy text if no blog_article yet).
 */

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_ADAPT: Record<string, string> = {
  facebook:
    "Facebook: warm, community-focused. 3-5 short sentences. One CTA. Reference the blog for 'full article' link.",
  instagram:
    "Instagram: visual-first caption. Hook in line 1. 3-4 sentences. 5-8 relevant hashtags. CTA: 'link in bio'.",
  linkedin:
    "LinkedIn: professional, insight-led. 2-line hook. 3-5 bullet takeaways from the article. CTA: 'Read the full article'.",
  twitter:
    "X/Twitter: single powerful insight from the article. 240 chars max. One link. No hashtag spam.",
  tiktok:
    "TikTok: casual, energetic. Hook question in line 1. 2-3 key facts as short punchy lines. CTA to profile link.",
  internal_email:
    "Email funnel: subject line (5-8 words) as title, full email body with hook, article summary, single CTA button.",
  mailchimp:
    "Email newsletter: subject line as title, newsletter-style body with article teaser and 'Read more' CTA.",
  beehiiv:
    "Newsletter: engaging subject as title, conversational body summarising the article, link to full post.",
  internal_sms:
    "SMS: ≤160 chars. Reference the key benefit from the article + short link. Include opt-out.",
};

async function callAI(apiKey: string, system: string, user: string, temperature = 0.8): Promise<string> {
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
      max_tokens: 2048,
    }),
  });
  if (!resp.ok) throw new Error(`AI call failed ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJson(raw: string): any {
  // Try to find a JSON array first, then object
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) return JSON.parse(arrMatch[0]);
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) return JSON.parse(objMatch[0]);
  throw new Error("No JSON found in AI response");
}

interface GeneratedPost {
  title: string;
  text_content: string;
  image_prompt: string;
  scheduled_offset_days: number;
  post_format?: 'image' | 'carousel' | 'interactive';
  carousel_slides?: Array<{ heading: string; body: string; imagePrompt?: string }> | null;
  interactive_payload?: any | null;
}

interface SocialPostBrief {
  businessName: string;
  businessType: string;
  coreOffer: string;
  campaignTopic: string;
  campaignPromise: string;
  targetAudience: string;
  voice: string;
  mustInclude: string[];
  mustAvoid: string[];
}

const cleanLine = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

const DEFAULT_MUST_AVOID = [
  "teeth whitening",
  "Invisalign",
  "implants",
  "veneers",
  "smile makeovers",
  "routine cleanings",
  "appointments",
  "weddings",
  "graduations",
  "vacations",
  "summer specials",
  "patient-facing dental treatment offers that are not named in the campaign brief",
];

const GENERIC_CONTEXT_TOKENS = new Set([
  "practice", "dental", "campaign", "marketing", "business", "account",
  "target", "audience", "owner", "owners", "patients", "services",
]);

function buildCampaignTokenSet(campaign: any, profile: any): Set<string> {
  return new Set(
    [
      campaign?.name,
      campaign?.focus,
      campaign?.target_audience,
      campaign?.content_topic,
      profile?.practice_name,
      profile?.campaign_focus,
      profile?.target_audience,
    ]
      .filter(Boolean)
      .flatMap((s: string) => String(s).toLowerCase().split(/[^a-z0-9]+/))
      .filter((w) => w.length >= 4 && !GENERIC_CONTEXT_TOKENS.has(w)),
  );
}

function isLikelyOtherClientReport(doc: any, campaignId: string, campaignTokenSet: Set<string>): boolean {
  const title = String(doc?.title || "").toLowerCase();
  const metadata = doc?.metadata || {};
  const sourceCampaignId = metadata?.campaign_id || metadata?.campaignId;
  if (sourceCampaignId && sourceCampaignId !== campaignId) return true;

  const looksLikeClientReport =
    /practice intelligence report|competitive landscape|reputation.*sentiment|sentiment analysis|campaign research|blog:/i.test(title);
  if (!looksLikeClientReport) return false;

  for (const tok of campaignTokenSet) if (title.includes(tok)) return false;
  return true;
}

function fallbackBrief(opts: {
  practiceName: string;
  profileFocus: string;
  campaignName: string;
  campaignFocus: string;
  contentTopic: string;
  targetAudience: string;
  brandVoice: string;
}): SocialPostBrief {
  const topic = cleanLine(opts.contentTopic || opts.campaignName || opts.campaignFocus);
  return {
    businessName: cleanLine(opts.practiceName) || "the business",
    businessType: cleanLine(opts.profileFocus) || "the business described in the campaign strategy and knowledge base",
    coreOffer: cleanLine(opts.campaignFocus || topic),
    campaignTopic: topic,
    campaignPromise: cleanLine(opts.campaignFocus || topic),
    targetAudience: cleanLine(opts.targetAudience) || "the campaign target audience",
    voice: cleanLine(opts.brandVoice) || "professional, direct, credible, and warm",
    mustInclude: [topic, opts.campaignFocus].map(cleanLine).filter(Boolean),
    mustAvoid: DEFAULT_MUST_AVOID,
  };
}

async function buildSocialPostBrief(opts: {
  apiKey: string;
  practiceName: string;
  profileFocus: string;
  campaignName: string;
  campaignFocus: string;
  contentTopic: string;
  targetAudience: string;
  brandVoice: string;
  strategy: string;
  psychologicalApproach: string;
  targetMarketRefined: string;
  kbExcerpt: string;
}): Promise<SocialPostBrief> {
  const fallback = fallbackBrief(opts);
  const system = `You are a campaign brief editor for social media generation. Return ONLY valid JSON with keys:
{"businessName":string,"businessType":string,"coreOffer":string,"campaignTopic":string,"campaignPromise":string,"targetAudience":string,"voice":string,"mustInclude":string[],"mustAvoid":string[]}

SOURCE PRIORITY — obey this order when sources conflict:
1) Campaign strategic plan, campaign name, campaign focus, refined target market, and psychological approach are authoritative.
2) The profile and knowledge base explain the business and audience.
3) Prior blog/article text is supporting material only and must be ignored if it conflicts with the strategy.

Do not turn a business-to-business campaign into a patient-facing dental treatment campaign. Do not invent seasonal promotions or clinical services unless the campaign topic/focus explicitly names them.`;

  const user = `CAMPAIGN NAME:
${opts.campaignName || "(none)"}

CAMPAIGN TOPIC:
${opts.contentTopic || opts.campaignName || "(none)"}

CAMPAIGN FOCUS / OFFER:
${opts.campaignFocus || "(none)"}

STRATEGIC PLAN (AUTHORITATIVE):
${opts.strategy || "(none)"}

PSYCHOLOGICAL APPROACH:
${opts.psychologicalApproach || "(none)"}

REFINED TARGET MARKET:
${opts.targetMarketRefined || "(none)"}

PROFILE:
- Business/profile name: ${opts.practiceName || "(unknown)"}
- Business focus/positioning: ${opts.profileFocus || "(none)"}
- Default target audience: ${opts.targetAudience || "(none)"}
- Brand voice: ${opts.brandVoice || "(none)"}

KNOWLEDGE BASE EXCERPTS (background only):
${opts.kbExcerpt || "(none)"}

Build the approved brief. If this is about Archer Marketing / an AI marketing agent / the best hiring decision for a dental practice owner, the brief must be B2B marketing/business-growth focused — not about patient whitening, appointments, or treatment promotions.`;

  try {
    const raw = await callAI(opts.apiKey, system, user, 0.25);
    const cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();
    const parsed = ((): Partial<SocialPostBrief> => {
      try { return JSON.parse(cleaned); } catch {}
      const obj = cleaned.match(/\{[\s\S]*\}/);
      if (obj) return JSON.parse(obj[0]);
      throw new Error("No JSON object found in brief response");
    })();
    return {
      businessName: cleanLine(parsed.businessName) || fallback.businessName,
      businessType: cleanLine(parsed.businessType) || fallback.businessType,
      coreOffer: cleanLine(parsed.coreOffer) || fallback.coreOffer,
      campaignTopic: cleanLine(parsed.campaignTopic) || fallback.campaignTopic,
      campaignPromise: cleanLine(parsed.campaignPromise) || fallback.campaignPromise,
      targetAudience: cleanLine(parsed.targetAudience) || fallback.targetAudience,
      voice: cleanLine(parsed.voice) || fallback.voice,
      mustInclude: Array.isArray(parsed.mustInclude) ? parsed.mustInclude.map(cleanLine).filter(Boolean).slice(0, 10) : fallback.mustInclude,
      mustAvoid: Array.isArray(parsed.mustAvoid)
        ? [...parsed.mustAvoid.map(cleanLine).filter(Boolean), ...DEFAULT_MUST_AVOID].slice(0, 18)
        : fallback.mustAvoid,
    };
  } catch (e) {
    console.warn("[generate-campaign-content] brief extraction failed; using fallback", e);
    return fallback;
  }
}

// Derive social posts from blog article
async function derivePostsFromArticle(opts: {
  apiKey: string;
  platform: string;
  blogArticle: string;
  contentTopic: string;
  practiceName: string;
  campaignName: string;
  campaignFocus: string;
  strategy: string;
  psychologicalApproach: string;
  targetMarketRefined: string;
  brief: SocialPostBrief;
  landingPageUrl?: string;
  postCount: number;
  campaignDays: number;
}): Promise<GeneratedPost[]> {
  const hint = PLATFORM_ADAPT[opts.platform.toLowerCase()] ?? PLATFORM_ADAPT.facebook;

  const system = `You are a senior social media strategist adapting an approved campaign brief into ${opts.platform} posts.
Platform guidance: ${hint}

CRITICAL CONTENT FIDELITY RULES:
- The approved social post brief, campaign strategy, campaign topic, and campaign focus are authoritative.
- Use the source article only when it supports the approved campaign brief. If the article conflicts or drifts, ignore the conflicting article details.
- Write from the business named in the brief to the target audience named in the brief.
- Do NOT substitute a different subject, industry, product, service, or seasonal promotion.
- Do NOT write patient-facing dental treatment posts unless the campaign topic/focus explicitly names that treatment.
- Forbidden drift topics unless explicitly in the brief: teeth whitening, Invisalign, implants, veneers, smile makeovers, routine cleanings, appointments, weddings, graduations, vacations, summer specials.
Return ONLY a JSON array (no wrapper object):
[ {
  "title": string,
  "text_content": string,
  "image_prompt": string,
  "scheduled_offset_days": number,
  "post_format": "image" | "carousel" | "interactive",
  "carousel_slides": [ { "heading": string (<=40 chars), "body": string (<=140 chars), "imagePrompt": string } ] | null,
  "interactive_payload": { "kind": "quiz"|"puzzle"|"game", "title": string, "intro": string, "questions": [ { "q": string, "choices": string[], "answerIndex": number, "explanation": string } ], "steps": string[] | null } | null
} ]

CONTENT-FORMAT RULES (STRICT):
- When ${opts.postCount} >= 3 and this is a visual social platform (facebook, instagram, linkedin, tiktok), the array MUST include:
    * at least ONE post with post_format = "carousel" and 4 slides in "carousel_slides".
    * ONE post with post_format = "interactive" (quiz/puzzle/game) ONLY when the campaign topic naturally supports engagement; otherwise use "image".
- Every other post uses post_format = "image" with carousel_slides = null and interactive_payload = null.
- For Twitter/X keep everything post_format = "image".`;

  const user = `APPROVED SOCIAL POST BRIEF (AUTHORITATIVE):
${JSON.stringify(opts.brief, null, 2)}

Business: ${opts.brief.businessName || opts.practiceName}
Campaign: ${opts.campaignName}
Topic: ${opts.brief.campaignTopic || opts.contentTopic}
Campaign focus / offer: ${opts.campaignFocus}
Campaign promise: ${opts.brief.campaignPromise}
Audience: ${opts.brief.targetAudience}
${opts.landingPageUrl ? `Landing page / article URL: ${opts.landingPageUrl}` : ""}
Campaign duration: ${opts.campaignDays} days

Strategic plan (authoritative):
${opts.strategy.slice(0, 4500) || "(none)"}

Refined target market:
${opts.targetMarketRefined.slice(0, 1600) || "(none)"}

Psychological approach:
${opts.psychologicalApproach.slice(0, 1000) || "(none)"}

Source article (supporting only — ignore conflicting/drifted details):
${opts.blogArticle.slice(0, 5000)}

Derive ${opts.postCount} unique ${opts.platform} posts from this article, following the format rules above.
Each post should highlight a different insight, tip, or angle that advances the approved campaign brief and strategy.
scheduled_offset_days: integer 0..${Math.max(0, opts.campaignDays - 1)}.
image_prompt: brief description of the ideal accompanying image that matches the approved topic/business; no text overlays.
Return JSON array only.`;

  const raw = await callAI(opts.apiKey, system, user, 0.8);
  const parsed = extractJson(raw);
  const list: GeneratedPost[] = Array.isArray(parsed) ? parsed : parsed.posts ?? [];

  // Safety net: for visual social platforms with 3+ posts, guarantee at least one carousel.
  const visualPlatforms = new Set(["facebook", "instagram", "linkedin", "tiktok"]);
  if (opts.postCount >= 3 && visualPlatforms.has(opts.platform.toLowerCase()) && list.length &&
      !list.some((p) => p.post_format === "carousel")) {
    const src = list[0];
    list[0] = {
      ...src,
      post_format: "carousel",
      carousel_slides: [1, 2, 3, 4].map((n) => ({
        heading: `Highlight ${n}`,
        body: (src.text_content || "").slice((n - 1) * 130, n * 130) || `Key point ${n}.`,
        imagePrompt: src.image_prompt || "professional on-brand campaign photography",
      })),
    };
  }
  // Normalize defaults
  return list.map((p) => ({
    ...p,
    post_format: (p.post_format as any) || "image",
    carousel_slides: p.post_format === "carousel" ? (p.carousel_slides || null) : null,
    interactive_payload: p.post_format === "interactive" ? (p.interactive_payload || null) : null,
  }));
}

// Build YouTube post from the script
function buildYouTubePost(opts: {
  youtubeScript: string;
  contentTopic: string;
  blogArticle: string;
  landingPageUrl?: string;
}): GeneratedPost {
  // Extract the [HOOK] line as title
  const hookMatch = opts.youtubeScript.match(/\[HOOK\][^\n]*\n([^\n\[]+)/);
  const titleFallback = opts.contentTopic;
  const title = hookMatch ? hookMatch[1].trim().slice(0, 120) : titleFallback;

  // YouTube post = full script as text_content
  const ctaLine = opts.landingPageUrl
    ? `\n\n👉 ${opts.landingPageUrl}`
    : "";

  return {
    title: `VIDEO: ${title}`,
    text_content: opts.youtubeScript + ctaLine,
    image_prompt: `Professional YouTube thumbnail for: ${opts.contentTopic}. Clean background, bold readable text overlay space, high contrast.`,
    scheduled_offset_days: 0,
  };
}

// Patient broadcast emails from blog article (sent to the practice's existing mailing list)
async function deriveEmailFunnel(opts: {
  apiKey: string;
  platform: string;
  blogArticle: string;
  contentTopic: string;
  practiceName: string;
  targetAudience: string;
  campaignName: string;
  campaignFocus: string;
  strategy: string;
  brief: SocialPostBrief;
  landingPageUrl?: string;
  campaignDays: number;
}): Promise<GeneratedPost[]> {
  const hint = PLATFORM_ADAPT[opts.platform.toLowerCase()] ?? PLATFORM_ADAPT.internal_email;

  const days = opts.campaignDays;
  // 3 broadcast emails: announce, midpoint value/reminder, final CTA
  const offsets = [0, Math.max(1, Math.floor(days * 0.5)), Math.max(2, days - 1)];

  const system = `You are an email copywriter writing PATIENT BROADCAST emails for an existing dental practice mailing list.
These messages go to the practice's current patients — people who already know and trust the practice.
Write exactly 3 emails for the campaign:
 1 — Announcement (CAROUSEL FORMAT): teaser paragraph + a 4-slide carousel derived from the blog article and any social carousels planned for this campaign. Each slide follows carousel best practices: a hook slide, 2 value slides, and a final CTA slide. Every slide has a distinct image_prompt describing a specific visual for that slide.
 2 — Value / reminder: single-image email with an image_prompt for the hero image
 3 — Final CTA: single-image email with an image_prompt for the hero image
Tone: warm, familiar, patient-first (not lead-nurture). Address them as valued patients of ${opts.practiceName}.
${hint}
The approved brief and strategic plan are authoritative. Do not invent treatments or offers not named in the brief.
Every image_prompt must match the actual campaign topic — do not default to generic clinical/dental stock imagery unless the topic explicitly requires it.
Return ONLY a JSON array of 3 items:
[
  {
    "title": string,
    "text_content": string,
    "post_format": "carousel",
    "carousel_slides": [
      { "heading": string (<=40 chars), "body": string (<=140 chars), "imagePrompt": string },
      { "heading": string, "body": string, "imagePrompt": string },
      { "heading": string, "body": string, "imagePrompt": string },
      { "heading": string, "body": string, "imagePrompt": string }
    ],
    "image_prompt": string,
    "scheduled_offset_days": number
  },
  { "title": string, "text_content": string, "post_format": "image", "image_prompt": string, "scheduled_offset_days": number },
  { "title": string, "text_content": string, "post_format": "image", "image_prompt": string, "scheduled_offset_days": number }
]`;

  const user = `APPROVED BRIEF:
${JSON.stringify(opts.brief, null, 2)}

Practice: ${opts.practiceName}
Campaign: ${opts.campaignName}
Audience: existing patients of ${opts.practiceName} (mailing list)
Topic: ${opts.brief.campaignTopic || opts.contentTopic}
Campaign focus / offer: ${opts.campaignFocus}
Suggested send offsets (days): ${offsets.join(", ")}
${opts.landingPageUrl ? `CTA URL: ${opts.landingPageUrl}` : ""}

Strategic plan:
${opts.strategy.slice(0, 3500)}

Source blog article (use for carousel content in email 1):
${opts.blogArticle.slice(0, 4000)}

Generate exactly 3 patient broadcast emails. Return JSON array only.`;

  const raw = await callAI(opts.apiKey, system, user);
  const parsed = extractJson(raw);
  const posts: GeneratedPost[] = Array.isArray(parsed) ? parsed : parsed.posts ?? [];
  return posts.slice(0, 3).map((p, i) => ({
    ...p,
    post_format: i === 0 ? "carousel" : (p.post_format || "image"),
    carousel_slides: i === 0 ? (p.carousel_slides || null) : null,
    image_prompt: p.image_prompt || "",
    scheduled_offset_days: typeof p.scheduled_offset_days === "number" ? p.scheduled_offset_days : offsets[i] ?? 0,
  }));
}


// SMS messages from blog article
async function deriveSmsMessages(opts: {
  apiKey: string;
  blogArticle: string;
  contentTopic: string;
  practiceName: string;
  campaignName: string;
  campaignFocus: string;
  brief: SocialPostBrief;
  landingPageUrl?: string;
  campaignDays: number;
}): Promise<GeneratedPost[]> {
  const system = `You are an SMS marketer. Write ≤160-char messages from the approved campaign brief.
The brief and strategy are authoritative. Do not drift into dental treatment promotions unless explicitly named in the brief.
Return ONLY a JSON array:
[ { "title": string, "text_content": string, "image_prompt": "", "scheduled_offset_days": number } ]`;

  const user = `APPROVED BRIEF:
${JSON.stringify(opts.brief, null, 2)}

Business: ${opts.practiceName}
Campaign: ${opts.campaignName}
Topic: ${opts.brief.campaignTopic || opts.contentTopic}
Campaign focus / offer: ${opts.campaignFocus}
Campaign duration: ${opts.campaignDays} days
${opts.landingPageUrl ? `Link: ${opts.landingPageUrl}` : ""}

Source article (supporting only; first 500 chars):
${opts.blogArticle.slice(0, 500)}

Generate 2 SMS messages spaced through the campaign. Each ≤160 chars including opt-out. Return JSON array only.`;

  const raw = await callAI(opts.apiKey, system, user);
  const parsed = extractJson(raw);
  return Array.isArray(parsed) ? parsed : parsed.posts ?? [];
}

async function generateImage(apiKey: string, prompt: string, platform: string): Promise<string | null> {
  try {
    const enhanced = `Professional marketing image for ${platform}. ${prompt}. Match the actual campaign topic and business audience. Do not default to clinical, medical, or dental imagery unless the prompt explicitly requires it. Clean, modern, photorealistic, no text.`;
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: enhanced }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
  } catch { return null; }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      ret[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return ret;
}

// ── Main generation job ───────────────────────────────────────────────────────

async function runGeneration(
  supabaseAdmin: ReturnType<typeof createClient>,
  campaignId: string,
  providedStrategy?: string,
  force = false,
  options: { channelId?: string; replaceDrafts?: boolean } = {},
) {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

  try {
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("*, campaign_channels(*)")
      .eq("id", campaignId)
      .single();
    if (!campaign) throw new Error("Campaign not found");

    const channels = (campaign.campaign_channels || [])
      .filter((ch: any) => !options.channelId || ch.id === options.channelId);
    if (channels.length === 0) {
      await supabaseAdmin.from("campaigns")
        .update({ generation_status: "completed", generation_error: "No channels to generate for" })
        .eq("id", campaignId);
      return;
    }

    // Per-channel guard: skip channels that already have image-bearing posts
    // (unless force / replaceDrafts). Empty channels still get generated so
    // newly-added channels (e.g. email added after initial run) get filled in.
    let channelsToGenerate = channels;
    if (!force && !options.replaceDrafts) {
      const channelIds = channels.map((c: any) => c.id);
      const { data: existingWithImages } = await supabaseAdmin
        .from("channel_posts")
        .select("campaign_channel_id")
        .in("campaign_channel_id", channelIds)
        .not("image_url", "is", null);
      const skipIds = new Set((existingWithImages || []).map((r: any) => r.campaign_channel_id));
      channelsToGenerate = channels.filter((c: any) => !skipIds.has(c.id));
      if (channelsToGenerate.length === 0) {
        console.log(`[generate-campaign-content] Skip: all channels for ${campaignId} already have posts with images.`);
        await supabaseAdmin.from("campaigns")
          .update({ generation_status: "completed", generation_error: null })
          .eq("id", campaignId);
        return;
      }
    }


    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("practice_name, website_url, target_audience, campaign_focus, brand_voice")
      .eq("user_id", campaign.user_id).single();

    const { data: kbDocs } = await supabaseAdmin
      .from("knowledge_base")
      .select("title, doc_type, content, metadata")
      .eq("user_id", campaign.user_id)
      .in("doc_type", ["audience_analysis", "market_analysis", "brand_guidelines", "competitive_landscape", "system_prompt", "business_dna", "demographics", "custom"])
      .order("updated_at", { ascending: false })
      .limit(12);

    const campaignTokenSet = buildCampaignTokenSet(campaign, profile);
    const kbExcerpt = (kbDocs || [])
      .filter((d: any) => (d.metadata as any)?.file_kind !== "image")
      .filter((d: any) => !isLikelyOtherClientReport(d, campaignId, campaignTokenSet))
      .map((d: any) => `### ${d.title} (${d.doc_type})\n${(d.content || "").slice(0, 700)}`)
      .join("\n\n")
      .slice(0, 6000);

    // ── Source content ────────────────────────────────────────────────────────
    // Prefer content hub article; fall back to strategy text for backwards compat.
    const strategy: string = campaign.strategy || providedStrategy || "";
    const blogArticle: string = campaign.blog_article || strategy || "";
    const youtubeScript: string = campaign.youtube_script || "";
    const contentTopic: string = campaign.focus || campaign.content_topic || campaign.name;

    if (!blogArticle) {
      throw new Error("No blog article or strategy found. Run generate-content-hub first.");
    }

    const start = campaign.start_date ? new Date(campaign.start_date) : new Date();
    const end = campaign.end_date ? new Date(campaign.end_date)
      : new Date(start.getTime() + 14 * 86400000);
    const campaignDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const postCount = Math.min(5, Math.max(2, Math.round(campaignDays / 4)));
    const landingPageUrl = campaign.landing_page_url || undefined;
    const campaignFocus = cleanLine(campaign.focus || campaign.name || contentTopic);
    const socialBrief = await buildSocialPostBrief({
      apiKey: OPENROUTER_API_KEY,
      practiceName: profile?.practice_name || "the business",
      profileFocus: profile?.campaign_focus || "",
      campaignName: campaign.name || "",
      campaignFocus,
      contentTopic,
      targetAudience: (campaign as any).target_audience || profile?.target_audience || "",
      brandVoice: profile?.brand_voice || "",
      strategy,
      psychologicalApproach: (campaign as any).psychological_approach || "",
      targetMarketRefined: (campaign as any).target_market_refined || "",
      kbExcerpt,
    });

    if (options.replaceDrafts && channelsToGenerate.length > 0) {
      const channelIds = channelsToGenerate.map((c: any) => c.id);
      await supabaseAdmin
        .from("channel_posts")
        .delete()
        .in("campaign_channel_id", channelIds)
        .is("bundle_social_post_id", null)
        .in("status", ["draft", "scheduled"]);
    }


    const baseOpts = {
      apiKey: OPENROUTER_API_KEY,
      practiceName: profile?.practice_name || "the practice",
      targetAudience: (campaign as any).target_audience || profile?.target_audience || "the campaign's target audience",
      blogArticle,
      contentTopic,
      campaignName: campaign.name || "",
      campaignFocus,
      strategy,
      psychologicalApproach: (campaign as any).psychological_approach || "",
      targetMarketRefined: (campaign as any).target_market_refined || "",
      brief: socialBrief,
      landingPageUrl,
      campaignDays,
    };

    type InsertedRow = { id: string; image_prompt: string; platform: string };
    const insertedAll: InsertedRow[] = [];

    // Generate posts per channel
    await Promise.allSettled(channels.map(async (ch: any) => {
      const platform: string = (ch.platform || "").toLowerCase();
      const channelType: string = (ch.channel_type || "").toLowerCase();
      let posts: GeneratedPost[] = [];

      if (platform === "youtube") {
        // YouTube channel gets the full video script as a single post
        if (youtubeScript) {
          posts = [buildYouTubePost({ youtubeScript, contentTopic, blogArticle, landingPageUrl })];
        } else {
          // Fallback: derive from article if no script
          posts = await derivePostsFromArticle({ ...baseOpts, platform: "youtube", postCount: 1 });
        }
      } else if (channelType === "email" || platform === "internal_email" ||
                 platform === "mailchimp" || platform === "beehiiv") {
        posts = await deriveEmailFunnel({ ...baseOpts, platform, postCount });
      } else if (channelType === "sms" || platform === "internal_sms") {
        posts = await deriveSmsMessages({ ...baseOpts });
      } else {
        // Social platforms: Facebook, Instagram, LinkedIn, Twitter, TikTok
        posts = await derivePostsFromArticle({ ...baseOpts, platform, postCount });
      }

      if (posts.length === 0) return;

      // Bulk insert — no images yet
      const rows = posts.map((p) => {
        const offset = Math.max(0, Math.min(campaignDays - 1, Math.round(p.scheduled_offset_days || 0)));
        const scheduledStart = new Date(start.getTime() + offset * 86400000);
        return {
          campaign_channel_id: ch.id,
          title: (p.title || contentTopic).slice(0, 200),
          text_content: p.text_content || "",
          image_url: null as string | null,
          video_url: null,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: new Date(scheduledStart.getTime() + 30 * 60000).toISOString(),
          status: "draft",
          post_format: p.post_format || "image",
          carousel_slides: p.carousel_slides || null,
          interactive_payload: p.interactive_payload || null,
        };
      });

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("channel_posts").insert(rows).select("id");
      if (insErr) { console.error("Insert error", ch.platform, insErr); return; }

      (inserted || []).forEach((row: any, i: number) => {
        insertedAll.push({ id: row.id, image_prompt: posts[i]?.image_prompt || "", platform: ch.platform });
      });
    }));

    // Generate images concurrently (best-effort)
    const needImages = insertedAll.filter((r) => r.image_prompt);
    await mapLimit(needImages, 4, async (r) => {
      const url = await generateImage(OPENROUTER_API_KEY, r.image_prompt, r.platform);
      if (url) await supabaseAdmin.from("channel_posts").update({ image_url: url }).eq("id", r.id);
    });

    await supabaseAdmin.from("campaigns")
      .update({ generation_status: "completed", generation_error: null })
      .eq("id", campaignId);

    console.log(`[generate-campaign-content] Done: ${insertedAll.length} posts for ${campaignId}`);
  } catch (err: any) {
    console.error("[generate-campaign-content] Failed:", err.message);
    await supabaseAdmin.from("campaigns")
      .update({ generation_status: "failed", generation_error: err.message })
      .eq("id", campaignId);
  }
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId, strategy, force, channelId, replaceDrafts } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await adminClient.auth.getUser(token);
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const caller = userData.user;

    const { data: campaign } = await adminClient.from("campaigns").select("user_id").eq("id", campaignId).single();
    if (!campaign) throw new Error("Campaign not found");

    let allowed = caller.id === campaign.user_id;
    if (!allowed) {
      const { data: r } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (r) allowed = true;
    }
    if (!allowed) {
      const { data: m } = await adminClient.from("manager_assignments").select("id").eq("manager_user_id", caller.id).eq("client_user_id", campaign.user_id).maybeSingle();
      if (m) allowed = true;
    }
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await adminClient.from("campaigns")
      .update({ generation_status: "processing", generation_error: null })
      .eq("id", campaignId);

    // @ts-ignore EdgeRuntime is Supabase-provided
    EdgeRuntime.waitUntil(runGeneration(adminClient, campaignId, strategy, !!force, {
      channelId: typeof channelId === "string" ? channelId : undefined,
      replaceDrafts: !!replaceDrafts,
    }));

    return new Response(
      JSON.stringify({ jobStarted: true, status: "processing" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
