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

    const { campaignId, topic } = await req.json();
    if (!campaignId) throw new Error("campaignId required");
    const authHeader = req.headers.get("Authorization");
    await requireAccess(admin, authHeader, campaignId);

    await admin.from("campaigns")
      .update({ generation_status: "planning", generation_error: null })
      .eq("id", campaignId);

    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      try {
        // Phase 1: strategic plan (in-process — no cross-function HTTP hop).
        await runStrategicPlan(admin, apiKey, campaignId);

        // Phase 2: content hub (blog + hero image + YT script). Runs inline via HTTP
        // so the existing generate-content-hub logic (KB reads, image upload) is reused.
        await admin.from("campaigns")
          .update({ generation_status: "writing_content" })
          .eq("id", campaignId);

        // Pick a topic from campaign focus if none was provided.
        const { data: camp } = await admin.from("campaigns")
          .select("focus, name, content_topic").eq("id", campaignId).single();
        const chosenTopic = (topic || camp?.content_topic || camp?.name || camp?.focus || "").toString().trim();
        if (chosenTopic && authHeader) {
          await invokeSelf("generate-content-hub", authHeader, {
            campaignId, topic: chosenTopic, topicSource: topic ? "user_provided" : "ai_suggested",
          });
          // content-hub runs as a background job itself; poll until content_ready or failed.
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
          // Poll for completion.
          const started = Date.now();
          while (Date.now() - started < 5 * 60_000) {
            await new Promise((r) => setTimeout(r, 3000));
            const { data: row } = await admin.from("campaigns")
              .select("generation_status").eq("id", campaignId).single();
            const s = row?.generation_status;
            if (s === "completed") break;
            if (s === "failed") throw new Error("Post derivation failed");
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
