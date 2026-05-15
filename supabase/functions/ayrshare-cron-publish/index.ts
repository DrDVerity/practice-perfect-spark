/**
 * ayrshare-cron-publish
 *
 * Lightweight cron-triggered function that fires every minute and sweeps
 * channel_posts where:
 *   status = 'scheduled'
 *   scheduled_start <= now()
 *   ayrshare_post_id IS NULL
 *   publish_error IS NULL
 *
 * It delegates the actual publishing to ayrshare-publish-post so all
 * publish logic lives in one place.
 *
 * Set this up in Supabase Dashboard → Database → Extensions → pg_cron:
 *
 *   SELECT cron.schedule(
 *     'ayrshare-cron-publish',
 *     '* * * * *',
 *     $$
 *     SELECT net.http_post(
 *       url  := 'https://<project-ref>.supabase.co/functions/v1/ayrshare-cron-publish',
 *       body := '{}',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer <service-role-key>'
 *       )
 *     );
 *     $$
 *   );
 *
 * No env vars needed beyond what ayrshare-publish-post already uses.
 * This function itself only needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * to call the sibling function.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Call the publish function with cron trigger mode
    const res = await fetch(`${supabaseUrl}/functions/v1/ayrshare-publish-post`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "cron" }),
    });

    const data = await res.json();
    console.log("[ayrshare-cron-publish]", JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[ayrshare-cron-publish]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
