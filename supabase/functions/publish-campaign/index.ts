/**
 * publish-campaign
 *
 * Re-runs the preflight check server-side, and on pass:
 *   - marks every draft post as `scheduled`
 *   - flips campaign status to `scheduled`
 *   - enqueues each social post via bundle-social-publish-post (best-effort;
 *     the bundle-social-cron-publish sweeper will also pick them up).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAccess } from "../_shared/campaign-agent.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOCIAL = new Set(["facebook", "instagram", "linkedin", "twitter", "youtube", "tiktok"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId required");
    const authHeader = req.headers.get("Authorization");
    await requireAccess(admin, authHeader, campaignId);

    // Preflight (server-side authoritative).
    const preflightResp = await fetch(`${SUPABASE_URL}/functions/v1/publish-campaign-preflight`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader || "",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify({ campaignId }),
    });
    const preflight = await preflightResp.json();
    if (!preflight.ok) {
      return new Response(JSON.stringify({ error: "Preflight failed", preflight }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Move draft posts to scheduled.
    const { data: campaign } = await admin
      .from("campaigns")
      .select("id, status, campaign_channels(id, platform, channel_posts(id, status, scheduled_start))")
      .eq("id", campaignId)
      .single();

    const draftIds: string[] = [];
    const socialPostIds: string[] = [];
    for (const ch of campaign?.campaign_channels || []) {
      for (const p of ch.channel_posts || []) {
        if (p.status !== "scheduled" && p.status !== "published") draftIds.push(p.id);
        if (SOCIAL.has(ch.platform)) socialPostIds.push(p.id);
      }
    }
    if (draftIds.length > 0) {
      await admin.from("channel_posts").update({ status: "scheduled" }).in("id", draftIds);
    }
    await admin.from("campaigns").update({ status: "scheduled" }).eq("id", campaignId);

    // Best-effort: kick off Bundle.social publishing for each social post now.
    // Anything not yet due is scheduled server-side by Bundle.social.
    const results: any[] = [];
    for (const postId of socialPostIds) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/bundle-social-publish-post`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader || "",
            apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
          },
          body: JSON.stringify({ postId }),
        });
        const j = await r.json().catch(() => ({}));
        results.push({ postId, ok: r.ok, ...(j || {}) });
      } catch (e: any) {
        results.push({ postId, ok: false, error: String(e?.message || e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, scheduled: draftIds.length, dispatched: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
