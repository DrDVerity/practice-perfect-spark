import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { practice_name, email, website_url, target_audience, campaign_focus } = await req.json();
    if (!practice_name?.trim()) throw new Error("practice_name is required");

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Create a placeholder auth user so the profile FK is satisfied.
    // Use a random email if none provided so we never collide.
    const placeholderEmail =
      email?.trim() ||
      `client-${crypto.randomUUID().slice(0, 8)}@placeholder.archer.local`;
    const placeholderPassword = crypto.randomUUID() + crypto.randomUUID();

    let newUserId: string;
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: placeholderEmail,
      password: placeholderPassword,
      email_confirm: true,
      user_metadata: { admin_created: true, practice_name },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message || "Failed to create auth user";
      const isDup = /already been registered|already exists|email_exists/i.test(msg);
      if (!isDup) throw new Error(msg);

      // Duplicate email — try to reuse the existing auth user if it has no real profile yet.
      let existingUserId: string | null = null;
      for (let page = 1; page <= 20 && !existingUserId; page++) {
        const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) break;
        const found = list?.users?.find((u) => (u.email || "").toLowerCase() === placeholderEmail.toLowerCase());
        if (found) existingUserId = found.id;
        if (!list?.users || list.users.length < 200) break;
      }

      if (!existingUserId) {
        return new Response(JSON.stringify({ error: "An account with this email already exists." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id, practice_name")
        .eq("user_id", existingUserId)
        .maybeSingle();

      if (existingProfile?.practice_name && existingProfile.practice_name.trim() !== "") {
        return new Response(
          JSON.stringify({ error: `An account with email ${placeholderEmail} already exists (${existingProfile.practice_name}).` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      newUserId = existingUserId;
    } else {
      newUserId = created.user.id;
    }

    // The handle_new_user trigger may have inserted a basic profile already.
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", newUserId)
      .maybeSingle();

    const profilePayload = {
      practice_name,
      email: email || placeholderEmail,
      website_url: website_url || null,
      target_audience: target_audience || null,
      campaign_focus: campaign_focus || null,
    };

    if (existing) {
      const { error: updErr } = await adminClient
        .from("profiles")
        .update(profilePayload)
        .eq("user_id", newUserId);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: insErr } = await adminClient
        .from("profiles")
        .insert({ user_id: newUserId, ...profilePayload });
      if (insErr) throw new Error(insErr.message);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
