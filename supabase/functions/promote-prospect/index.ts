/**
 * promote-prospect  (auth required)
 *
 * Called after a prospect signs in with Google. Copies:
 *   - prospect_reports  → knowledge_base (mapped doc_types)
 * The generated blog / posts / email funnel stay on prospect_campaigns for
 * now; the user can trigger a real campaign creation from the dashboard.
 * Sets prospect_accounts.converted_user_id.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOC_TYPE_MAP: Record<string, string> = {
  practice_analysis: "market_analysis",
  competitive_analysis: "competitive_landscape",
  audience_analysis: "audience_analysis",
  brand_guidelines: "brand_guidelines",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const { prospectId } = await req.json();
    if (!prospectId) throw new Error("prospectId required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Resolve caller identity via anon client
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Unauthorized");
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: prospect } = await admin.from("prospect_accounts")
      .select("id, converted_user_id").eq("id", prospectId).maybeSingle();
    if (!prospect) throw new Error("Prospect not found");

    // Look up caller's account/location for KB scope
    const { data: profile } = await admin.from("profiles")
      .select("account_id").eq("user_id", userId).maybeSingle();
    const { data: loc } = await admin.from("locations")
      .select("id").eq("account_id", profile?.account_id).eq("is_default", true).maybeSingle();

    const { data: reports } = await admin.from("prospect_reports")
      .select("doc_type, title, content, metadata").eq("prospect_id", prospectId);

    let copied = 0;
    for (const r of (reports || [])) {
      const kbType = DOC_TYPE_MAP[r.doc_type];
      if (!kbType) continue;
      await admin.from("knowledge_base").upsert({
        user_id: userId,
        account_id: profile?.account_id || null,
        location_id: loc?.id || null,
        doc_type: kbType,
        title: r.title,
        content: r.content,
        metadata: { ...(r.metadata || {}), source: "prospect_promotion", prospect_id: prospectId },
        scope: "location",
      });
      copied++;
    }

    await admin.from("prospect_accounts")
      .update({ converted_user_id: userId })
      .eq("id", prospectId);

    return new Response(JSON.stringify({ ok: true, reportsCopied: copied }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
