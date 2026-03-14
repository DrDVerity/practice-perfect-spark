import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  practiceName: string;
  websiteUrl: string;
  userId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { practiceName, websiteUrl, userId } = await req.json() as RequestBody;

    if (!practiceName || !websiteUrl || !userId) {
      return new Response(
        JSON.stringify({ error: "Practice name, website URL, and user ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Starting practice report for: ${practiceName} (${websiteUrl})`);

    // Step 1: Scrape the practice website
    let websiteContent = "";
    try {
      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
          formats: ["markdown"],
          onlyMainContent: false,
        }),
      });
      const scrapeData = await scrapeRes.json();
      websiteContent = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      console.log(`Website scraped: ${websiteContent.length} chars`);
    } catch (e) {
      console.error("Website scrape failed:", e);
      websiteContent = `[Could not scrape website: ${websiteUrl}]`;
    }

    // Step 2: Search for Google reviews
    let reviewsContent = "";
    try {
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `${practiceName} reviews`,
          limit: 5,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });
      const searchData = await searchRes.json();
      const results = searchData?.data || [];
      reviewsContent = results.map((r: any) =>
        `Source: ${r.url}\nTitle: ${r.title}\n${r.markdown || r.description || ""}`
      ).join("\n\n---\n\n");
      console.log(`Reviews gathered: ${reviewsContent.length} chars`);
    } catch (e) {
      console.error("Reviews search failed:", e);
      reviewsContent = "[Could not retrieve reviews]";
    }

    // Step 3: Search for competitors
    let competitorContent = "";
    try {
      // Extract location from website content or use practice name
      const competitorSearchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `dental practices near ${practiceName} competitors`,
          limit: 5,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });
      const competitorData = await competitorSearchRes.json();
      const competitorResults = competitorData?.data || [];
      competitorContent = competitorResults.map((r: any) =>
        `Source: ${r.url}\nTitle: ${r.title}\n${r.markdown || r.description || ""}`
      ).join("\n\n---\n\n");
      console.log(`Competitor data: ${competitorContent.length} chars`);
    } catch (e) {
      console.error("Competitor search failed:", e);
      competitorContent = "[Could not retrieve competitor data]";
    }

    // Truncate content to avoid token limits
    const truncate = (s: string, max: number) => s.length > max ? s.substring(0, max) + "\n[...truncated]" : s;
    const websiteTrunc = truncate(websiteContent, 12000);
    const reviewsTrunc = truncate(reviewsContent, 6000);
    const competitorTrunc = truncate(competitorContent, 6000);

    // Step 4: Generate comprehensive practice report via AI
    const systemPrompt = `You are an expert healthcare marketing analyst. You produce detailed, actionable practice intelligence reports. Be specific, reference actual data from the scraped content, and provide concrete recommendations. Use markdown formatting with clear headers and bullet points.`;

    const practiceReportPrompt = `Generate a comprehensive Practice Intelligence Report for "${practiceName}" based on the following scraped data:

## PRACTICE WEBSITE CONTENT:
${websiteTrunc}

## ONLINE REVIEWS & REPUTATION:
${reviewsTrunc}

## COMPETITOR LANDSCAPE:
${competitorTrunc}

Create a detailed report with the following sections:

# 1. Practice Overview
- Practice name, address, phone number (extracted from website)
- Services offered
- Mission statement / philosophy
- Key team members / doctors

# 2. Reputation & Sentiment Analysis
- Overall review sentiment (positive, negative, mixed)
- Common praise themes from patients
- Common complaints or concerns
- Star rating summary if available
- Patient experience highlights

# 3. Strengths & Distinguishing Characteristics
- What sets this practice apart
- Unique services or specialties
- Notable achievements or credentials
- Technology and equipment highlights

# 4. Competitive Landscape
- Key nearby competitors identified
- How the practice compares
- Market positioning relative to competitors
- Areas where competitors may have an advantage

# 5. Market Position & Share Analysis
- Target demographic assessment
- Geographic market analysis
- Service gap opportunities
- Growth potential areas

# 6. SWOT Analysis
- **Strengths**: Internal advantages
- **Weaknesses**: Internal areas for improvement
- **Opportunities**: External factors to leverage
- **Threats**: External challenges to address

# 7. Marketing Recommendations
- Top 5 immediate marketing actions
- Content strategy suggestions
- Social media focus areas
- Patient acquisition strategies
- Retention and referral opportunities
- Brand positioning recommendations

# 8. Key Metrics to Track
- Suggested KPIs for marketing campaigns
- Benchmarks for the dental industry`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: practiceReportPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("Failed to generate practice report");
    }

    const aiData = await aiResponse.json();
    const reportContent = aiData.choices?.[0]?.message?.content || "Failed to generate report";

    // Step 5: Save reports to Knowledge Base
    const now = new Date().toISOString();
    const reports = [
      {
        user_id: userId,
        title: `Practice Intelligence Report - ${practiceName}`,
        doc_type: "market_analysis",
        content: reportContent,
        metadata: { source_url: websiteUrl, generated_at: now, practice_name: practiceName },
      },
      {
        user_id: userId,
        title: `Reputation & Sentiment Analysis - ${practiceName}`,
        doc_type: "audience_analysis",
        content: reviewsTrunc.length > 50 ? reviewsTrunc : "[No review data available]",
        metadata: { source_url: websiteUrl, generated_at: now, practice_name: practiceName, type: "raw_reviews" },
      },
      {
        user_id: userId,
        title: `Competitive Landscape - ${practiceName}`,
        doc_type: "competitive_landscape",
        content: competitorTrunc.length > 50 ? competitorTrunc : "[No competitor data available]",
        metadata: { source_url: websiteUrl, generated_at: now, practice_name: practiceName, type: "raw_competitors" },
      },
    ];

    const { error: insertError } = await supabase
      .from("knowledge_base")
      .insert(reports);

    if (insertError) {
      console.error("KB insert error:", insertError);
      // Don't fail the whole request, report was still generated
    } else {
      console.log(`Saved ${reports.length} reports to KB`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: reportContent,
        savedToKB: !insertError,
        reportCount: reports.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating practice report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
