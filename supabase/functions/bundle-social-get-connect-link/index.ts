/**
 * bundle-social-get-connect-link
 *
 * Returns a Bundle.social hosted account-connect URL so the client
 * can connect their own social accounts via OAuth.
 *
 * POST body: { profileUserId?: string }
 *
 * Required env vars:
 *   BUNDLE_SOCIAL_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BUNDLE_BASE = "https://api.bundle.social/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getBundleApiKey = () => {
  const raw = Deno.env.get("BUNDLE_SOCIAL_API_KEY")?.trim();
  if (!raw) return undefined;

  const explicitMatch = raw.match(/(?:BUNDLE_SOCIAL_API_KEY|x-api-key|apiKey)[\s"':=]+([^\s"'`,}]+)/i);
  return (explicitMatch?.[1] || raw)
    .trim()
    .replace(/^["'`“”‘’]|["'`“”‘’]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
    .trim();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    let targetUserId: string = caller.id;

    if (body.profileUserId && body.profileUserId !== caller.id) {
      const { data: isAdmin } = await callerClient.rpc("is_admin", { _user_id: caller.id });
      if (!isAdmin) throw new Error("Admin access required to generate links for other users");
      targetUserId = body.profileUserId;
    }

    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve effective Bundle.social team: if this user is a team member of
    // an account, use the owner's connected team. Otherwise fall back to their
    // own profile column.
    const { data: rpcTeamId, error: rpcErr } = await adminClient.rpc(
      "bundle_social_team_for_user",
      { _user_id: targetUserId },
    );

    let teamId: string | null = (rpcTeamId as unknown as string | null) ?? null;

    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("user_id, bundle_social_team_id, practice_name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (profErr || !profile) throw new Error("Profile not found");
    if (!teamId) teamId = profile.bundle_social_team_id;

    const apiKey = getBundleApiKey();
    if (!apiKey) throw new Error("BUNDLE_SOCIAL_API_KEY is not configured");

    // Auto-provision a Bundle.social team if one doesn't exist yet.
    if (!teamId) {
      const createRes = await fetch(`${BUNDLE_BASE}/team/`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.practice_name || `Client ${targetUserId.slice(0, 8)}`,
        }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Bundle.social team auto-create failed ${createRes.status}: ${errText}`);
      }
      const createData = await createRes.json();
      teamId = createData.id || createData.teamId;
      if (!teamId) throw new Error("Bundle.social did not return a team ID");

      await adminClient
        .from("profiles")
        .update({ bundle_social_team_id: teamId })
        .eq("user_id", targetUserId);
    }

    const res = await fetch(
      `${BUNDLE_BASE}/social-account/connect`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teamId }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Bundle.social error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const url: string = data.url || data.connectUrl;
    if (!url) throw new Error("Bundle.social did not return a connect URL");

    return new Response(
      JSON.stringify({ url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[bundle-social-get-connect-link]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
