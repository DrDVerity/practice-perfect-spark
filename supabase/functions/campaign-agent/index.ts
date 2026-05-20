import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { findCachedKBDoc, upsertKBDoc } from "../_shared/kb-cache.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------- Helpers ----------

async function aiJson(prompt: string, system: string): Promise<any> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    console.error("aiJson error", resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return null;
  }
}

async function firecrawlSearch(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!resp.ok) {
      console.error("Firecrawl error", resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    const results = data?.data?.web || data?.data || [];
    return (Array.isArray(results) ? results : []).slice(0, 5).map((r: any) => ({
      url: r.url || r.link || "",
      title: r.title || "",
      snippet: r.description || r.snippet || r.markdown?.slice(0, 400) || "",
    })).filter((r: any) => r.url);
  } catch (e) {
    console.error("Firecrawl exception", e);
    return [];
  }
}

// Identify research gaps and execute searches. Returns markdown context block + sources list.
async function performGapResearch(
  campaignName: string,
  practiceReport: string,
  kbTitles: string[],
  channels: any[],
  addons: string[],
  userMessage: string,
): Promise<{ contextBlock: string; sources: { url: string; title: string }[]; queries: string[]; rawFindings: string }> {
  const gapPrompt = `You are planning research for a healthcare/dental marketing campaign.

CAMPAIGN: ${campaignName}
USER REQUEST: ${userMessage.slice(0, 1500)}

EXISTING KNOWLEDGE BASE DOCUMENTS (titles only):
${kbTitles.length ? kbTitles.map((t) => `- ${t}`).join("\n") : "(none)"}

CHANNELS: ${channels.map((c: any) => `${c.platform} (${c.channel_type})`).join(", ") || "none"}
ADD-ONS / VECTORS: ${addons.join(", ") || "none"}

PRACTICE CONTEXT (excerpt):
${(practiceReport || "").slice(0, 2000)}

TASK: Identify the top 1-4 SPECIFIC research questions where the existing KB likely has gaps for this campaign's target audience, niche angles, or channel best-practices. Do NOT re-research broad topics already covered by KB titles. Focus on the *intersection* of KB gaps and this campaign's unique angle (e.g., demographic + life situation, service + persona, channel + audience).

Respond with JSON: { "queries": ["specific search query 1", "specific search query 2", ...] }
If KB clearly covers everything needed, return { "queries": [] }.`;

  const gap = await aiJson(gapPrompt, "You are a precise marketing research planner. Output valid JSON only.");
  const queries: string[] = Array.isArray(gap?.queries) ? gap.queries.slice(0, 4) : [];
  if (queries.length === 0) {
    return { contextBlock: "", sources: [], queries: [], rawFindings: "" };
  }

  const allFindings: string[] = [];
  const allSources: { url: string; title: string }[] = [];
  for (const q of queries) {
    const results = await firecrawlSearch(q);
    if (results.length === 0) continue;
    allFindings.push(`### Research: ${q}\n` + results.map((r) => `- **${r.title}** — ${r.snippet}\n  Source: ${r.url}`).join("\n"));
    for (const r of results) allSources.push({ url: r.url, title: r.title });
  }

  if (allFindings.length === 0) {
    return { contextBlock: "", sources: [], queries, rawFindings: "" };
  }

  const rawFindings = allFindings.join("\n\n");
  const contextBlock = `\n\n=== LIVE RESEARCH (use to fill KB gaps; cite as [Source: <url>]) ===\n${rawFindings}\n=== END LIVE RESEARCH ===\n`;
  return { contextBlock, sources: allSources, queries, rawFindings };
}

// Save research findings back to the campaign owner's KB (stable title + upsert).
async function saveResearchToKB(
  ownerUserId: string,
  campaignName: string,
  queries: string[],
  rawFindings: string,
  campaignId: string | undefined,
  campaignFocus: string | undefined,
  targetAudience: string | undefined,
) {
  try {
    const title = `Campaign Research: ${campaignName}`;
    const content = `# ${title}\n\n**Research questions investigated:**\n${queries.map((q) => `- ${q}`).join("\n")}\n\n## Findings\n\n${rawFindings}`;

    // Resolve location_id from campaign if provided (account/scope auto-resolved by helper).
    let locationId: string | null = null;
    if (campaignId) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: camp } = await admin
        .from("campaigns").select("location_id").eq("id", campaignId).maybeSingle();
      locationId = (camp as any)?.location_id || null;
    }

    await upsertKBDoc({
      userId: ownerUserId,
      docType: "custom",
      title,
      content,
      locationId,
      scope: "location",
      matchKey: {
        campaign: campaignName,
        campaign_focus: campaignFocus,
        target_audience: targetAudience,
      },
      extraMetadata: {
        source: "campaign-agent-research",
        campaign: campaignName,
        queries,
        campaign_focus: campaignFocus,
        target_audience: targetAudience,
      },
    });
  } catch (e) {
    console.error("saveResearchToKB error", e);
  }
}


// ---------- Main handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, campaignName, campaignId, systemPrompt, practiceReport, channels, addons, budgetAllocations, budgetTotal, budgetMode, campaignFocus, targetAudience, force } = await req.json();
    const isOrganic = budgetMode === 'organic' || !budgetTotal || Number(budgetTotal) <= 0;
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === "user")?.content || "";
    const isStrategyRequest = /strategy|generate|plan|campaign report|comprehensive/i.test(lastUserMsg) && lastUserMsg.length > 80;

    // Look up campaign owner + their KB titles for gap analysis
    let ownerUserId: string | null = null;
    let kbTitles: string[] = [];
    if (campaignId) {
      try {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: camp } = await admin.from("campaigns").select("user_id").eq("id", campaignId).maybeSingle();
        if (camp?.user_id) {
          ownerUserId = camp.user_id;
          const { data: kb } = await admin.from("knowledge_base").select("title").eq("user_id", ownerUserId);
          kbTitles = (kb || []).map((d: any) => d.title);
        }
      } catch (e) {
        console.error("owner/kb lookup error", e);
      }
    }

    // Run gap research only for full strategy generation requests.
    // Reuse the existing campaign-research KB doc if it's <30 days old AND
    // the campaign focus + target audience haven't changed.
    let researchBlock = "";
    let sourcesList: { url: string; title: string }[] = [];
    if (isStrategyRequest) {
      let cachedResearch: any = null;
      if (!force && ownerUserId) {
        cachedResearch = await findCachedKBDoc({
          userId: ownerUserId,
          docType: "custom",
          title: `Campaign Research: ${campaignName}`,
          matchKey: {
            campaign: campaignName,
            campaign_focus: campaignFocus,
            target_audience: targetAudience,
          },
          maxAgeDays: 30,
        });
      }

      if (cachedResearch) {
        console.log(`Reusing cached campaign research from ${cachedResearch.updated_at}`);
        researchBlock = `\n\n=== CAMPAIGN RESEARCH (cached, ${cachedResearch.updated_at}) ===\n${cachedResearch.content}\n=== END ===\n`;
      } else {
        const research = await performGapResearch(
          campaignName,
          practiceReport || "",
          kbTitles,
          channels || [],
          addons || [],
          lastUserMsg,
        );
        researchBlock = research.contextBlock;
        sourcesList = research.sources;
        if (ownerUserId && research.rawFindings && research.queries.length) {
          // Fire-and-forget KB save (upsert in place — no duplicates)
          saveResearchToKB(ownerUserId, campaignName, research.queries, research.rawFindings, campaignId, campaignFocus, targetAudience).catch(() => {});
        }
      }
    }


    const channelsList = channels?.length > 0
      ? `\n\nChannels in this campaign:\n${channels.map((c: any) => `- ${c.platform} (${c.channel_type})`).join("\n")}`
      : "";
    const addonsList = addons?.length > 0
      ? `\n\nCampaign add-ons / vectors:\n${addons.map((a: string) => `- ${a}`).join("\n")}`
      : "";
    const budgetInfo = budgetTotal && budgetTotal > 0
      ? `\n\nTotal campaign budget: $${budgetTotal.toLocaleString()}${
          budgetAllocations && Object.keys(budgetAllocations).length > 0
            ? "\nBudget allocations:\n" + Object.entries(budgetAllocations).map(([key, val]: [string, any]) =>
                `- ${key}: $${val.amount || 0} (${val.percent || 0}%)`
              ).join("\n")
            : ""
        }`
      : "";

    const sourcesInstruction = sourcesList.length > 0
      ? `\n\nIMPORTANT: At the end of the strategy report, include a "## Sources" section listing every URL referenced inline as [Source: url]. Cite live research sources where you used their insights. Available sources:\n${sourcesList.map((s) => `- ${s.title || s.url}: ${s.url}`).join("\n")}`
      : "";

    const systemMessage = [
      systemPrompt || "You are an expert healthcare/dental marketing campaign assistant. Help the user create, refine, and optimize their marketing campaigns.",
      `The current campaign is called "${campaignName}".`,
      practiceReport ? `Here is the practice intelligence report for context:\n\n${practiceReport.slice(0, 8000)}` : "",
      kbTitles.length ? `\nClient Knowledge Base documents available (already factored into your context):\n${kbTitles.map((t) => `- ${t}`).join("\n")}` : "",
      researchBlock,
      channelsList,
      addonsList,
      budgetInfo,
      isOrganic
        ? `BUDGET MODE: ORGANIC ONLY (NO PAID ADS). The user has specified $0 spend. When generating the strategy you MUST:
- Build a 100% organic social-media plan. Do NOT include paid ads, boosted posts, Google Ads, or any paid placements.
- Do NOT include a Budget Allocation Table. Replace it with a section titled "## Budget — Organic Only ($0 Spend)" stating no paid spend is allocated.
- Focus on organic content cadence, hashtags, community engagement, partnerships, UGC, and SEO.

Required sections:
1. **Executive Summary**
2. **Target Audience Analysis**
3. **Channel Strategy** — organic plan per channel
4. **Add-On / Vector Strategies** — organic only
5. **Budget — Organic Only ($0 Spend)**
6. **Organic Content & Creative Direction** — post copy, headlines, CTAs per channel
7. **Content Calendar & Schedule of Events** — weekly timeline
8. **Key Performance Indicators** — organic metrics (reach, engagement, follows)
${sourcesInstruction}`
        : `BUDGET MODE: PAID + ORGANIC. Total budget: $${Number(budgetTotal).toLocaleString()}. Calculate the optimal allocation across channels and vectors for the BEST RETURN ON INVESTMENT for a healthcare/dental practice. Justify allocations briefly.

When generating a campaign strategy, you MUST include ALL of the following sections:
1. **Executive Summary** - campaign goals and objectives
2. **Target Audience Analysis** - who we're targeting and why
3. **Channel Strategy** - specific plan for EACH channel listed above
4. **Add-On / Vector Strategies** - specific plans for each add-on with dedicated ad content
5. **Budget Allocation Table** - a markdown table showing each channel and vector with dollar amount and percentage allocation, plus a one-line ROI rationale per row
6. **Ad Content & Creative Direction** - specific ad copy, headlines, and creative concepts for EACH channel and vector
7. **Content Calendar & Schedule of Events** - detailed weekly timeline
8. **Key Performance Indicators** - metrics per channel/vector

For each channel and vector, provide specific ad content (headlines, body copy, CTAs), budget allocation, scheduling, and expected outcomes. Make the strategy actionable and specific to a healthcare/dental practice.${sourcesInstruction}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemMessage }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("campaign-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
