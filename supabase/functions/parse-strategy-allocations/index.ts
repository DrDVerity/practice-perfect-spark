/**
 * parse-strategy-allocations
 *
 * Reads a campaign's strategy text and extracts:
 *  - total budget
 *  - per-channel allocations (platform + channel_type)
 *  - per-addon allocations (addon_type key)
 *
 * Returns JSON. Does not mutate the database — the client handles upserts
 * so RLS-friendly tables (campaign_budgets, campaign_channels, campaign_addons)
 * stay in sync with the existing hooks/mutations.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KNOWN_PLATFORMS = [
  "facebook","instagram","linkedin","twitter","tiktok","youtube",
  "mailchimp","beehive","internal_email","internal_sms",
] as const;

const KNOWN_ADDON_KEYS = [
  "google_ads","lsa","geotargeted","influencer","direct_mail",
  "print_newspaper","print_tabloid","print_circular","billboards_ooh",
  "radio_podcast","referral_program","community_events","content_marketing",
  "outbound_email",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: campaign } = await admin
      .from("campaigns").select("id, user_id, strategy").eq("id", campaignId).maybeSingle();
    if (!campaign) throw new Error("Campaign not found");

    // Authorization: owner, admin, or manager-of
    let allowed = caller.id === (campaign as any).user_id;
    if (!allowed) {
      const { data: r } = await admin.from("user_roles").select("role")
        .eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (r) allowed = true;
    }
    if (!allowed) {
      const { data: m } = await admin.from("manager_assignments").select("id")
        .eq("manager_user_id", caller.id).eq("client_user_id", (campaign as any).user_id).maybeSingle();
      if (m) allowed = true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const strategy: string = (campaign as any).strategy || "";
    if (!strategy.trim()) {
      return new Response(JSON.stringify({
        total_amount: 0, channels: [], addons: [],
        warning: "No strategy text available to parse.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const system = `You extract structured budget allocations from a marketing campaign strategy document.

Allowed channel platforms (lowercase, snake_case): ${KNOWN_PLATFORMS.join(", ")}.
Allowed addon keys (lowercase, snake_case): ${KNOWN_ADDON_KEYS.join(", ")}.

Channel types: "social_media" (facebook, instagram, linkedin, twitter, tiktok, youtube), "email" (mailchimp, beehive, internal_email), "sms" (internal_sms).

Return ONLY JSON with this exact shape:
{
  "total_amount": number,            // total campaign budget in USD
  "channels": [ { "platform": string, "channel_type": "social_media"|"email"|"sms", "amount": number, "percent": number } ],
  "addons":   [ { "addon_type": string, "amount": number, "percent": number } ]
}

Rules:
- Map common aliases (e.g. "LinkedIn Ads" → linkedin, "IG" → instagram, "X" → twitter, "YT" → youtube, "Google Ads" → google_ads, "Local Service Ads" or "LSA" → lsa, "Outbound Email" → outbound_email).
- Drop any line item that does not map to an allowed platform or addon key.
- If percent or amount is missing, compute it from the other given total_amount.
- amounts must be plain numbers (no $ sign).
- If the strategy explicitly says organic-only or $0 spend, return total_amount: 0 and empty arrays.
- Output JSON only — no prose, no code fences.`;

    const user = `Strategy document:\n\n${strategy.slice(0, 12000)}`;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI failed: ${aiResp.status} ${t}`);
    }
    const aiData = await aiResp.json();
    let raw: string = aiData.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    // Sanitize
    const total = Number(parsed.total_amount) || 0;
    const channels = Array.isArray(parsed.channels) ? parsed.channels
      .map((c: any) => ({
        platform: String(c.platform || "").toLowerCase().trim(),
        channel_type: ["social_media","email","sms"].includes(c.channel_type) ? c.channel_type : "social_media",
        amount: Math.max(0, Number(c.amount) || 0),
        percent: Math.max(0, Number(c.percent) || 0),
      }))
      .filter((c: any) => (KNOWN_PLATFORMS as readonly string[]).includes(c.platform)) : [];

    const addons = Array.isArray(parsed.addons) ? parsed.addons
      .map((a: any) => ({
        addon_type: String(a.addon_type || "").toLowerCase().trim(),
        amount: Math.max(0, Number(a.amount) || 0),
        percent: Math.max(0, Number(a.percent) || 0),
      }))
      .filter((a: any) => KNOWN_ADDON_KEYS.includes(a.addon_type)) : [];

    return new Response(JSON.stringify({ total_amount: total, channels, addons }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-strategy-allocations error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
