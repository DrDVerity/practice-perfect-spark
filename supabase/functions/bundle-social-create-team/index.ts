/**
 * bundle-social-create-team
 *
 * Creates a Bundle.social team for a client and saves the returned
 * team ID back to profiles.bundle_social_team_id.
 *
 * Called by: CreateClientDialog (admin) after inserting the profiles row.
 *
 * POST body: { profileUserId: string }
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

    const { data: isAdmin } = await callerClient.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) throw new Error("Admin access required");

    const { profileUserId } = await req.json();
    if (!profileUserId) throw new Error("profileUserId is required");

    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, practice_name, bundle_social_team_id")
      .eq("user_id", profileUserId)
      .maybeSingle();

    if (profileErr || !profile) throw new Error("Profile not found");

    if (profile.bundle_social_team_id) {
      return new Response(
        JSON.stringify({ teamId: profile.bundle_social_team_id, alreadyExisted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("BUNDLE_SOCIAL_API_KEY")?.trim().replace(/^["']|["']$/g, "");
    if (!apiKey) throw new Error("BUNDLE_SOCIAL_API_KEY is not configured");

    const res = await fetch(`${BUNDLE_BASE}/team/`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: profile.practice_name || `Client ${profileUserId.slice(0, 8)}`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Bundle.social error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const teamId: string = data.id || data.teamId;
    if (!teamId) throw new Error("Bundle.social did not return a team ID");

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ bundle_social_team_id: teamId })
      .eq("user_id", profileUserId);

    if (updateErr) throw new Error(`Failed to save team ID: ${updateErr.message}`);

    return new Response(
      JSON.stringify({ teamId, alreadyExisted: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[bundle-social-create-team]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
