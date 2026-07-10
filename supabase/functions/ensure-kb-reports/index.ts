/**
 * ensure-kb-reports
 *
 * Phase 1 of the refactored Campaign Pipeline: verifies the client's Knowledge
 * Base contains the practice reports the strategy step depends on. If any of
 * the required doc types are missing, it invokes the appropriate generators
 * and waits for them to finish (bounded).
 *
 * Required doc_types:
 *   - market_analysis
 *   - competitive_landscape
 *   - audience_analysis
 *   - demographics
 *   - brand_guidelines
 *
 * POST body: { userId: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REQUIRED = [
  "market_analysis",
  "competitive_landscape",
  "audience_analysis",
  "demographics",
  "brand_guidelines",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function invokeFn(name: string, authHeader: string, body: unknown) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
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
  if (!resp.ok) {
    console.warn(`[ensure-kb-reports] ${name} ${resp.status}: ${text.slice(0, 200)}`);
    return null;
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function present(admin: any, userId: string): Promise<Set<string>> {
  const { data } = await admin
    .from("knowledge_base")
    .select("doc_type")
    .eq("user_id", userId)
    .in("doc_type", REQUIRED);
  return new Set((data || []).map((r: any) => r.doc_type));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { userId } = await req.json();
    if (!userId) throw new Error("userId required");

    const { data: profile } = await admin
      .from("profiles")
      .select("practice_name, website_url, campaign_focus, target_audience")
      .eq("user_id", userId)
      .maybeSingle();

    const have = await present(admin, userId);
    const missing = REQUIRED.filter((d) => !have.has(d));
    if (missing.length === 0) {
      return new Response(JSON.stringify({ ok: true, present: [...have], missing: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Kick generators in parallel; whichever ones apply to the missing set.
    const jobs: Promise<any>[] = [];
    const needsCoreReports = missing.some((m) =>
      ["market_analysis", "competitive_landscape", "audience_analysis", "demographics"].includes(m));
    if (needsCoreReports) {
      jobs.push(invokeFn("generate-onboarding-reports", authHeader, { userId, force: false }));
    }
    if (missing.includes("brand_guidelines")) {
      jobs.push(invokeFn("generate-brand-guidelines", authHeader, {
        userId,
        websiteUrl: profile?.website_url || null,
        practiceName: profile?.practice_name || null,
      }));
    }
    await Promise.all(jobs);

    // Poll up to ~3 min for the missing doc_types to appear.
    const started = Date.now();
    const timeoutMs = 3 * 60_000;
    let currentMissing = missing;
    while (Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 4000));
      const now = await present(admin, userId);
      currentMissing = REQUIRED.filter((d) => !now.has(d));
      if (currentMissing.length === 0) break;
    }

    return new Response(JSON.stringify({
      ok: currentMissing.length === 0,
      missing: currentMissing,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
