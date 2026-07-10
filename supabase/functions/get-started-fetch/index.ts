/**
 * get-started-fetch  (public — no auth)
 * Returns the prospect account, reports, and generated campaign payload
 * for the preview page.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { prospectId } = await req.json();
    if (!prospectId) throw new Error("prospectId required");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: account }, { data: reports }, { data: campaign }] = await Promise.all([
      admin.from("prospect_accounts")
        .select("id, email, practice_name, website_url, campaign_focus, target_audience, status, error")
        .eq("id", prospectId).maybeSingle(),
      admin.from("prospect_reports")
        .select("doc_type, title, content, metadata")
        .eq("prospect_id", prospectId),
      admin.from("prospect_campaigns")
        .select("blog_title, blog_html, hero_image_url, illustrations, posts, email_funnel")
        .eq("prospect_id", prospectId).maybeSingle(),
    ]);

    return new Response(JSON.stringify({ account, reports: reports || [], campaign }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
