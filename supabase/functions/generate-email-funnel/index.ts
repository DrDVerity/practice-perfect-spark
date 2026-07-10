/**
 * generate-email-funnel
 *
 * Phase 4 of the refactored Campaign Pipeline. Generates a welcome email plus
 * a 5-email nurture sequence (6 total) grounded in the campaign strategy,
 * target audience, and blog article. Stored in campaign_email_funnel.
 *
 * POST body: { campaignId: string, regenerate?: boolean }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callAI, corsHeaders, extractJson, loadCampaignContext, requireAccess,
} from "../_shared/campaign-agent.ts";

interface FunnelEmail {
  subject: string;
  preview_text?: string;
  body_html: string;
  send_offset_days: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { campaignId, regenerate } = await req.json();
    if (!campaignId) throw new Error("campaignId required");
    await requireAccess(admin, req.headers.get("Authorization"), campaignId);

    if (!regenerate) {
      const { data: existing } = await admin
        .from("campaign_email_funnel").select("id").eq("campaign_id", campaignId).limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const ctx = await loadCampaignContext(admin, campaignId);
    const { campaign, profile } = ctx;

    const raw = await callAI(apiKey,
      `You are a senior email copywriter. Produce STRICT JSON:
{"emails":[{"subject":string,"preview_text":string,"body_html":string,"send_offset_days":number}]}

Rules:
- Return exactly 6 emails in send order.
- Email 1 is a welcome email, send_offset_days=0.
- Emails 2-6 are a nurture sequence with send_offset_days 2, 4, 7, 11, 16 respectively.
- Tone: friendly-professional, matching the campaign strategy and target audience.
- body_html must be simple, well-formed HTML using <p>, <h2>, <ul>, <a>, and <strong> only. No inline styles. No <script>, no <img>.
- Every email must include one clear CTA linking to the campaign landing page (use the placeholder {{LANDING_URL}} for the href).
- Do not fabricate testimonials or statistics.
- No emojis. No fluff. No markdown fences in the JSON.`,
      `Publishing business: ${profile?.practice_name || "(unknown)"}
Website: ${profile?.website_url || "(unknown)"}
Campaign name: ${campaign.name}
Campaign focus: ${campaign.focus || "(none)"}
Target audience: ${campaign.target_audience || profile?.target_audience || "(none)"}

Strategic plan:
${(campaign.strategy || "").slice(0, 3500)}

Blog article (source of proof points and voice):
${(campaign.blog_article || "").slice(0, 3500)}`,
      { model: "google/gemini-2.5-pro", temperature: 0.7, jsonObject: true, maxTokens: 4096 });

    let parsed: { emails: FunnelEmail[] } = { emails: [] };
    try { parsed = extractJson(raw); } catch (e) { console.error("[funnel] parse failed", e); }
    const emails = (parsed.emails || []).slice(0, 6);
    if (emails.length === 0) throw new Error("Model returned no emails");

    if (regenerate) {
      await admin.from("campaign_email_funnel").delete().eq("campaign_id", campaignId);
    }
    const rows = emails.map((e, i) => ({
      campaign_id: campaignId,
      order_index: i,
      subject: e.subject?.slice(0, 200) || `Email ${i + 1}`,
      preview_text: e.preview_text?.slice(0, 200) || null,
      body_html: e.body_html || "",
      send_offset_days: Number.isFinite(e.send_offset_days) ? e.send_offset_days : (i === 0 ? 0 : i * 2),
    }));
    const { error } = await admin.from("campaign_email_funnel").insert(rows);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
