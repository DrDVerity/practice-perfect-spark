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
    const { prompt, platform } = await req.json();

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
