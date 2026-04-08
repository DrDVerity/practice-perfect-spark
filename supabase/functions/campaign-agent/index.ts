import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, campaignName, systemPrompt, practiceReport, channels, addons, budgetAllocations, budgetTotal } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const systemMessage = [
      systemPrompt || "You are an expert healthcare/dental marketing campaign assistant. Help the user create, refine, and optimize their marketing campaigns.",
      `The current campaign is called "${campaignName}".`,
      practiceReport ? `Here is the practice intelligence report for context:\n\n${practiceReport.slice(0, 8000)}` : "",
      channelsList,
      addonsList,
      budgetInfo,
      `When generating a campaign strategy, you MUST include ALL of the following sections:
1. **Executive Summary** - campaign goals and objectives
2. **Target Audience Analysis** - who we're targeting and why
3. **Channel Strategy** - specific plan for EACH channel listed above
4. **Add-On / Vector Strategies** - specific plans for each add-on with dedicated ad content
5. **Budget Allocation Table** - a markdown table showing each channel and vector with dollar amount and percentage allocation
6. **Ad Content & Creative Direction** - specific ad copy, headlines, and creative concepts for EACH channel and vector
7. **Content Calendar & Schedule of Events** - a detailed timeline with specific dates/weeks for each deliverable
8. **Key Performance Indicators** - metrics to track success per channel/vector

For each channel and vector, provide:
- Specific ad content (headlines, body copy, CTAs)
- Budget allocation for that specific vector
- Scheduling recommendations
- Expected outcomes and KPIs

Make the strategy actionable and specific to a healthcare/dental practice.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
