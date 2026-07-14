/**
 * run-campaign-agent  (orchestrator)
 *
 * Chains the full Campaign Agent pipeline in one background job:
 *   1. planning         → generate-strategic-plan
 *   2. writing_content  → generate-content-hub (blog + hero image + YT script)
 *   3. deriving_posts   → generate-campaign-content (per-channel posts)
 *   4. completed
 *
 * Called by the Dashboard right after a new campaign is created in "agent" mode.
 * Frontend polls campaigns.generation_status and shows a phase overlay.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAccess, runStrategicPlan } from "../_shared/campaign-agent.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function invokeSelf(functionName: string, authHeader: string, body: unknown) {
  // Fire-and-forget invocation of another edge function using the caller's JWT.
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${functionName} ${resp.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { campaignId, topic, reuseStrategy } = await req.json();
    if (!campaignId) throw new Error("campaignId required");
    const authHeader = req.headers.get("Authorization");
    await requireAccess(admin, authHeader, campaignId);

    const { data: existingCampaign } = await admin.from("campaigns")
      .select("strategy")
      .eq("id", campaignId)
      .single();
    const shouldReuseStrategy = !!reuseStrategy && !!existingCampaign?.strategy;

    // Look up the campaign owner so KB pre-flight can target their reports.
    const { data: campaignRow } = await admin.from("campaigns")
      .select("user_id").eq("id", campaignId).single();
    const ownerId = campaignRow?.user_id as string | undefined;

    await admin.from("campaigns")
      .update({ generation_status: shouldReuseStrategy ? "writing_content" : "ensuring_kb", generation_error: null })
      .eq("id", campaignId);

    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      try {
        // Phase 0: ensure the KB has the practice reports the strategy relies on.
        if (!shouldReuseStrategy && ownerId && authHeader) {
          try {
            await invokeSelf("ensure-kb-reports", authHeader, { userId: ownerId });
          } catch (e) {
            console.warn("[run-campaign-agent] ensure-kb-reports non-fatal error", e);
          }
        }

        // Phase 1: strategic plan (in-process — no cross-function HTTP hop).
        if (!shouldReuseStrategy) {
          await admin.from("campaigns")
            .update({ generation_status: "planning" })
            .eq("id", campaignId);
          await runStrategicPlan(admin, apiKey, campaignId);
        }

        // Phase 2: content hub (blog + hero image + YT script).
        await admin.from("campaigns")
          .update({ generation_status: "writing_content" })
          .eq("id", campaignId);

        if (authHeader) {
          await invokeSelf("generate-content-hub", authHeader, {
            campaignId,
            ...(topic ? { topic } : {}),
            topicSource: topic ? "user_provided" : "ai_suggested",
          });
          const started = Date.now();
          while (Date.now() - started < 4 * 60_000) {
            await new Promise((r) => setTimeout(r, 3000));
            const { data: row } = await admin.from("campaigns")
              .select("generation_status").eq("id", campaignId).single();
            const s = row?.generation_status;
            if (s === "content_ready" || s === "completed") break;
            if (s === "failed") throw new Error("Content hub failed");
          }
        }

        // Phase 3: per-channel posts.
        await admin.from("campaigns")
          .update({ generation_status: "deriving_posts" })
          .eq("id", campaignId);

        if (authHeader) {
          await invokeSelf("generate-campaign-content", authHeader, { campaignId, force: false });
          const started = Date.now();
          while (Date.now() - started < 5 * 60_000) {
            await new Promise((r) => setTimeout(r, 3000));
            const { data: row } = await admin.from("campaigns")
              .select("generation_status").eq("id", campaignId).single();
            const s = row?.generation_status;
            if (s === "completed" || s === "posts_ready") break;
            if (s === "failed") throw new Error("Post derivation failed");
          }
        }

        // Phase 4: 6-email lead-nurture funnel.
        await admin.from("campaigns")
          .update({ generation_status: "writing_funnel" })
          .eq("id", campaignId);
        if (authHeader) {
          try {
            await invokeSelf("generate-email-funnel", authHeader, { campaignId });
          } catch (e) {
            console.warn("[run-campaign-agent] funnel generation failed (non-fatal)", e);
          }
        }

        // Phase 5: per-channel drip series (email + SMS). Skipped if no such channels.
        await admin.from("campaigns")
          .update({ generation_status: "writing_drips" })
          .eq("id", campaignId);
        if (authHeader) {
          try {
            const { data: dripChannels } = await admin
              .from("campaign_channels")
              .select("id, channel_type")
              .eq("campaign_id", campaignId)
              .in("channel_type", ["email", "sms"]);
            for (const ch of dripChannels || []) {
              // Ensure a default series exists for the channel.
              let { data: series } = await admin
                .from("campaign_drip_series")
                .select("id, complete")
                .eq("campaign_id", campaignId)
                .eq("channel_id", ch.id)
                .maybeSingle();
              if (!series) {
                const { data: created } = await admin
                  .from("campaign_drip_series")
                  .insert({
                    campaign_id: campaignId,
                    channel_id: ch.id,
                    channel_type: ch.channel_type,
                    recipient_mode: "existing",
                    recipient_config: {},
                    series_length: 3,
                    complete: false,
                  })
                  .select("id, complete")
                  .single();
                series = created;
              }
              if (series && !series.complete) {
                await invokeSelf("generate-drip-series", authHeader, {
                  campaignId,
                  channelId: ch.id,
                  seriesId: series.id,
                });
              }
            }
          } catch (e) {
            console.warn("[run-campaign-agent] drip series generation failed (non-fatal)", e);
          }
        }

        // Phase 6: client-branded landing page (stored on the campaign row).
        await admin.from("campaigns")
          .update({ generation_status: "building_landing_page" })
          .eq("id", campaignId);
        if (authHeader) {
          try {
            const { data: campaignRow } = await admin
              .from("campaigns")
              .select("assets_accepted")
              .eq("id", campaignId).single();
            const landingAccepted = !!(campaignRow?.assets_accepted as any)?.landing_page;
            if (!landingAccepted) {
              await invokeSelf("generate-landing-page", authHeader, { campaignId });
            }
          } catch (e) {
            console.warn("[run-campaign-agent] landing page generation failed (non-fatal)", e);
          }
        }

        await admin.from("campaigns")
          .update({ generation_status: "completed", generation_error: null })
          .eq("id", campaignId);
      } catch (e: any) {
        console.error("[run-campaign-agent] failed", e);
        await admin.from("campaigns")
          .update({ generation_status: "failed", generation_error: String(e?.message || e) })
          .eq("id", campaignId);
      }
    })());

    return new Response(JSON.stringify({ jobStarted: true, status: "planning" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
