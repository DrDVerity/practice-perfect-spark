/**
 * refresh-strategic-plan
 *
 * Re-runs ONLY the strategic plan + budget allocation phase, preserving any
 * generated blog / posts / accepted assets. Triggered by the plan-drift banner
 * when campaign inputs (budget total, channels, addons, focus, dates) change.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAccess, runStrategicPlan } from "../_shared/campaign-agent.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId required");
    await requireAccess(admin, req.headers.get("Authorization"), campaignId);

    await admin.from("campaigns")
      .update({ generation_status: "planning", generation_error: null })
      .eq("id", campaignId);

    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      try {
        await runStrategicPlan(admin, apiKey, campaignId);
        // After plan refresh, do NOT touch blog/posts — user keeps their accepted assets.
        // Mark completed so the UI dismisses the "planning" overlay.
        await admin.from("campaigns")
          .update({ generation_status: "completed", generation_error: null })
          .eq("id", campaignId);
      } catch (e: any) {
        await admin.from("campaigns")
          .update({ generation_status: "failed", generation_error: String(e?.message || e) })
          .eq("id", campaignId);
      }
    })());

    return new Response(JSON.stringify({ jobStarted: true }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
