import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  docType: string;
  prompt: string;
  practiceInfo?: {
    practiceName?: string;
    campaignFocus?: string;
    targetAudience?: string;
    websiteUrl?: string;
  };
}

const DOC_TYPE_SYSTEM_PROMPTS: Record<string, string> = {
  demographics: `You are a demographics research analyst specializing in healthcare and dental marketing.
Generate a comprehensive Demographics Report based on the user's inputs.
Cover: age ranges, income levels, geographic distribution, education, family status, insurance coverage, 
digital behavior patterns, media consumption, and healthcare decision-making factors.
Be specific with data points, percentages, and actionable segmentation recommendations.`,

  audience_analysis: `You are a target audience analyst specializing in healthcare marketing.
Generate a detailed Target Audience Analysis covering: audience personas, psychographics, 
content preferences, engagement patterns, pain points, decision triggers, 
communication channel preferences, and recommended messaging approaches.`,

  market_analysis: `You are a market research analyst for the healthcare/dental industry.
Generate a comprehensive Market Analysis Report covering: market size and segmentation, 
growth trends, competitive landscape overview, key opportunities, threats, 
pricing dynamics, and strategic recommendations.`,

  competitive_landscape: `You are a competitive intelligence analyst in healthcare marketing.
Generate a detailed Competitive Landscape Report covering: key competitors, their strategies, 
strengths/weaknesses, market positioning, content strategies, pricing, 
differentiation opportunities, and recommended competitive responses.`,

  brand_guidelines: `You are a brand strategist specializing in healthcare brands.
Generate comprehensive Brand Guidelines covering: brand voice and tone, 
visual identity recommendations, messaging framework, content pillars, 
do's and don'ts, patient communication guidelines, and social media brand standards.`,

  platform_rules: `You are a social media marketing expert.
Generate detailed Platform Posting Rules and Best Practices. Cover: optimal post formats, 
character limits, image/video specs, best posting times, hashtag strategies, 
engagement tactics, algorithm tips, and compliance considerations for healthcare content.`,

  custom: `You are a marketing research and strategy expert specializing in healthcare and dental practices.
Generate a detailed, actionable report based on the user's specific request.
Be thorough, data-driven, and provide concrete recommendations.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { docType, prompt, practiceInfo } = await req.json() as RequestBody;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const systemPrompt = DOC_TYPE_SYSTEM_PROMPTS[docType] || DOC_TYPE_SYSTEM_PROMPTS.custom;

    let contextBlock = "";
    if (practiceInfo) {
      const parts = [];
      if (practiceInfo.practiceName) parts.push(`Practice: ${practiceInfo.practiceName}`);
      if (practiceInfo.campaignFocus) parts.push(`Campaign Focus: ${practiceInfo.campaignFocus}`);
      if (practiceInfo.targetAudience) parts.push(`Target Audience: ${practiceInfo.targetAudience}`);
      if (practiceInfo.websiteUrl) parts.push(`Website: ${practiceInfo.websiteUrl}`);
      if (parts.length > 0) {
        contextBlock = `\n\nContext about the practice:\n${parts.join("\n")}`;
      }
    }

    const userPrompt = `${prompt}${contextBlock}\n\nProvide a comprehensive, well-structured report with clear sections, bullet points, and actionable insights. Format with markdown headers and lists for readability.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to generate document");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Failed to generate content";

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating KB document:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
