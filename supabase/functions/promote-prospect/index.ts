/**
 * promote-prospect  (auth required)
 *
 * Called after a prospect signs in with Google. Responsibilities:
 *   1. Persist plan_tier + trial_ends_at on the user's profile.
 *   2. Group teammates by normalized practice website URL:
 *        - If an account already exists for that URL, add the user as a member.
 *        - Otherwise create a new account and make the user the owner.
 *      (Admin/owners can later change roles via the admin dashboard.)
 *   3. Copy prospect_reports into the client's knowledge_base.
 *   4. Enqueue the 14-day nurture email series.
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

const NURTURE_SCHEDULE: Array<{ key: string; dayOffset: number }> = [
  { key: "welcome", dayOffset: 0 },
  { key: "nurture_day_3", dayOffset: 3 },
  { key: "nurture_day_6", dayOffset: 6 },
  { key: "nurture_day_10", dayOffset: 10 },
  { key: "nurture_day_13_upgrade", dayOffset: 13 },
];

function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  const s = u.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
  return s || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const body = await req.json().catch(() => ({}));
    const { prospectId, planTier } = body as { prospectId?: string; planTier?: string };

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Unauthorized");
    const userId = userData.user.id;
    const userEmail = userData.user.email || "";

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load prospect (may be missing if the user came from /pricing instead of /get-started)
    let prospect: any = null;
    if (prospectId) {
      const { data } = await admin.from("prospect_accounts")
        .select("id, website_url, practice_name, converted_user_id")
        .eq("id", prospectId).maybeSingle();
      prospect = data;
    }

    // Persist plan + trial on profile
    const nowIso = new Date().toISOString();
    const trialEndsAt = planTier === "trial"
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: profile } = await admin.from("profiles")
      .select("account_id, website_url, practice_name")
      .eq("user_id", userId).maybeSingle();

    const websiteUrl = profile?.website_url || prospect?.website_url || null;
    const practiceName = profile?.practice_name || prospect?.practice_name || userEmail || "My Practice";
    const normalizedUrl = normalizeUrl(websiteUrl);

    await admin.from("profiles").update({
      plan_tier: planTier || "trial",
      trial_ends_at: trialEndsAt,
      website_url: websiteUrl,
      practice_name: practiceName,
    }).eq("user_id", userId);

    // Team grouping by normalized website URL
    let accountId = profile?.account_id || null;
    if (normalizedUrl) {
      // Search for an existing account with the same URL
      const { data: existingAcct } = await admin.from("accounts")
        .select("id, owner_user_id")
        .eq("website_url_normalized", normalizedUrl)
        .maybeSingle();

      if (existingAcct) {
        accountId = existingAcct.id;
        // Add as member (do not overwrite existing role)
        await admin.from("account_members").upsert({
          account_id: accountId,
          user_id: userId,
          role: "member",
        }, { onConflict: "account_id,user_id", ignoreDuplicates: true });
      } else if (!accountId) {
        // Create a new account owned by this user
        const { data: newAcct, error: acctErr } = await admin.from("accounts").insert({
          name: practiceName,
          owner_user_id: userId,
          website_url_normalized: normalizedUrl,
        }).select("id").single();
        if (acctErr) throw acctErr;
        accountId = newAcct.id;
        await admin.from("account_members").insert({
          account_id: accountId,
          user_id: userId,
          role: "owner",
        });
        // Default location
        await admin.from("locations").insert({
          account_id: accountId,
          name: `${practiceName} (Main)`,
          is_default: true,
        });
      } else {
        // Existing account (from trigger) — stamp URL if empty
        await admin.from("accounts")
          .update({ website_url_normalized: normalizedUrl })
          .eq("id", accountId)
          .is("website_url_normalized", null);
      }
      await admin.from("profiles").update({ account_id: accountId }).eq("user_id", userId);
    }

    // KB scope lookup
    const { data: loc } = accountId
      ? await admin.from("locations").select("id").eq("account_id", accountId).eq("is_default", true).maybeSingle()
      : { data: null } as any;

    // Copy prospect reports if any
    let copied = 0;
    if (prospectId) {
      const { data: reports } = await admin.from("prospect_reports")
        .select("doc_type, title, content, metadata").eq("prospect_id", prospectId);
      for (const r of (reports || [])) {
        const kbType = DOC_TYPE_MAP[r.doc_type];
        if (!kbType) continue;
        await admin.from("knowledge_base").upsert({
          user_id: userId,
          account_id: accountId || null,
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
        .update({ converted_user_id: userId }).eq("id", prospectId);
    }

    // Seed the 14-day nurture email queue (skip if user already has entries)
    if (userEmail) {
      const { data: existing } = await admin.from("subscriber_nurture_emails")
        .select("id").eq("user_id", userId).limit(1);
      if (!existing || existing.length === 0) {
        const rows = NURTURE_SCHEDULE.map(step => ({
          user_id: userId,
          email: userEmail,
          template_key: step.key,
          send_at: new Date(Date.now() + step.dayOffset * 24 * 60 * 60 * 1000).toISOString(),
        }));
        await admin.from("subscriber_nurture_emails").insert(rows);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      accountId,
      planTier: planTier || "trial",
      trialEndsAt,
      reportsCopied: copied,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("promote-prospect error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
