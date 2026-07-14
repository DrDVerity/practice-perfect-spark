/**
 * generate-drip-series
 *
 * Seeds N drip messages (email or SMS) for a single campaign_drip_series row.
 * Idempotent: deletes existing non-accepted drafts before regen; accepted
 * messages are preserved. If the parent series is marked `complete = true`,
 * this function is a no-op.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/campaign-agent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { campaignId, channelId, seriesId } = await req.json();
    if (!campaignId || !channelId || !seriesId) {
      throw new Error("campaignId, channelId, and seriesId are required");
    }

    // Access check — caller must be owner, admin, or assigned manager.
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: userData } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", ""),
      );
      const caller = userData?.user;
      const { data: c } = await supabase
        .from("campaigns").select("user_id").eq("id", campaignId).single();
      const ownerId = c?.user_id;
      let allowed = caller?.id === ownerId;
      if (!allowed && caller) {
        const { data: r } = await supabase.from("user_roles")
          .select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
        if (r) allowed = true;
      }
      if (!allowed && caller) {
        const { data: m } = await supabase.from("manager_assignments")
          .select("id").eq("manager_user_id", caller.id)
          .eq("client_user_id", ownerId).maybeSingle();
        if (m) allowed = true;
      }
      // If invoked from another edge function using the service role JWT, caller is null — allow.
      if (caller && !allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: series } = await supabase
      .from("campaign_drip_series")
      .select("*").eq("id", seriesId).single();
    if (!series) throw new Error("Series not found");
    if (series.complete) {
      return new Response(JSON.stringify({ skipped: true, reason: "series complete" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name, focus, target_audience, strategy, blog_article")
      .eq("id", campaignId).single();
    if (!campaign) throw new Error("Campaign not found");

    // Preserve accepted messages; delete only unaccepted drafts.
    await supabase
      .from("campaign_drip_messages")
      .delete()
      .eq("series_id", seriesId)
      .neq("accepted", true);

    const isEmail = series.channel_type === "email";
    const seriesLength = Math.max(1, Math.min(10, series.series_length || 3));

    const systemPrompt = isEmail
      ? `You write high-converting nurture emails for a dental practice campaign.
Return STRICT JSON: {"subject": string, "body": string}.
- subject: <60 chars, benefit-led, no clickbait.
- body: 120-220 words, plain text with short paragraphs, one clear CTA line at the end.
- Speak directly to the target audience. Reference the campaign focus concretely.
- Never invent statistics.`
      : `You write short SMS messages for a dental practice campaign.
Return STRICT JSON: {"body": string}.
- body: <=160 chars including any URL placeholder like {link}.
- One clear ask. Friendly, human, not spammy.
- No emojis unless clearly appropriate.`;

    const baseContext = `Campaign: ${campaign.name}
Focus: ${campaign.focus || ""}
Target audience: ${campaign.target_audience || ""}
Strategy excerpt:
${(campaign.strategy || "").slice(0, 2000)}
Blog excerpt:
${(campaign.blog_article || "").slice(0, 2000)}`;

    let seeded = 0;
    for (let i = 1; i <= seriesLength; i++) {
      // Skip slots that already have an accepted message.
      const { data: existing } = await supabase
        .from("campaign_drip_messages")
        .select("id, accepted")
        .eq("series_id", seriesId)
        .eq("sequence_no", i)
        .maybeSingle();
      if (existing?.accepted) continue;

      const userPrompt = `${baseContext}

Write message ${i} of ${seriesLength} in this ${isEmail ? "email" : "SMS"} drip series.
Position hint: ${
        i === 1 ? "warm intro that establishes the topic" :
        i === seriesLength ? "final nudge with a strong CTA" :
        "reinforce a benefit and address a common objection"
      }.
Return JSON only.`;

      let subject: string | null = null;
      let body = "";
      try {
        const raw = await callAI(apiKey, systemPrompt, userPrompt, {
          jsonObject: true,
          maxTokens: isEmail ? 900 : 300,
        });
        const parsed = JSON.parse(raw);
        subject = isEmail ? String(parsed.subject || "").trim().slice(0, 120) : null;
        body = String(parsed.body || "").trim();
      } catch (e) {
        console.warn(`[generate-drip-series] message ${i} failed`, e);
        continue;
      }
      if (!body) continue;

      await supabase.from("campaign_drip_messages").insert({
        series_id: seriesId,
        sequence_no: i,
        subject,
        body,
        status: "draft",
        accepted: false,
      });
      seeded += 1;
    }

    return new Response(JSON.stringify({ seeded, seriesLength }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-drip-series error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
