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
    const { campaignId, placeholder } = await req.json();
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

    let html: string | null = null;

    if (placeholder) {
      // Generate a hero image only and wrap in a minimal "coming soon" page.
      const heroPrompt = `Hero marketing image for a dental practice campaign titled "${campaign.name}". ${profile?.campaign_focus ? `Focus: ${profile.campaign_focus}.` : ""} Bright, welcoming, modern dental office aesthetic. Photorealistic, no text overlays.`;
      let heroDataUrl: string | null = null;
      try {
        const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: heroPrompt }],
            modalities: ["image", "text"],
          }),
        });
        if (imgResp.ok) {
          const imgData = await imgResp.json();
          heroDataUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
        } else {
          console.warn("Placeholder hero image failed:", imgResp.status);
        }
      } catch (e) {
        console.warn("Placeholder hero image error:", e);
      }

      const safeName = (campaign.name || "Campaign").replace(/</g, "&lt;");
      const safePractice = (profile?.practice_name || "Our Practice").replace(/</g, "&lt;");
      const safeFocus = (profile?.campaign_focus || "").replace(/</g, "&lt;");
      const heroBg = heroDataUrl
        ? `background-image: linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.55)), url('${heroDataUrl}'); background-size: cover; background-position: center;`
        : `background: linear-gradient(135deg, hsl(210 60% 55%), hsl(210 60% 35%));`;
      html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName} — ${safePractice}</title><meta name="description" content="${safeFocus || safeName} — coming soon."><style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a}
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;padding:24px;${heroBg}}
.hero-inner{max-width:760px}
.eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:.8rem;opacity:.85;margin-bottom:12px}
h1{font-size:clamp(2rem,5vw,3.5rem);margin:0 0 16px;line-height:1.1}
p.lead{font-size:clamp(1rem,2vw,1.25rem);opacity:.95;margin:0 0 28px}
.cta{display:inline-block;background:#fff;color:#0f172a;padding:14px 28px;border-radius:999px;font-weight:600;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.note{margin-top:32px;font-size:.85rem;opacity:.8}
</style></head><body><section class="hero"><div class="hero-inner">
<div class="eyebrow">${safePractice}</div>
<h1>${safeName}</h1>
${safeFocus ? `<p class="lead">${safeFocus}</p>` : `<p class="lead">Something great is coming soon.</p>`}
<a class="cta" href="#contact">Get in touch</a>
<div class="note">Placeholder landing page — full design coming soon.</div>
</div></section></body></html>`;
    } else {
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
    let aiHtml: string = aiData.choices?.[0]?.message?.content || "";
    aiHtml = aiHtml.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!aiHtml.toLowerCase().startsWith("<!doctype") && !aiHtml.toLowerCase().startsWith("<html")) {
      aiHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${campaign.name}</title></head><body>${aiHtml}</body></html>`;
    }
    html = aiHtml;
    }

    if (!html) throw new Error("Failed to build landing page HTML");

    // Serve via the serve-landing-page edge function. Public Supabase Storage
    // forces HTML to text/plain + sandbox CSP, so we cannot host the HTML
    // there for direct browser rendering. The edge function reads
    // landing_page_html from this row and returns it with the correct
    // Content-Type: text/html so browsers render it.
    // Serve via a SPA route in the published app. The route fetches the HTML
    // from serve-landing-page and renders it inside a sandboxed iframe.
    // Supabase Edge Functions force `text/plain` + sandbox CSP on
    // unauthenticated browser GETs, so direct hosting is not viable.
    const url = `https://practice-perfect-spark.lovable.app/landing/${campaignId}`;

    const { error: updErr } = await supabase
      .from("campaigns")
      .update({ landing_page_html: html, landing_page_url: url })
      .eq("id", campaignId);
    if (updErr) throw new Error(`Save failed: ${updErr.message}`);

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
