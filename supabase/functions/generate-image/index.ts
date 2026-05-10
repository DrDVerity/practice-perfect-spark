import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    {
      const _userId = (claimsData.claims as any).sub as string;
      const _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: _ok } = await _sb.rpc('check_and_consume_rate_limit', { _user_id: _userId, _endpoint: 'generate-image', _max_per_minute: 8 });
      if (_ok === false) return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 1000) : '';
    const platform = typeof body.platform === 'string' ? body.platform.slice(0, 50) : undefined;

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // Enhance prompt based on platform
    let enhancedPrompt = prompt;
    
    if (platform === 'instagram') {
      enhancedPrompt = `Create a vibrant, visually striking social media image for Instagram. ${prompt}. Style: Modern, clean, eye-catching with good contrast. Suitable for mobile viewing. No text overlays.`;
    } else if (platform === 'facebook') {
      enhancedPrompt = `Create a professional, engaging social media image for Facebook. ${prompt}. Style: Clear focal point, warm and inviting, professional quality. Suitable for news feed. No text overlays.`;
    } else if (platform === 'linkedin') {
      enhancedPrompt = `Create a professional, business-appropriate image for LinkedIn. ${prompt}. Style: Corporate yet approachable, clean and modern, professional photography style. No text overlays.`;
    } else if (platform === 'twitter') {
      enhancedPrompt = `Create a bold, attention-grabbing image for Twitter/X. ${prompt}. Style: Simple, high contrast, immediately understandable at small sizes. No text overlays.`;
    } else {
      enhancedPrompt = `Create a professional social media marketing image. ${prompt}. Style: Clean, modern, professional quality. No text overlays.`;
    }

    console.log("Generating image with prompt:", enhancedPrompt);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image generation API error:", errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("Image generation response received");

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      throw new Error("No image was generated");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Error in generate-image function:", error);
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
