import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUNDLE_API = "https://api.bundle.social/api/v1";

async function bundleDisconnectTeam(teamId: string) {
  const key = Deno.env.get("BUNDLE_SOCIAL_API_KEY");
  if (!key || !teamId) return;
  try {
    await fetch(`${BUNDLE_API}/team/${teamId}`, {
      method: "DELETE",
      headers: { "x-api-key": key },
    });
  } catch (e) {
    console.error("bundle.social team delete failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { data: isAdmin } = await callerClient.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) throw new Error("Admin access required");

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id required");

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Load target profile
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, email, bundle_social_team_id, account_id")
      .eq("user_id", user_id)
      .maybeSingle();

    // Safety: refuse to delete an admin via this endpoint
    const { data: targetIsAdmin } = await admin.rpc("is_admin", { _user_id: user_id });
    if (targetIsAdmin) throw new Error("Refusing to delete an administrator via this endpoint");

    // 1) Disconnect their own Bundle.social team (if they had one distinct from owner's)
    if (profile?.bundle_social_team_id) {
      await bundleDisconnectTeam(profile.bundle_social_team_id);
    }

    // 2) Delete campaigns they own (cascades to channels/posts/etc via FK, plus explicit cleanup)
    const { data: userCampaigns } = await admin
      .from("campaigns")
      .select("id")
      .eq("user_id", user_id);
    const campaignIds = (userCampaigns || []).map((c: any) => c.id);
    if (campaignIds.length) {
      // Best-effort cascade cleanup for tables without ON DELETE CASCADE
      const childTables = [
        "channel_posts",
        "campaign_channels",
        "campaign_addons",
        "campaign_budgets",
        "campaign_messages",
        "campaign_email_funnel",
        "campaign_drip_series",
        "campaign_drip_messages",
        "campaign_agent_instructions",
        "campaign_vault",
        "approval_requests",
        "channel_credentials",
        "landing_page_leads",
      ];
      for (const t of childTables) {
        try { await admin.from(t).delete().in("campaign_id", campaignIds); } catch (_) {}
      }
      await admin.from("campaigns").delete().in("id", campaignIds);
    }

    // 3) Remove team/location/account memberships
    await admin.from("location_members").delete().eq("user_id", user_id);
    await admin.from("account_members").delete().eq("user_id", user_id);

    // 4) Remove manager assignments (both directions)
    await admin.from("manager_assignments").delete().eq("client_user_id", user_id);
    await admin.from("manager_assignments").delete().eq("manager_user_id", user_id);

    // 5) Miscellaneous user-scoped data
    const userTables = [
      "knowledge_base",
      "channel_credentials",
      "user_roles",
      "user_secrets",
      "messages",
      "ai_rate_limits",
    ];
    for (const t of userTables) {
      try { await admin.from(t).delete().eq("user_id", user_id); } catch (_) {}
    }

    // 6) Profile + auth user
    await admin.from("profiles").delete().eq("user_id", user_id);
    try { await admin.auth.admin.deleteUser(user_id); } catch (e) { console.error("auth delete", e); }

    return new Response(
      JSON.stringify({ success: true, deleted_user_id: user_id, campaigns_deleted: campaignIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
