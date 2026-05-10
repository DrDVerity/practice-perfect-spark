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

    const { parent_user_id, email, password, full_name } = await req.json();
    if (!parent_user_id || !email || !password) {
      throw new Error("parent_user_id, email and password are required");
    }
    if (password.length < 6) throw new Error("Password must be at least 6 characters");

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Look up the parent business profile to copy practice_name
    const { data: parent, error: parentErr } = await adminClient
      .from("profiles")
      .select("practice_name")
      .eq("user_id", parent_user_id)
      .maybeSingle();
    if (parentErr || !parent) throw new Error("Parent business account not found");

    // Create the auth user
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) throw new Error(createErr?.message || "Failed to create user");

    const newUserId = created.user.id;

    // The handle_new_user trigger may have created a profile already — update it
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", newUserId)
      .maybeSingle();

    if (existing) {
      await adminClient
        .from("profiles")
        .update({
          parent_account_id: parent_user_id,
          practice_name: parent.practice_name,
          full_name: full_name || null,
          email,
        })
        .eq("user_id", newUserId);
    } else {
      await adminClient.from("profiles").insert({
        user_id: newUserId,
        parent_account_id: parent_user_id,
        practice_name: parent.practice_name,
        full_name: full_name || null,
        email,
      });
    }

    // Ensure the 'user' role exists
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", newUserId)
      .eq("role", "user")
      .maybeSingle();
    if (!existingRole) {
      await adminClient.from("user_roles").insert({ user_id: newUserId, role: "user" });
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
