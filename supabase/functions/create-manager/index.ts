import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Only admins can create managers");

    const { email, password, practice_name } = await req.json();
    if (!email || !password) throw new Error("Email and password required");

    let userId: string | null = null;

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      // If user already exists, find them and promote to manager
      const msg = (createErr.message || "").toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("registered");
      if (!alreadyExists) throw new Error(createErr.message);

      // Look up existing user by paginating (admin.listUsers has no email filter)
      let page = 1;
      while (!userId) {
        const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) throw new Error(listErr.message);
        const match = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (match) { userId = match.id; break; }
        if (list.users.length < 200) break;
        page++;
      }
      if (!userId) throw new Error("User exists but could not be located");
    } else {
      userId = created.user.id;
    }

    // Ensure profile exists
    const { data: existingProfile } = await adminClient
      .from("profiles").select("id, practice_name").eq("user_id", userId).maybeSingle();
    if (!existingProfile) {
      await adminClient.from("profiles").insert({
        user_id: userId,
        email,
        practice_name: practice_name || null,
      });
    } else if (practice_name && !existingProfile.practice_name?.trim()) {
      await adminClient.from("profiles").update({ practice_name }).eq("user_id", userId);
    }

    // Ensure manager role (avoid duplicate)
    const { data: existingRole } = await adminClient
      .from("user_roles").select("id").eq("user_id", userId).eq("role", "manager").maybeSingle();
    if (!existingRole) {
      await adminClient.from("user_roles").insert({
        user_id: userId,
        role: "manager",
      });
    }

    // Remove 'user' role since they're now a manager
    await adminClient.from("user_roles").delete().eq("user_id", userId).eq("role", "user");

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
