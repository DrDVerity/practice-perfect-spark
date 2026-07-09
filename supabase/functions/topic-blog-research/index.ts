import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function firecrawlSearch(query: string, limit = 5): Promise<{ url: string; title: string; snippet: string }[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const results = data?.data?.web || data?.data || [];
    return (Array.isArray(results) ? results : []).slice(0, limit).map((r: any) => ({
      url: r.url || r.link || "",
      title: r.title || "",
      snippet: r.description || r.snippet || (r.markdown || "").slice(0, 400),
    })).filter((r: any) => r.url);
  } catch (e) {
    console.error("firecrawl error", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");
    const { campaignId, focus } = await req.json();
    if (!campaignId || !focus) throw new Error("campaignId and focus required");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: camp } = await admin
      .from("campaigns")
      .select("user_id, name, focus, target_audience, strategy, psychological_approach, target_market_refined")
      .eq("id", campaignId)
      .maybeSingle();
    const ownerId = camp?.user_id;
    if (!ownerId) throw new Error("Campaign owner not found");

    const { data: profile } = await admin
      .from("profiles")
      .select("practice_name, target_audience, website_url, campaign_focus, brand_voice")
      .eq("user_id", ownerId)
      .maybeSingle();

    const campaignFocus = camp?.focus || focus || camp?.name || profile?.campaign_focus || "";
    const targetAudience = camp?.target_audience || profile?.target_audience || "the campaign's target audience";
    const profileName = profile?.practice_name || "the business";
    const genericProfileName = /^(administrator|admin|test|demo|client|account|administrator account)$/i.test(String(profileName).trim());

    const campaignTokens = [
      camp?.name,
      campaignFocus,
      targetAudience,
      profile?.practice_name,
      profile?.campaign_focus,
    ]
      .filter(Boolean)
      .flatMap((s: string) => String(s).toLowerCase().split(/[^a-z0-9]+/))
      .filter((w) => w.length >= 4 && ![
        "practice", "dental", "campaign", "marketing", "business", "account",
        "target", "audience", "owner", "owners", "patients", "services",
      ].includes(w));
    const campaignTokenSet = new Set(campaignTokens);
    const isOtherPracticeReport = (doc: any): boolean => {
      const title = String(doc?.title || "").toLowerCase();
      const metadata = doc?.metadata || {};
      const sourceCampaignId = metadata?.campaign_id || metadata?.campaignId;
      if (sourceCampaignId && sourceCampaignId !== campaignId) return true;
      const looksLikeReport = /practice intelligence report|competitive landscape|reputation.*sentiment|sentiment analysis|campaign research|blog:/i.test(title);
      if (!looksLikeReport) return false;
      for (const tok of campaignTokenSet) if (title.includes(tok)) return false;
      return true;
    };

    // Client KB matching focus
    const { data: clientKb } = await admin
      .from("knowledge_base")
      .select("title, content, metadata")
      .eq("user_id", ownerId)
      .ilike("content", `%${focus.split(" ")[0]}%`)
      .limit(8);

    // Agency KB: admins
    const { data: adminRoles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);
    let agencyKb: any[] = [];
    if (adminIds.length > 0) {
      const { data } = await admin
        .from("knowledge_base")
        .select("title, content, metadata")
        .in("user_id", adminIds)
        .ilike("content", `%${focus.split(" ")[0]}%`)
        .limit(6);
      agencyKb = data || [];
    }

    // Past campaigns with matching focus
    const { data: pastCampaigns } = await admin
      .from("campaigns")
      .select("name, strategy, focus")
      .ilike("focus", `%${focus.split(" ")[0]}%`)
      .neq("id", campaignId)
      .limit(5);

    // Online research
    const forumSearch = await firecrawlSearch(`${focus} reddit OR forum patient experience opinion`, 5);
    const sentimentSearch = await firecrawlSearch(`${focus} reviews social media sentiment`, 5);

    const clientKbBlock = (clientKb || [])
      .filter((d: any) => !isOtherPracticeReport(d))
      .map((d: any) => `### Client KB: ${d.title}\n${(d.content || "").slice(0, 1000)}`)
      .join("\n\n");
    const agencyKbBlock = agencyKb
      .filter((d: any) => !isOtherPracticeReport(d))
      .map((d: any) => `### Agency KB: ${d.title}\n${(d.content || "").slice(0, 1000)}`)
      .join("\n\n");
    const pastCampaignsBlock = (pastCampaigns || [])
      .map((c: any) => `### Past Campaign: ${c.name}\n${(c.strategy || "").slice(0, 800)}`)
      .join("\n\n");
    const forumsBlock = [...forumSearch, ...sentimentSearch]
      .map((r) => `- **${r.title}** — ${r.snippet}\n  Source: ${r.url}`)
      .join("\n");

    const userPrompt = `AUTHORITATIVE CAMPAIGN INPUTS:
- Campaign name: ${camp?.name || "(none)"}
- Topic / focus: ${campaignFocus}
- Target audience: ${targetAudience}
- Psychological approach: ${camp?.psychological_approach || "(none)"}
- Refined target market: ${camp?.target_market_refined || "(none)"}

PUBLISHING BUSINESS IDENTITY:
- Profile/business name: ${genericProfileName ? `${profileName} (generic account label; do not treat as the promoted business name)` : profileName}
- Website: ${profile?.website_url || "(unknown)"}
- Business positioning / core offer from profile: ${profile?.campaign_focus || "(none)"}
- Brand voice: ${profile?.brand_voice || "(none)"}

STRATEGIC PLAN (AUTHORITATIVE IF PRESENT):
${camp?.strategy || "(none)"}

CLIENT KNOWLEDGE BASE:
${clientKbBlock || "(no matching docs)"}

AGENCY KNOWLEDGE BASE:
${agencyKbBlock || "(no matching docs)"}

RELATED PAST CAMPAIGNS:
${pastCampaignsBlock || "(none)"}

ONLINE FORUMS / SENTIMENT:
${forumsBlock || "(no live results)"}

Write a highly informative, helpful, and engaging blog article about "${campaignFocus}" aimed at the campaign target audience. Requirements:
- The campaign inputs and strategic plan outrank all KB and online research.
- Write from the actual publishing business to the stated target audience.
- Do not adopt unrelated practice names, cities, doctors, patient audiences, treatments, or seasonal offers from KB/background material.
- If this is about Archer Marketing / an AI marketing agent / fractional marketing / best hiring decision / ROI / cost efficiency for dental practices, the reader is the practice owner/operator, not a patient.
- Humanize the writing — conversational, warm, no robotic phrasing, no "In today's world" cliches.
- 800-1200 words.
- Use markdown with H2/H3 headings, short paragraphs, and at least one bulleted list.
- Open with a hook drawn from the forum sentiment.
- Address common questions/concerns surfaced in the research.
- End with a soft, practice-relevant call to action (no hard sell).
- Do NOT include a "Sources" section in the body.

Output ONLY the article markdown.`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are a senior B2B/B2C content strategist. Follow the campaign inputs exactly. Never turn a business-growth or marketing-agent campaign into a patient-facing dental treatment article unless the campaign explicitly names that treatment." },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      throw new Error(`AI gateway: ${resp.status}`);
    }

    const data = await resp.json();
    const article = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ article, focus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("topic-blog-research error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
