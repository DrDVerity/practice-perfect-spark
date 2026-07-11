/**
 * get-started-generate  (public — no auth)
 *
 * Orchestrator for the /get-started prospect flow. Given the visitor's basic
 * info + campaign brief:
 *   1. Upserts a row in public.prospect_accounts (keyed by email).
 *   2. Kicks a background job that:
 *      - Scrapes the practice website with Firecrawl.
 *      - Generates 4 grounding reports (practice, competitive, audience, brand)
 *        into public.prospect_reports.
 *      - Generates a 1000-1500 word blog article, hero image URL placeholder,
 *        3 Facebook post variations, and a 6-email nurture funnel into
 *        public.prospect_campaigns.
 *   3. Updates status to 'ready' (or 'failed').
 *
 * The client polls get-started-status and then loads get-started-fetch to
 * render the preview.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeUrl(input: string): string {
  const v = (input || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return `https://www.${v}`;
}

async function firecrawlSummary(url: string): Promise<string | null> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key || !url) return null;
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const md = data?.data?.markdown || "";
    return typeof md === "string" ? md.slice(0, 6000) : null;
  } catch {
    return null;
  }
}

async function callOpenRouter(system: string, user: string, jsonMode = true, maxTokens = 2400): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
  const body: Record<string, unknown> = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenRouter ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function generateImage(prompt: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return null;
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: `Photorealistic, high-quality marketing image. No text overlays. ${prompt}` }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) { console.warn("image gen http", resp.status); return null; }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch (e) { console.warn("image gen error", e); return null; }
}

async function uploadImage(admin: any, prospectId: string, name: string, dataUrl: string): Promise<string | null> {
  try {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return dataUrl.startsWith("http") ? dataUrl : null;
    const mime = m[1];
    const ext = mime.split("/")[1]?.split("+")[0] || "png";
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const path = `prospects/${prospectId}/${name}-${Date.now()}.${ext}`;
    const { error } = await admin.storage.from("post-media").upload(path, bytes, {
      contentType: mime, cacheControl: "3600", upsert: true,
    });
    if (error) { console.warn("upload err", error); return null; }
    const { data } = admin.storage.from("post-media").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) { console.warn("upload exception", e); return null; }
}

async function genAndUpload(admin: any, prospectId: string, name: string, prompt: string): Promise<string | null> {
  const raw = await generateImage(prompt);
  if (!raw) return null;
  return await uploadImage(admin, prospectId, name, raw);
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

interface Ctx {
  practiceName: string;
  websiteUrl: string;
  campaignFocus: string;
  targetAudience: string;
  scrape: string;
}

function baseContext(c: Ctx): string {
  return `Practice: ${c.practiceName}
Website: ${c.websiteUrl}
Campaign focus: ${c.campaignFocus}
Target audience: ${c.targetAudience}

Website content excerpt (markdown, may be empty):
${c.scrape || "(no scrape available)"}`;
}

async function generateReport(admin: any, prospectId: string, docType: string, title: string, prompt: string, ctx: Ctx) {
  const system = `You are a senior dental-industry marketing analyst. Produce concise, well-structured markdown for the report "${title}". Ground every claim in the provided practice context. Avoid generic filler.`;
  const user = `${baseContext(ctx)}

Task: ${prompt}

Return JSON with shape { "content": "<markdown report>", "summary": "<one-sentence summary>" }.`;
  const raw = await callOpenRouter(system, user, true, 2200);
  const parsed = safeJson<{ content?: string; summary?: string }>(raw, {});
  const content = parsed.content || raw;
  await admin.from("prospect_reports").upsert({
    prospect_id: prospectId,
    doc_type: docType,
    title,
    content,
    metadata: { summary: parsed.summary || null },
  }, { onConflict: "prospect_id,doc_type" });
}

async function generateCampaignContent(admin: any, prospectId: string, ctx: Ctx) {
  // Blog article
  const blogSystem = `You are an expert dental content writer. Write a 1000-1500 word blog article in a friendly, professional tone. Return valid JSON.`;
  const blogUser = `${baseContext(ctx)}

Write a blog article aligned with the campaign focus and audience. Include an H1 title, 3-5 H2 sections, and 3 places where illustrations should appear (mark each with an inline "[ILLUSTRATION: <short description>] " placeholder INSIDE the html, on its own line between paragraphs). The illustration descriptions must be concrete and visual (a scene, subject, mood) — not generic ("relevant image").

Also produce a distinct "heroPrompt" describing a photorealistic hero image that visually represents the MAIN thrust of the article (evocative scene, no text overlays, no clinical/dental stock unless the topic truly demands it).

Return JSON: { "title": string, "html": "<article HTML with h1/h2/p tags and [ILLUSTRATION:...] placeholders>", "heroPrompt": string, "illustrations": [{ "caption": string, "prompt": string }] } — illustrations array MUST have exactly 3 items whose captions match the placeholders in order.`;
  const blogRaw = await callOpenRouter(blogSystem, blogUser, true, 4000);
  const blog = safeJson<{ title?: string; html?: string; heroPrompt?: string; illustrations?: Array<{ caption: string; prompt: string }> }>(blogRaw, {});

  // 3 Facebook post variations — MUST include exactly one carousel and, when the
  // topic supports it, one interactive (quiz/puzzle/game). Otherwise the third
  // slot is a standard image post.
  const postsSystem = `You are a social media copywriter for dental practices. Return valid JSON only.`;
  const postsUser = `${baseContext(ctx)}

Blog title: ${blog.title || "(untitled)"}

Create exactly 3 DISTINCT Facebook post variations derived from the blog. Formats are REQUIRED:
  1. format = "image"      — a single-image post.
  2. format = "carousel"   — a 4-slide swipeable carousel. Provide "slides" (exactly 4) with { "heading": string (<=40 chars), "body": string (<=140 chars), "imagePrompt": string }.
  3. format = "interactive" — ONLY when the topic supports engagement (quiz, puzzle, or lightweight game). Provide "interactive": { "kind": "quiz"|"puzzle"|"game", "title": string, "intro": string, "questions": [ { "q": string, "choices": string[], "answerIndex": number, "explanation": string } ] (2-3 items, for quiz) OR "steps": string[] (for puzzle/game) }.
     If the topic doesn't lend itself to interactivity, use "image" instead.

Vary tone across posts (educational, promotional, story-driven, playful). Use 1-2 emojis where natural. Keep textCopy under 800 chars.

Return JSON:
{ "posts": [ { "variation": string, "format": "image"|"carousel"|"interactive", "textCopy": string, "imagePrompt": string, "slides": [...] | null, "interactive": {...} | null } ] }
The array MUST have exactly 3 items and MUST contain at least one with format = "carousel".`;
  const postsRaw = await callOpenRouter(postsSystem, postsUser, true, 2600);
  const postsParsed = safeJson<{ posts?: any[] }>(postsRaw, {});
  const posts = (postsParsed.posts || []).slice(0, 3);
  // Safety net: guarantee at least one carousel.
  if (posts.length && !posts.some((p: any) => p?.format === "carousel")) {
    const src = posts[0] || {};
    posts[0] = {
      ...src,
      format: "carousel",
      slides: [1, 2, 3, 4].map((n) => ({
        heading: `Highlight ${n}`,
        body: (src.textCopy || "").slice((n - 1) * 120, n * 120) || `Key point ${n} from the article.`,
        imagePrompt: src.imagePrompt || "professional practice photography, warm and inviting",
      })),
    };
  }

  // 6-email funnel
  const emailSystem = `You are a lead-nurture email copywriter. Return valid JSON only.`;
  const emailUser = `${baseContext(ctx)}

Blog title: ${blog.title || "(untitled)"}

Write a 6-email nurture funnel for prospects who signed up via this campaign. Email 1 = welcome, emails 2-6 = a nurture sequence spaced 2-4 days apart, ending with a strong booking CTA. Keep each email 120-220 words.

Return JSON: { "emails": [{ "day": number, "subject": string, "preview": string, "body": string }] } — exactly 6 items.`;
  const emailRaw = await callOpenRouter(emailSystem, emailUser, true, 3200);
  const emailParsed = safeJson<{ emails?: Array<{ day: number; subject: string; preview: string; body: string }> }>(emailRaw, {});
  const emails = (emailParsed.emails || []).slice(0, 6);

  // Placeholder hero URL — we don't burn credits on real image gen for prospects.
  const heroUrl = `https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80`;

  // Delete any prior row then insert fresh
  await admin.from("prospect_campaigns").delete().eq("prospect_id", prospectId);
  await admin.from("prospect_campaigns").insert({
    prospect_id: prospectId,
    blog_title: blog.title || null,
    blog_html: blog.html || null,
    hero_image_url: heroUrl,
    illustrations: blog.illustrations || [],
    posts,
    email_funnel: emails,
  });
}

async function runPipeline(admin: any, prospectId: string, ctx: Ctx) {
  await admin.from("prospect_accounts").update({ status: "scraping" }).eq("id", prospectId);
  const scrape = await firecrawlSummary(ctx.websiteUrl);
  ctx.scrape = scrape || "";

  await admin.from("prospect_accounts").update({ status: "generating_reports" }).eq("id", prospectId);
  await Promise.all([
    generateReport(admin, prospectId, "practice_analysis", "Practice Analysis",
      "Analyze the practice: services offered, positioning, apparent strengths and gaps, unique differentiators.", ctx),
    generateReport(admin, prospectId, "competitive_analysis", "Competitive Analysis",
      "Analyze the competitive landscape for a dental practice in this niche. Identify likely competitor types, positioning gaps, and where this practice can win.", ctx),
    generateReport(admin, prospectId, "audience_analysis", "Audience Psychographic & Pain Point Analysis",
      "Deep dive into the target audience's psychographics, pain points, key motivators, objections, and the language they use when searching for care.", ctx),
    generateReport(admin, prospectId, "brand_guidelines", "Brand Guidelines",
      "Draft brand guidelines: voice/tone, key messaging pillars, do's and don'ts, suggested color/typography direction inferred from the website content.", ctx),
  ]);

  await admin.from("prospect_accounts").update({ status: "generating_content" }).eq("id", prospectId);
  await generateCampaignContent(admin, prospectId, ctx);

  await admin.from("prospect_accounts").update({ status: "ready", error: null }).eq("id", prospectId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    if (!email) throw new Error("email required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const ctx: Ctx = {
      practiceName: (body.practiceName || "").trim(),
      websiteUrl: normalizeUrl(body.websiteUrl || ""),
      campaignFocus: (body.campaignFocus || "").trim(),
      targetAudience: Array.isArray(body.targetAudience)
        ? body.targetAudience.join(", ")
        : (body.targetAudience || "").trim(),
      scrape: "",
    };

    const { data: existing } = await admin.from("prospect_accounts")
      .select("id").eq("email", email).maybeSingle();

    let prospectId: string;
    if (existing?.id) {
      prospectId = existing.id;
      await admin.from("prospect_accounts").update({
        practice_name: ctx.practiceName,
        website_url: ctx.websiteUrl,
        campaign_focus: ctx.campaignFocus,
        target_audience: ctx.targetAudience,
        status: "pending",
        error: null,
      }).eq("id", prospectId);
    } else {
      const { data: inserted, error } = await admin.from("prospect_accounts").insert({
        email,
        practice_name: ctx.practiceName,
        website_url: ctx.websiteUrl,
        campaign_focus: ctx.campaignFocus,
        target_audience: ctx.targetAudience,
        status: "pending",
      }).select("id").single();
      if (error) throw error;
      prospectId = inserted.id;
    }

    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      try {
        await runPipeline(admin, prospectId, ctx);
      } catch (e: any) {
        console.error("[get-started-generate] pipeline error", e);
        await admin.from("prospect_accounts").update({
          status: "failed",
          error: String(e?.message || e).slice(0, 500),
        }).eq("id", prospectId);
      }
    })());

    return new Response(JSON.stringify({ prospectId, status: "pending" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
