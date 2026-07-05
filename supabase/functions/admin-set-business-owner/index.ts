import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Only admins can perform this action");

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id required");

    // Get memberships
    const { data: memberships, error: memErr } = await admin
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", user_id);
    if (memErr) throw new Error(memErr.message);
    if (!memberships || memberships.length === 0) throw new Error("User has no account memberships");

    const accountIds = memberships.map((m) => m.account_id);

    // Upgrade all memberships to owner
    const { error: upErr } = await admin
      .from("account_members")
      .update({ role: "owner" })
      .eq("user_id", user_id);
    if (upErr) throw new Error(upErr.message);

    // Set accounts.owner_user_id where currently null or for their primary account
    const { error: acctErr } = await admin
      .from("accounts")
      .update({ owner_user_id: user_id })
      .in("id", accountIds);
    if (acctErr) throw new Error(acctErr.message);

    return new Response(JSON.stringify({ success: true, accounts_updated: accountIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
