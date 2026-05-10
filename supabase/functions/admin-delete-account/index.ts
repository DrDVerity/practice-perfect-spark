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

    const { user_id, mode } = await req.json();
    if (!user_id) throw new Error("user_id required");

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (mode === "restore") {
      await adminClient.from("profiles").update({ deleted_at: null }).eq("user_id", user_id);
      // Unban the auth user
      await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "none" } as any);
      return new Response(JSON.stringify({ success: true, action: "restored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "purge") {
      // Hard delete: campaigns cascade via app cleanup, then profile, then auth user
      await adminClient.from("campaigns").delete().eq("user_id", user_id);
      await adminClient.from("knowledge_base").delete().eq("user_id", user_id);
      await adminClient.from("channel_credentials").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("user_id", user_id);
      await adminClient.auth.admin.deleteUser(user_id);
      return new Response(JSON.stringify({ success: true, action: "purged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: soft-delete (recoverable for 30 days)
    const deletedAt = new Date().toISOString();
    const { error: upErr } = await adminClient
      .from("profiles")
      .update({ deleted_at: deletedAt })
      .eq("user_id", user_id);
    if (upErr) throw upErr;

    // Ban the auth user for ~365 days so they can't sign in while soft-deleted
    await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "8760h" } as any);

    return new Response(JSON.stringify({ success: true, action: "soft_deleted", deleted_at: deletedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
