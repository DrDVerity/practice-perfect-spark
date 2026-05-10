import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Permanently removes accounts soft-deleted for 30+ days.
// Triggered by pg_cron daily.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stale, error } = await adminClient
      .from("profiles")
      .select("user_id")
      .lt("deleted_at", cutoff);
    if (error) throw error;

    const purged: string[] = [];
    for (const row of stale || []) {
      const uid = (row as any).user_id;
      try {
        await adminClient.from("campaigns").delete().eq("user_id", uid);
        await adminClient.from("knowledge_base").delete().eq("user_id", uid);
        await adminClient.from("channel_credentials").delete().eq("user_id", uid);
        await adminClient.from("user_roles").delete().eq("user_id", uid);
        await adminClient.from("profiles").delete().eq("user_id", uid);
        await adminClient.auth.admin.deleteUser(uid);
        purged.push(uid);
      } catch (e) {
        console.error("purge failed for", uid, e);
      }
    }

    return new Response(JSON.stringify({ success: true, purged_count: purged.length, purged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
