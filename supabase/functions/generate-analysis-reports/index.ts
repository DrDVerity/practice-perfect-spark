import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  campaignFocus: string;
  targetAudience: string;
  channel?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const _authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await _authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    {
      const _userId = (claimsData.claims as any).sub as string;
      const _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: _ok } = await _sb.rpc('check_and_consume_rate_limit', { _user_id: _userId, _endpoint: 'generate-analysis-reports', _max_per_minute: 4 });
      if (_ok === false) return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json() as RequestBody;
    const campaignFocus = typeof body.campaignFocus === 'string' ? body.campaignFocus.slice(0, 1000) : '';
    const targetAudience = typeof body.targetAudience === 'string' ? body.targetAudience.slice(0, 1000) : '';
    const channel = (typeof body.channel === 'string' ? body.channel.slice(0, 50) : '') || "social media";

    if (!campaignFocus || !targetAudience) {
      return new Response(
        JSON.stringify({ error: "Campaign focus and target audience are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a marketing research analyst specializing in healthcare and dental marketing. 
Generate comprehensive, actionable analysis reports for marketing campaigns. 
Be specific, data-driven, and provide concrete recommendations.
Format your response with clear sections and bullet points for readability.`;

    // Generate Target Audience Analysis
    const audiencePrompt = `Generate a detailed Target Audience Analysis report for a marketing campaign with the following details:

Campaign Focus/Post Idea: "${campaignFocus}"
Target Audience: "${targetAudience}"
Target Channel: ${channel}

Create a comprehensive report covering:
1. **Audience-Specific Preferences for ${channel}**
   - Content formats they prefer
   - Posting times and frequency expectations
   - Communication style preferences

2. **Content Types That Capture Attention**
   - Visual content preferences
   - Messaging that resonates
   - Call-to-action styles that work

3. **Engagement Patterns and Behaviors**
   - When they're most active
   - How they interact with content
   - Decision-making triggers

4. **Sentiment Analysis on the Topic**
   - General perception of the subject
   - Pain points and concerns
   - Emotional triggers

5. **Recommended Messaging Approaches**
   - Key messages to emphasize
   - Tone and voice guidelines
   - Phrases and language to use/avoid`;

    // Generate Market Analysis
    const marketPrompt = `Generate a detailed Market Analysis Report for a marketing campaign with the following details:

Campaign Focus/Post Idea: "${campaignFocus}"
Target Audience: "${targetAudience}"
Industry: Healthcare/Dental

Create a comprehensive report covering:
1. **Market Segmentation**
   - Primary market segments
   - Secondary opportunity segments
   - Niche segments to consider

2. **Growth Trends and Projections**
   - Current market trends
   - Expected growth areas
   - Emerging opportunities

3. **Key Interests and Requirements**
   - What the target market values most
   - Decision-making factors
   - Budget considerations

4. **Competitive Landscape Analysis**
   - Common competitive approaches
   - Differentiation opportunities
   - Market gaps to exploit

5. **Value Proposition Opportunities**
   - Unique selling points to emphasize
   - Benefits that resonate most
   - Trust-building elements`;

    // Make parallel requests for both reports
    const [audienceResponse, marketResponse] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: audiencePrompt },
          ],
        }),
      }),
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: marketPrompt },
          ],
        }),
      }),
    ]);

    if (!audienceResponse.ok || !marketResponse.ok) {
      const errText = !audienceResponse.ok 
        ? await audienceResponse.text() 
        : await marketResponse.text();
      console.error("AI gateway error:", errText);
      
      if (audienceResponse.status === 429 || marketResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (audienceResponse.status === 402 || marketResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to generate reports");
    }

    const [audienceData, marketData] = await Promise.all([
      audienceResponse.json(),
      marketResponse.json(),
    ]);

    const audienceReport = audienceData.choices?.[0]?.message?.content || "Failed to generate audience analysis";
    const marketReport = marketData.choices?.[0]?.message?.content || "Failed to generate market analysis";

    return new Response(
      JSON.stringify({
        audienceReport: {
          id: crypto.randomUUID(),
          name: "Target Audience Analysis",
          type: "research" as const,
          content: audienceReport,
        },
        marketReport: {
          id: crypto.randomUUID(),
          name: "Market Analysis Report",
          type: "research" as const,
          content: marketReport,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating reports:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
