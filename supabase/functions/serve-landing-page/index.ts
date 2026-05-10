import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Accept ?id=<campaignId> or trailing path /<campaignId>
    let id = url.searchParams.get("id") || "";
    if (!id) {
      const parts = url.pathname.split("/").filter(Boolean);
      id = parts[parts.length - 1] || "";
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("campaigns")
      .select("landing_page_html, landing_page_url, name")
      .eq("id", id)
      .maybeSingle();

    if (error || !data || !data.landing_page_html) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Not found</title></head><body style="font-family:sans-serif;text-align:center;padding:80px"><h1>Landing page not found</h1></body></html>`,
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    // Edge function responses are wrapped in a sandbox CSP that prevents
    // browsers from rendering HTML. Upload the HTML to public storage (which
    // serves a proper text/html content-type without sandbox headers) and
    // redirect there.
    const objectPath = `${id}/index.html`;
    const { error: upErr } = await supabase.storage
      .from("landing-pages")
      .upload(objectPath, new Blob([data.landing_page_html], { type: "text/html; charset=utf-8" }), {
        contentType: "text/html; charset=utf-8",
        upsert: true,
        cacheControl: "60",
      });
    if (upErr) {
      console.error("storage upload failed", upErr);
    }
    const { data: pub } = supabase.storage.from("landing-pages").getPublicUrl(objectPath);
    const target = pub.publicUrl;

    // Persist the new URL so future clicks skip this function entirely.
    await supabase.from("campaigns").update({ landing_page_url: target }).eq("id", id);

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: target },
    });
  } catch (e) {
    return new Response(
      `<!DOCTYPE html><html><body><pre>${e instanceof Error ? e.message : "error"}</pre></body></html>`,
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
    );
  }
});
