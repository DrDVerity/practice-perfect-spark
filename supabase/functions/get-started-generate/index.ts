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

Write a blog article aligned with the campaign focus and audience. Include an H1 title, 3-5 H2 sections, and 2-3 places where illustrations should appear (mark each with an inline "[ILLUSTRATION: <short description>]" placeholder).

Return JSON: { "title": string, "html": "<article HTML with h1/h2/p tags and [ILLUSTRATION:...] placeholders>", "illustrations": [{ "caption": string, "prompt": string }] }`;
  const blogRaw = await callOpenRouter(blogSystem, blogUser, true, 4000);
  const blog = safeJson<{ title?: string; html?: string; illustrations?: Array<{ caption: string; prompt: string }> }>(blogRaw, {});

  // 3 Facebook post variations
  const postsSystem = `You are a social media copywriter for dental practices. Return valid JSON only.`;
  const postsUser = `${baseContext(ctx)}

Blog title: ${blog.title || "(untitled)"}

Create 3 DISTINCT Facebook post variations derived from the blog. Each should feel different in tone (educational, promotional, story-driven). Include an emoji or two where natural. Keep each under 800 characters.

Return JSON: { "posts": [{ "variation": "Educational" | "Promotional" | "Story", "textCopy": string, "imagePrompt": string }] } — exactly 3 items.`;
  const postsRaw = await callOpenRouter(postsSystem, postsUser, true, 1600);
  const postsParsed = safeJson<{ posts?: Array<{ variation: string; textCopy: string; imagePrompt: string }> }>(postsRaw, {});
  const posts = (postsParsed.posts || []).slice(0, 3);

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
