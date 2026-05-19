/**
 * bundle-social-cron-publish
 *
 * Cron-triggered sweep that delegates to bundle-social-publish-post in cron mode.
 *
 *   SELECT cron.schedule(
 *     'bundle-social-cron-publish',
 *     '* * * * *',
 *     $$
 *     SELECT net.http_post(
 *       url := 'https://<project-ref>.supabase.co/functions/v1/bundle-social-cron-publish',
 *       body := '{}',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer <service-role-key>'
 *       )
 *     );
 *     $$
 *   );
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

    const res = await fetch(`${supabaseUrl}/functions/v1/bundle-social-publish-post`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "cron" }),
    });

    const data = await res.json();
    console.log("[bundle-social-cron-publish]", JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[bundle-social-cron-publish]", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
