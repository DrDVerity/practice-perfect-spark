import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load campaign + owner profile + KB
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns").select("*").eq("id", campaignId).single();
    if (cErr || !campaign) throw new Error("Campaign not found");

    // Authorization
    const ownerId: string = campaign.user_id;
    let allowed = caller.id === ownerId;
    if (!allowed) {
      const { data: roleRow } = await supabase.from("user_roles")
        .select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (roleRow) allowed = true;
    }
    if (!allowed) {
      const { data: mgrRow } = await supabase.from("manager_assignments")
        .select("id").eq("manager_user_id", caller.id).eq("client_user_id", ownerId).maybeSingle();
      if (mgrRow) allowed = true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("practice_name, website_url, target_audience, campaign_focus, email")
      .eq("user_id", ownerId).single();

    const { data: kbDocs } = await supabase
      .from("knowledge_base").select("title, doc_type, content")
      .eq("user_id", ownerId).order("updated_at", { ascending: false }).limit(8);

    const kbExcerpt = (kbDocs || [])
      .map((d: any) => `[${d.title}]\n${(d.content || "").slice(0, 500)}`)
      .join("\n\n").slice(0, 4000);

    // Ask AI to produce a single self-contained HTML landing page
    const sys = `You are a senior conversion-focused web designer. Output a single complete, self-contained, mobile-responsive HTML5 document for a campaign landing page.
- Use inline <style> only (no external assets except images you may reference by https URL).
- Modern, minimal, polished. Use a hero with headline + subhead + primary CTA, value props (3 cards), social proof block, FAQ, and a contact / booking CTA section with a clearly-styled phone link and a call-to-action form (name, email, phone, preferred time). The form should POST to '#' (placeholder).
- Brand color: a calming dental-friendly blue. Use accessible contrast.
- Include schema.org JSON-LD for LocalBusiness/Dentist using the practice details when available.
- Set <title> and meta description tuned for SEO based on the campaign focus.
- DO NOT include markdown fences. Output ONLY the HTML starting with <!DOCTYPE html>.`;

    const user = `Practice: ${profile?.practice_name || "the practice"}
Website: ${profile?.website_url || ""}
Target audience: ${profile?.target_audience || campaign.name}
Campaign focus: ${profile?.campaign_focus || ""}
Campaign name: ${campaign.name}
Campaign strategy excerpt:
${(campaign.strategy || "").slice(0, 4000)}

Knowledge base excerpts:
${kbExcerpt}

Build the landing page now.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI failed: ${aiResp.status} ${t}`);
    }
    const aiData = await aiResp.json();
    let html: string = aiData.choices?.[0]?.message?.content || "";
    // Strip accidental fences
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html.toLowerCase().startsWith("<!doctype") && !html.toLowerCase().startsWith("<html")) {
      // Wrap a fallback shell
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${campaign.name}</title></head><body>${html}</body></html>`;
    }

    // Upload to public bucket: <ownerId>/<campaignId>.html
    const path = `${ownerId}/${campaignId}.html`;
    const { error: upErr } = await supabase.storage
      .from("landing-pages")
      .upload(path, new Blob([html], { type: "text/html; charset=utf-8" }), {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage.from("landing-pages").getPublicUrl(path);
    const url = pub.publicUrl;

    // Save URL on campaign
    await supabase.from("campaigns").update({ landing_page_url: url }).eq("id", campaignId);

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-landing-page error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
