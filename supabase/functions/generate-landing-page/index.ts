import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Brand {
  practiceName?: string;
  websiteUrl?: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  fonts: { heading: string; body: string };
  tone: string;
  voice: string;
  doNotUse: string[];
}

const DEFAULT_BRAND: Brand = {
  colors: { primary: "#1e40af", secondary: "#0f172a", accent: "#f59e0b", background: "#ffffff", text: "#0f172a" },
  fonts: { heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
  tone: "Professional, clear, benefit-driven.",
  voice: "First-person plural speaking to the reader.",
  doNotUse: [],
};

function esc(s: string) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId, placeholder } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns").select("*").eq("id", campaignId).single();
    if (cErr || !campaign) throw new Error("Campaign not found");

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
      .select("practice_name, website_url, target_audience, campaign_focus, email, account_id")
      .eq("user_id", ownerId).single();

    // Load brand guidelines — auto-generate if missing.
    let brand: Brand = { ...DEFAULT_BRAND, practiceName: profile?.practice_name || undefined, websiteUrl: profile?.website_url || undefined };
    let bgDoc = await supabase
      .from("knowledge_base")
      .select("content, metadata")
      .eq("user_id", ownerId)
      .eq("doc_type", "brand_guidelines")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!bgDoc.data) {
      try {
        await supabase.functions.invoke("generate-brand-guidelines", {
          body: { user_id: ownerId },
          headers: { Authorization: authHeader },
        });
        bgDoc = await supabase
          .from("knowledge_base")
          .select("content, metadata")
          .eq("user_id", ownerId)
          .eq("doc_type", "brand_guidelines")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      } catch (e) {
        console.warn("brand guidelines generation skipped:", e);
      }
    }
    const brandFromKb = (bgDoc.data?.metadata as any)?.brand as Brand | undefined;
    if (brandFromKb) brand = { ...brand, ...brandFromKb };

    // Blog extraction — pull the accepted blog from campaign.content_hub if present.
    const contentHub: any = (campaign as any).content_hub || {};
    const blogText: string =
      contentHub.blog?.content ||
      contentHub.blog?.article ||
      contentHub.blog ||
      "";

    // Prefer the accepted blog hero image as the landing-page hero background.
    // Falls back to any campaign-level hero URL captured earlier by the agent.
    const heroImage: string =
      contentHub.blog?.hero_image ||
      contentHub.blog?.image ||
      contentHub.blog?.image_url ||
      contentHub.hero_image ||
      (campaign as any).landing_hero_url ||
      "";

    let html: string | null = null;

    if (placeholder) {
      const safeName = esc(campaign.name || "Campaign");
      const safePractice = esc(brand.practiceName || "Our Practice");
      const safeFocus = esc(profile?.campaign_focus || "");
      html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName} — ${safePractice}</title></head><body style="font-family:${brand.fonts.body};margin:0;background:${brand.colors.background};color:${brand.colors.text}"><section style="min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:48px 24px;background:linear-gradient(135deg,${brand.colors.primary},${brand.colors.secondary});color:#fff"><div style="max-width:720px"><div style="text-transform:uppercase;letter-spacing:.18em;font-size:.8rem;opacity:.85;margin-bottom:12px">${safePractice}</div><h1 style="font-family:${brand.fonts.heading};font-size:clamp(2rem,5vw,3.5rem);margin:0 0 16px">${safeName}</h1>${safeFocus ? `<p style="font-size:1.15rem;opacity:.95">${safeFocus}</p>` : ""}<div style="margin-top:32px;font-size:.85rem;opacity:.8">Full landing page coming soon.</div></div></section></body></html>`;
    } else {
      // ------- Step 1: build a JSON Page Brief scoped by campaign focus + audience -------
      const briefSys = `You are a direct-response copy strategist. Return STRICT JSON only.
Given a campaign, its strategic plan, and a blog article, produce a page brief with:
{
  "headline": string,           // <90 chars, benefit-led
  "subheadline": string,        // <160 chars, targets the audience
  "valueProp": string,          // one sentence
  "primaryCtaLabel": string,    // action verb specific to the campaign
  "keyPoints": string[],        // 4-6 concise
  "features": {name:string,benefit:string}[], // 4-6, benefit must reference the target audience
  "socialProof": string[],      // 0-3 quotes; leave empty if none in inputs
  "faq": {q:string,a:string}[], // 3-5
  "trustBullets": string[]      // 3 short trust items (e.g. HIPAA, credentials)
}
Rules:
- Everything must be tightly on-topic with the campaign focus and target audience. Do NOT drift into generic dental copy if the campaign is about a specific product, study, service or offer.
- Never invent statistics or testimonials that are not present in the inputs.`;
      const briefUsr = `Business: ${profile?.practice_name || ""}
Focus: ${profile?.campaign_focus || ""}
Target audience: ${(campaign as any).target_audience || profile?.target_audience || ""}
Campaign name: ${campaign.name}

Strategic plan (authoritative):
${((campaign as any).strategy || "").slice(0, 5000)}

Blog article (source for key points, features, benefits, objections/FAQ):
${blogText.slice(0, 8000)}
`;
      let brief: any = null;
      try {
        const briefResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: briefSys }, { role: "user", content: briefUsr }],
            response_format: { type: "json_object" },
            max_tokens: 1400,
          }),
        });
        if (briefResp.ok) {
          const bj = await briefResp.json();
          brief = JSON.parse(bj.choices?.[0]?.message?.content || "{}");
        }
      } catch (e) {
        console.warn("Brief generation failed:", e);
      }
      brief = brief || {
        headline: campaign.name,
        subheadline: profile?.campaign_focus || "",
        valueProp: profile?.campaign_focus || "",
        primaryCtaLabel: "Get in touch",
        keyPoints: [],
        features: [],
        socialProof: [],
        faq: [],
        trustBullets: [],
      };

      // ------- Step 2: render deterministic HTML using brand tokens + brief -------
      const phone = brand.phone;
      const telHref = phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : null;
      const practiceName = brand.practiceName || "Our Practice";
      const ctaLabel = esc(brief.primaryCtaLabel || "Get in touch");
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: practiceName,
        url: brand.websiteUrl,
        telephone: phone || undefined,
        address: brand.address || undefined,
      };
      const featuresHtml = (brief.features || []).map((f: any) => `
        <div class="feature">
          <h3>${esc(f.name || "")}</h3>
          <p>${esc(f.benefit || "")}</p>
        </div>`).join("");
      const keyPointsHtml = (brief.keyPoints || []).map((k: string) => `<li>${esc(k)}</li>`).join("");
      const proofHtml = (brief.socialProof || []).map((q: string) => `<blockquote>&ldquo;${esc(q)}&rdquo;</blockquote>`).join("");
      const faqHtml = (brief.faq || []).map((f: any) => `
        <details>
          <summary>${esc(f.q || "")}</summary>
          <p>${esc(f.a || "")}</p>
        </details>`).join("");
      const trustHtml = (brief.trustBullets || []).map((t: string) => `<span class="trust-pill">${esc(t)}</span>`).join("");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const leadEndpoint = `${supabaseUrl}/functions/v1/landing-page-lead`;

      html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brief.headline || campaign.name)} — ${esc(practiceName)}</title>
<meta name="description" content="${esc(brief.subheadline || "")}">
<meta property="og:title" content="${esc(brief.headline || campaign.name)}">
<meta property="og:description" content="${esc(brief.subheadline || "")}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(brand.websiteUrl || "")}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root {
    --c-primary: ${brand.colors.primary};
    --c-secondary: ${brand.colors.secondary};
    --c-accent: ${brand.colors.accent};
    --c-bg: ${brand.colors.background};
    --c-text: ${brand.colors.text};
    --font-h: ${brand.fonts.heading};
    --font-b: ${brand.fonts.body};
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font-family: var(--font-b); color: var(--c-text); background: var(--c-bg); line-height: 1.6; }
  h1, h2, h3 { font-family: var(--font-h); line-height: 1.15; margin: 0 0 .5em; color: var(--c-secondary); }
  h1 { font-size: clamp(2.2rem, 5vw, 3.75rem); }
  h2 { font-size: clamp(1.75rem, 3.5vw, 2.5rem); }
  a { color: var(--c-primary); }
  .container { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
  .btn { display: inline-block; padding: 16px 30px; border-radius: 999px; font-weight: 700; text-decoration: none; border: 0; cursor: pointer; font-size: 1rem; transition: transform .15s ease, box-shadow .15s ease; }
  .btn-primary { background: var(--c-accent); color: #111; box-shadow: 0 8px 24px rgba(0,0,0,.18); }
  .btn-primary:hover { transform: translateY(-2px); }
  .btn-outline { background: transparent; color: #fff; border: 2px solid rgba(255,255,255,.6); }
  header.hero { color: #fff; background: linear-gradient(135deg, var(--c-primary), var(--c-secondary)); padding: 96px 0 88px; text-align: center; position: relative; overflow: hidden; }
  ${heroImage ? `header.hero { background-image: linear-gradient(135deg, color-mix(in srgb, var(--c-primary) 78%, transparent), color-mix(in srgb, var(--c-secondary) 78%, transparent)), url("${esc(heroImage)}"); background-size: cover; background-position: center; }` : ""}
  header.hero h1 { color: #fff; }
  header.hero p.sub { font-size: clamp(1.05rem, 1.8vw, 1.3rem); opacity: .95; max-width: 720px; margin: 0 auto 32px; }
  .cta-row { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .trust-strip { margin-top: 32px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .trust-pill { background: rgba(255,255,255,.15); color: #fff; padding: 6px 14px; border-radius: 999px; font-size: .85rem; }
  section { padding: 72px 0; }
  section.alt { background: #f8fafc; }
  .grid { display: grid; gap: 24px; }
  .grid-3 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .feature { background: #fff; padding: 28px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(15,23,42,.04); }
  .feature h3 { color: var(--c-primary); font-size: 1.2rem; }
  .keypoints { list-style: none; padding: 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .keypoints li { padding: 16px 20px; background: #fff; border-left: 4px solid var(--c-accent); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  blockquote { border-left: 4px solid var(--c-accent); margin: 0 0 20px; padding: 8px 20px; font-style: italic; color: var(--c-secondary); background: #fff; border-radius: 8px; }
  details { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; }
  details summary { font-weight: 600; cursor: pointer; color: var(--c-secondary); }
  details p { margin: 12px 0 0; }
  form.contact { background: #fff; padding: 32px; border-radius: 20px; box-shadow: 0 10px 40px rgba(15,23,42,.08); max-width: 560px; margin: 0 auto; }
  form.contact label { display: block; font-weight: 600; margin-bottom: 6px; color: var(--c-secondary); }
  form.contact input, form.contact textarea { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font: inherit; margin-bottom: 16px; }
  form.contact textarea { min-height: 120px; resize: vertical; }
  form.contact button { width: 100%; }
  .form-note { text-align: center; font-size: .85rem; color: #64748b; margin-top: 12px; }
  .final-cta { background: linear-gradient(135deg, var(--c-secondary), var(--c-primary)); color: #fff; text-align: center; }
  .final-cta h2 { color: #fff; }
  .final-cta .phone-line { font-size: 1.4rem; margin: 12px 0 24px; }
  .final-cta .phone-line a { color: var(--c-accent); text-decoration: none; font-weight: 700; }
  footer { background: #0f172a; color: #cbd5e1; padding: 40px 0; font-size: .9rem; text-align: center; }
  footer a { color: var(--c-accent); }
  @media (max-width: 640px) { section { padding: 56px 0; } header.hero { padding: 72px 0 64px; } }
</style>
</head>
<body>

<header class="hero" id="top">
  <div class="container">
    ${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="${esc(practiceName)} logo" style="max-height:56px;margin-bottom:24px" loading="lazy">` : ""}
    <h1>${esc(brief.headline || campaign.name)}</h1>
    <p class="sub">${esc(brief.subheadline || "")}</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="#contact">${ctaLabel}</a>
      ${telHref ? `<a class="btn btn-outline" href="${telHref}">📞 Call ${esc(phone!)}</a>` : ""}
    </div>
    ${trustHtml ? `<div class="trust-strip">${trustHtml}</div>` : ""}
  </div>
</header>

${keyPointsHtml ? `
<section>
  <div class="container">
    <h2 style="text-align:center;margin-bottom:32px">Why this matters</h2>
    <ul class="keypoints">${keyPointsHtml}</ul>
  </div>
</section>` : ""}

${featuresHtml ? `
<section class="alt">
  <div class="container">
    <h2 style="text-align:center;margin-bottom:40px">What you get</h2>
    <div class="grid grid-3">${featuresHtml}</div>
  </div>
</section>` : ""}

${proofHtml ? `
<section>
  <div class="container" style="max-width:820px">
    <h2 style="text-align:center;margin-bottom:32px">What people say</h2>
    ${proofHtml}
  </div>
</section>` : ""}

${faqHtml ? `
<section class="alt">
  <div class="container" style="max-width:820px">
    <h2 style="text-align:center;margin-bottom:32px">Frequently asked</h2>
    ${faqHtml}
  </div>
</section>` : ""}

<section class="final-cta" id="contact">
  <div class="container" style="max-width:820px">
    <h2>${esc(brief.valueProp || brief.headline || "Ready to get started?")}</h2>
    ${telHref ? `<div class="phone-line">Prefer to talk? <a href="${telHref}">${esc(phone!)}</a></div>` : ""}
    <form class="contact" id="lead-form" novalidate>
      <label for="lf-name">Name</label>
      <input id="lf-name" name="name" required autocomplete="name">
      <label for="lf-email">Email</label>
      <input id="lf-email" name="email" type="email" required autocomplete="email">
      <label for="lf-phone">Phone</label>
      <input id="lf-phone" name="phone" type="tel" autocomplete="tel">
      <label for="lf-message">How can we help?</label>
      <textarea id="lf-message" name="message"></textarea>
      <button type="submit" class="btn btn-primary">${ctaLabel}</button>
      <div class="form-note" id="lf-note">We reply within one business day.</div>
    </form>
  </div>
</section>

<footer>
  <div class="container">
    <div>© ${new Date().getFullYear()} ${esc(practiceName)}${brand.address ? " · " + esc(brand.address) : ""}</div>
    ${brand.websiteUrl ? `<div style="margin-top:6px"><a href="${esc(brand.websiteUrl)}">${esc(brand.websiteUrl)}</a></div>` : ""}
  </div>
</footer>

<script>
(function(){
  var form = document.getElementById('lead-form');
  var note = document.getElementById('lf-note');
  var endpoint = ${JSON.stringify(leadEndpoint)};
  var campaignId = ${JSON.stringify(campaignId)};
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var data = {
      campaign_id: campaignId,
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      message: form.message.value,
      source_url: window.location.href
    };
    if (!data.email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.email)) {
      note.textContent = 'Please enter a valid email address.';
      note.style.color = '#b91c1c';
      return;
    }
    note.textContent = 'Sending...';
    note.style.color = '';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(res){
        if (res.ok) {
          form.innerHTML = '<h3 style="text-align:center;color:var(--c-primary)">Thanks — we\\'ll be in touch shortly.</h3>';
        } else {
          note.textContent = res.j && res.j.error ? res.j.error : 'Something went wrong. Please try again.';
          note.style.color = '#b91c1c';
        }
      })
      .catch(function(){
        note.textContent = 'Network error. Please try again.';
        note.style.color = '#b91c1c';
      });
  });
})();
</script>

</body>
</html>`;
    }

    if (!html) throw new Error("Failed to build landing page HTML");

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
