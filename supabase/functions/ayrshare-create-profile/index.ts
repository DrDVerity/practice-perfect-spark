/**
 * ayrshare-create-profile
 *
 * Creates an Ayrshare sub-profile for a client and saves the returned
 * profileKey back to profiles.ayrshare_profile_id.
 *
 * Called by: CreateClientDialog (admin) after inserting the profiles row.
 *
 * POST body: { profileUserId: string }   ← the profiles.user_id of the new client
 *
 * Required env vars (Supabase Edge Function secrets):
 *   AYRSHARE_API_KEY        – master agency key
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const AYRSHARE_BASE = "https://app.ayrshare.com/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth: only admins may call this ──────────────────────────────────────
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

    // ── Parse body ───────────────────────────────────────────────────────────
    const { profileUserId } = await req.json();
    if (!profileUserId) throw new Error("profileUserId is required");

    // ── Fetch the client's profile ───────────────────────────────────────────
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, practice_name, ayrshare_profile_id")
      .eq("user_id", profileUserId)
      .maybeSingle();

    if (profileErr || !profile) throw new Error("Profile not found");

    // ── Idempotency: skip if already provisioned ─────────────────────────────
    if (profile.ayrshare_profile_id) {
      return new Response(
        JSON.stringify({ profileKey: profile.ayrshare_profile_id, alreadyExisted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Create Ayrshare sub-profile ──────────────────────────────────────────
    const apiKey = Deno.env.get("AYRSHARE_API_KEY");
    if (!apiKey) throw new Error("AYRSHARE_API_KEY is not configured");

    const ayrRes = await fetch(`${AYRSHARE_BASE}/profiles/profile`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: profile.practice_name || `Client ${profileUserId.slice(0, 8)}`,
      }),
    });

    if (!ayrRes.ok) {
      const errText = await ayrRes.text();
      throw new Error(`Ayrshare error ${ayrRes.status}: ${errText}`);
    }

    const ayrData = await ayrRes.json();
    const profileKey: string = ayrData.profileKey;
    if (!profileKey) throw new Error("Ayrshare did not return a profileKey");

    // ── Save profileKey to Supabase ──────────────────────────────────────────
    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ ayrshare_profile_id: profileKey })
      .eq("user_id", profileUserId);

    if (updateErr) throw new Error(`Failed to save profileKey: ${updateErr.message}`);

    return new Response(
      JSON.stringify({ profileKey, alreadyExisted: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ayrshare-create-profile]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
