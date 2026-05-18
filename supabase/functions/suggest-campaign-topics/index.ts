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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");
    const { campaignId, campaignName } = await req.json();
    if (!campaignId) throw new Error("campaignId required");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: camp } = await admin.from("campaigns").select("user_id").eq("id", campaignId).maybeSingle();
    const ownerId = camp?.user_id;
    if (!ownerId) throw new Error("Campaign owner not found");

    const { data: profile } = await admin
      .from("profiles")
      .select("practice_name, target_audience, campaign_focus, website_url")
      .eq("user_id", ownerId)
      .maybeSingle();

    const { data: kb } = await admin
      .from("knowledge_base")
      .select("title, content")
      .eq("user_id", ownerId)
      .limit(20);

    const kbExcerpt = (kb || [])
      .map((d: any) => `### ${d.title}\n${(d.content || "").slice(0, 800)}`)
      .join("\n\n")
      .slice(0, 12000);

    const prompt = `Practice: ${profile?.practice_name || "(unknown)"}
Target audience: ${profile?.target_audience || "(unknown)"}
Stated campaign focus: ${profile?.campaign_focus || "(none)"}
Campaign name: ${campaignName || "(unknown)"}

Knowledge Base excerpts:
${kbExcerpt || "(empty)"}

Suggest exactly 3 strong, distinct, marketable campaign topic/focus ideas for this practice. Each topic should be a short phrase (3-10 words). Output strict JSON: { "topics": ["...", "...", "..."] }`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a healthcare/dental marketing strategist. Output strict JSON only." },
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
    let topics: string[] = [];
    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 3) : [];
    } catch {
      topics = [];
    }

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-campaign-topics error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
