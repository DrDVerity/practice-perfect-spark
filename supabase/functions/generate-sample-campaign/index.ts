/**
 * generate-sample-campaign  (public — no auth required)
 *
 * Powers the "Build a free campaign" flow on the marketing site.
 * Takes the visitor-entered { practiceName, email, websiteUrl, campaignFocus,
 * targetAudience } and generates 3 real, on-brief sample social posts that
 * actually reflect the entered business + focus (rather than a hardcoded
 * dental-whitening mock).
 *
 * Uses OpenRouter (LOVABLE_API_KEY-style OPENROUTER_API_KEY already in project
 * secrets). Optionally enriches with a quick Firecrawl scrape of the entered
 * website when FIRECRAWL_API_KEY is set; failure is non-fatal.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SamplePost {
  id: string;
  title: string;
  description: string;
  textCopy: string;
  platform: "instagram" | "facebook" | "linkedin" | "twitter";
  status: "draft";
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
    return typeof md === "string" ? md.slice(0, 3000) : null;
  } catch {
    return null;
  }
}

async function callOpenRouter(system: string, user: string): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenRouter ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "{}";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      practiceName = "",
      websiteUrl = "",
      campaignFocus = "",
      targetAudience = "",
    } = await req.json().catch(() => ({}));

    if (!practiceName?.trim() && !websiteUrl?.trim() && !campaignFocus?.trim()) {
      throw new Error("Provide at least a practice name, website, or focus.");
    }

    const websiteContext = websiteUrl ? await firecrawlSummary(websiteUrl) : null;

    const system = [
      "You are a senior marketing strategist producing sample social posts for a sales demo.",
      "The reader entered a business and a campaign focus — you MUST ground every post in those exact inputs.",
      "Never invent a different business, city, or service. Never default to teeth whitening / dental clinic content unless the entered inputs explicitly say so.",
      "If the entered business is a marketing agency / agent / service-for-businesses, the audience is business OWNERS (ROI, growth, efficiency) — NOT end consumers.",
      "Return STRICT JSON only, no prose. Shape:",
      `{"posts":[{"title":"...","description":"...","textCopy":"...","platform":"instagram|facebook|linkedin"}]}`,
      "Produce exactly 3 posts across DIFFERENT platforms (instagram, facebook, linkedin).",
      "textCopy: 40-90 words, on-platform tone, include 2-4 relevant hashtags, no emoji spam.",
    ].join("\n");

    const user = [
      `Business / practice name: ${practiceName || "(not provided)"}`,
      `Website: ${websiteUrl || "(not provided)"}`,
      `Campaign focus (authoritative): ${campaignFocus || "(not provided — infer from website context, do NOT default to dental treatments)"}`,
      `Target audience (authoritative): ${targetAudience || "(not provided — infer from business + focus)"}`,
      websiteContext ? `\n---\nWebsite content excerpt (for grounding only, do not copy verbatim):\n${websiteContext}` : "",
      "\nProduce the 3 sample posts now, strictly on the focus above.",
    ].join("\n");

    const raw = await callOpenRouter(system, user);
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const rawPosts: any[] = Array.isArray(parsed.posts) ? parsed.posts : [];

    const platforms: Array<SamplePost["platform"]> = ["instagram", "facebook", "linkedin"];
    const posts: SamplePost[] = rawPosts.slice(0, 3).map((p, i) => ({
      id: `sample-${i + 1}`,
      title: String(p.title || `Sample post ${i + 1}`).slice(0, 120),
      description: String(p.description || "").slice(0, 240),
      textCopy: String(p.textCopy || "").slice(0, 1200),
      platform: (platforms.includes(p.platform) ? p.platform : platforms[i]) as SamplePost["platform"],
      status: "draft",
    }));

    if (posts.length === 0) {
      throw new Error("Model returned no posts — please try again.");
    }

    return new Response(JSON.stringify({ success: true, posts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
