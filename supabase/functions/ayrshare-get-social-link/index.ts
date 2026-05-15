/**
 * ayrshare-get-social-link
 *
 * Returns a short-lived Ayrshare Social Account Link URL so the client
 * can connect their own social accounts (Facebook, Instagram, etc.) via OAuth
 * without ever seeing the master API key.
 *
 * Called by: ChannelCredentialModal when the platform is a social network.
 *
 * POST body: { profileUserId?: string }
 *   If omitted, uses the calling user's own profile.
 *   Admins may pass a different profileUserId to generate a link for a client.
 *
 * Returns: { url: string }  ← open this in a new tab / popup
 *
 * Required env vars:
 *   AYRSHARE_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
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
    // ── Auth ──────────────────────────────────────────────────────────────────
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

    // ── Resolve which profile to generate the link for ────────────────────────
    const body = await req.json().catch(() => ({}));
    let targetUserId: string = caller.id;

    if (body.profileUserId && body.profileUserId !== caller.id) {
      // Only admins can generate links for other users
      const { data: isAdmin } = await callerClient.rpc("is_admin", { _user_id: caller.id });
      if (!isAdmin) throw new Error("Admin access required to generate links for other users");
      targetUserId = body.profileUserId;
    }

    // ── Fetch the ayrshare_profile_id ────────────────────────────────────────
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("ayrshare_profile_id, practice_name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (profErr || !profile) throw new Error("Profile not found");

    if (!profile.ayrshare_profile_id) {
      throw new Error(
        "This client does not have an Ayrshare profile yet. Create one first via the admin panel."
      );
    }

    // ── Generate JWT link from Ayrshare ──────────────────────────────────────
    const apiKey = Deno.env.get("AYRSHARE_API_KEY");
    if (!apiKey) throw new Error("AYRSHARE_API_KEY is not configured");

    const ayrRes = await fetch(`${AYRSHARE_BASE}/profiles/generateJWT`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Profile-Key": profile.ayrshare_profile_id,
      },
    });

    if (!ayrRes.ok) {
      const errText = await ayrRes.text();
      throw new Error(`Ayrshare error ${ayrRes.status}: ${errText}`);
    }

    const ayrData = await ayrRes.json();
    // Ayrshare returns { url: "https://app.ayrshare.com/..." }
    const url: string = ayrData.url;
    if (!url) throw new Error("Ayrshare did not return a social link URL");

    return new Response(
      JSON.stringify({ url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ayrshare-get-social-link]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
