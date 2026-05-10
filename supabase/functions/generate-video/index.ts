import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const body = await req.json();
    const clip = (v: unknown, n: number) => typeof v === 'string' ? v.slice(0, n) : undefined;
    const prompt = clip(body.prompt, 1000);
    const platform = clip(body.platform, 50);
    const targetAudience = clip(body.targetAudience, 500);
    const postFocus = clip(body.postFocus, 500);
    const campaignName = clip(body.campaignName, 200);
    const practiceName = clip(body.practiceName, 200);

    if (!prompt && !postFocus) {
      throw new Error("Prompt or post focus is required");
    }

    // Build a comprehensive video prompt
    const videoPrompt = prompt || buildVideoPrompt(platform, targetAudience, postFocus, campaignName, practiceName);

    console.log("Generating video with prompt:", videoPrompt);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Lovable AI to generate a video concept/storyboard
    // Note: Actual video generation would require a specialized video API
    // For now, we generate a detailed video concept that can be used with video creation tools
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a professional video content strategist for healthcare marketing. 
Create scroll-stopping promotional video concepts that are:
- Attention-grabbing in the first 2 seconds
- Optimized for ${platform || 'social media'} 
- Targeted at ${targetAudience || 'adults 25-55'}
- Professional yet approachable
- HIPAA-compliant and ethical

Output a detailed video script with:
1. Hook (first 2 seconds)
2. Key message (5-10 seconds)
3. Call to action (final 3 seconds)
4. Visual description for each segment
5. Suggested music/audio style`
          },
          {
            role: "user",
            content: `Create a scroll-stopping promotional video concept for:

Topic/Focus: ${postFocus || prompt}
${campaignName ? `Campaign: ${campaignName}` : ''}
${practiceName ? `Practice: ${practiceName}` : ''}
Platform: ${platform || 'social media'}
Target Audience: ${targetAudience || 'local patients'}

Generate a detailed video script that will capture attention and drive engagement.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Video generation API error:", errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Video concept generation failed: ${response.status}`);
    }

    const data = await response.json();
    const videoScript = data.choices?.[0]?.message?.content;

    if (!videoScript) {
      throw new Error("No video script was generated");
    }

    // Generate a placeholder video URL or concept
    // In production, this would integrate with a video generation API
    const videoConcept = {
      script: videoScript,
      duration: "15-30 seconds",
      platform: platform,
      targetAudience: targetAudience,
      status: "concept_ready",
      // Placeholder - in production this would be an actual video URL
      videoUrl: null,
      message: "Video concept generated. Integrate with video generation service for actual video creation."
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...videoConcept
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Error in generate-video function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

function buildVideoPrompt(
  platform?: string,
  targetAudience?: string,
  postFocus?: string,
  campaignName?: string,
  practiceName?: string
): string {
  const parts = [];
  
  if (postFocus) parts.push(`Topic: ${postFocus}`);
  if (campaignName) parts.push(`Campaign: ${campaignName}`);
  if (practiceName) parts.push(`Practice: ${practiceName}`);
  if (targetAudience) parts.push(`Audience: ${targetAudience}`);
  if (platform) parts.push(`Platform: ${platform}`);
  
  return parts.join('. ') || 'Create a healthcare promotional video';
}
