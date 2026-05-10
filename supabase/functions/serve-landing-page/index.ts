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
      .select("landing_page_html, name")
      .eq("id", id)
      .maybeSingle();

    if (error || !data || !data.landing_page_html) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Not found</title></head><body style="font-family:sans-serif;text-align:center;padding:80px"><h1>Landing page not found</h1></body></html>`,
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    return new Response(data.landing_page_html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return new Response(
      `<!DOCTYPE html><html><body><pre>${e instanceof Error ? e.message : "error"}</pre></body></html>`,
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
    );
  }
});
