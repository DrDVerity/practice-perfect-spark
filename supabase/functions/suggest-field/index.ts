import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Human-readable instruction per field id.
const FIELD_INSTRUCTIONS: Record<string, string> = {
  campaign_focus: "short campaign focus / theme ideas (3-8 words each)",
  topic: "specific content topic ideas suitable for a blog or social post",
  target_audience: "distinct target-audience descriptions for a marketing campaign",
  campaign_name: "catchy but professional campaign names (2-5 words each)",
  post_caption: "ready-to-post social captions (1-2 sentences, on-brand, no hashtags spam)",
  goal: "concrete, measurable marketing goals",
  headline: "landing-page or ad headlines (under 10 words)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");
    const body = await req.json();
    const field: string = body.field || "campaign_focus";
    const count: number = Math.min(Math.max(body.count || 4, 1), 8);
    const context = body.context || {};
    let ownerId: string | null = body.userId || null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!ownerId && body.campaignId) {
      const { data: camp } = await admin
        .from("campaigns")
        .select("user_id")
        .eq("id", body.campaignId)
        .maybeSingle();
      ownerId = camp?.user_id || null;
    }

    let profile: any = null;
    let kbExcerpt = "";
    if (ownerId) {
      const { data: prof } = await admin
        .from("profiles")
        .select("practice_name, target_audience, campaign_focus, website_url")
        .eq("user_id", ownerId)
        .maybeSingle();
      profile = prof;
      const { data: kb } = await admin
        .from("knowledge_base")
        .select("title, content")
        .eq("user_id", ownerId)
        .limit(12);
      kbExcerpt = (kb || [])
        .map((d: any) => `### ${d.title}\n${(d.content || "").slice(0, 600)}`)
        .join("\n\n")
        .slice(0, 9000);
    }

    const instruction = FIELD_INSTRUCTIONS[field] || `suggestions for the "${field}" field`;
    const ctxLines = Object.entries(context)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const prompt = `Practice: ${profile?.practice_name || "(unknown)"}
Target audience: ${profile?.target_audience || "(unknown)"}
Stated focus: ${profile?.campaign_focus || "(none)"}
Website: ${profile?.website_url || "(unknown)"}
${ctxLines ? `\nCurrent context:\n${ctxLines}` : ""}

Knowledge Base excerpts:
${kbExcerpt || "(empty)"}

Generate exactly ${count} strong, distinct ${instruction} for this dental practice. Keep each concise and directly usable. Do not use em-dashes. Output strict JSON: { "suggestions": ["...", ...] }`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a healthcare/dental marketing strategist. Output strict JSON only. Never use em-dashes." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      throw new Error(`AI gateway: ${resp.status}`);
    }

    const data = await resp.json();
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, count) : [];
    } catch {
      suggestions = [];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-field error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
