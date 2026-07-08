/**
 * generate-campaign-content  (REWRITTEN — Step 2 of the new content hub workflow)
 *
 * Reads campaigns.blog_article + campaigns.youtube_script and derives
 * platform-specific posts for every channel in the campaign.
 *
 * Social platforms  → extract 3-5 punchy posts adapted to platform tone
 * YouTube channel   → use youtube_script directly as the post's text_content
 * Email channels    → derive a 5-email funnel from the blog article
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
[ { "title": string, "text_content": string, "image_prompt": string, "scheduled_offset_days": number } ]`;

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

Derive ${opts.postCount} unique ${opts.platform} posts from this article.
Each post should highlight a different insight, tip, or angle that advances the approved campaign brief and strategy.
For LinkedIn, make the copy professional, B2B, insight-led, ROI-oriented, and specific to the actual target audience.
scheduled_offset_days: integer 0..${Math.max(0, opts.campaignDays - 1)}.
image_prompt: brief description of the ideal accompanying image that matches the approved topic/business; do not default to clinical or dental imagery unless the brief explicitly requires it. No text overlays.
Return JSON array only.`;

  const raw = await callAI(opts.apiKey, system, user);
  const parsed = extractJson(raw);
  return Array.isArray(parsed) ? parsed : parsed.posts ?? [];
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

// Email funnel from blog article
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
  const offsets = [0, Math.floor(days * 0.2), Math.floor(days * 0.4), Math.floor(days * 0.65), Math.max(0, days - 1)];

  const system = `You are an email copywriter creating a 5-email nurture funnel from an approved campaign brief.
Funnel arc: 1-Welcome/Teaser  2-Key Insight  3-FAQ/Objections  4-Social Proof  5-Offer/CTA
${hint}
The approved brief and strategic plan are authoritative. Ignore source article details that conflict with the brief. Do not drift into patient-facing dental treatment offers unless explicitly named in the brief.
Return ONLY a JSON array:
[ { "title": string, "text_content": string, "image_prompt": "", "scheduled_offset_days": number } ]`;

  const user = `APPROVED BRIEF:
${JSON.stringify(opts.brief, null, 2)}

Business: ${opts.practiceName}
Campaign: ${opts.campaignName}
Audience: ${opts.brief.targetAudience || opts.targetAudience}
Topic: ${opts.brief.campaignTopic || opts.contentTopic}
Campaign focus / offer: ${opts.campaignFocus}
Suggested send offsets (days): ${offsets.join(", ")}
${opts.landingPageUrl ? `CTA URL: ${opts.landingPageUrl}` : ""}

Strategic plan:
${opts.strategy.slice(0, 3500)}

Source blog article (supporting only):
${opts.blogArticle.slice(0, 4000)}

Generate exactly 5 emails using the funnel arc. Return JSON array only.`;

  const raw = await callAI(opts.apiKey, system, user);
  const parsed = extractJson(raw);
  const posts: GeneratedPost[] = Array.isArray(parsed) ? parsed : parsed.posts ?? [];
  return posts.slice(0, 5).map((p, i) => ({
    ...p,
    image_prompt: "",
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

    // Guard: if any existing post for this campaign already has an image, do not
    // auto-regenerate. Users can manually regenerate from the Edit Post dialog.
    // Pass { force: true } in the request body to override this safety check.
    if (!force) {
      const channelIds = channels.map((c: any) => c.id);
      const { data: existingWithImages } = await supabaseAdmin
        .from("channel_posts")
        .select("id")
        .in("campaign_channel_id", channelIds)
        .not("image_url", "is", null)
        .limit(1);
      if (existingWithImages && existingWithImages.length > 0) {
        console.log(`[generate-campaign-content] Skip: campaign ${campaignId} already has posts with images.`);
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

    const kbExcerpt = (kbDocs || [])
      .filter((d: any) => (d.metadata as any)?.file_kind !== "image")
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

    if (options.replaceDrafts && channels.length > 0) {
      const channelIds = channels.map((c: any) => c.id);
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
