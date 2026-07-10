import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BrandJson {
  practiceName?: string;
  websiteUrl?: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: { heading: string; body: string };
  tone: string;
  voice: string;
  doNotUse: string[];
}

const DEFAULT_BRAND: BrandJson = {
  colors: {
    primary: "#1e40af",
    secondary: "#0f172a",
    accent: "#f59e0b",
    background: "#ffffff",
    text: "#0f172a",
  },
  fonts: { heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
  tone: "Professional, clear, benefit-driven.",
  voice: "First-person plural (we/our) speaking directly to the target reader.",
  doNotUse: ["Overly clinical jargon", "Empty superlatives", "Generic stock phrases"],
};

const PHONE_REGEX = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/g;

function extractPhone(text: string): string | null {
  if (!text) return null;
  const telMatch = text.match(/tel:([+\d\s.\-()]{7,})/i);
  if (telMatch) return telMatch[1].trim();
  const m = text.match(PHONE_REGEX);
  return m ? m[0] : null;
}

async function firecrawlBranding(url: string) {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key || !url) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", "branding", "links"],
        onlyMainContent: false,
      }),
    });
    if (!res.ok) {
      console.warn("Firecrawl scrape failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn("Firecrawl error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string = body?.user_id || caller.id;

    // Authorization: self, admin, or manager of client
    let allowed = caller.id === targetUserId;
    if (!allowed) {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (roleRow) allowed = true;
    }
    if (!allowed) {
      const { data: mgr } = await supabase
        .from("manager_assignments").select("id")
        .eq("manager_user_id", caller.id).eq("client_user_id", targetUserId).maybeSingle();
      if (mgr) allowed = true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("practice_name, website_url, target_audience, campaign_focus, email, account_id")
      .eq("user_id", targetUserId)
      .single();

    if (!profile?.account_id) {
      return new Response(JSON.stringify({ error: "Profile has no account_id yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let brand: BrandJson = { ...DEFAULT_BRAND };
    brand.practiceName = profile.practice_name || undefined;
    brand.websiteUrl = profile.website_url || undefined;

    const scrape = profile.website_url ? await firecrawlBranding(profile.website_url) : null;
    const scrapeBranding = scrape?.data?.branding || scrape?.branding;
    const scrapeMarkdown: string = scrape?.data?.markdown || scrape?.markdown || "";

    if (scrapeBranding) {
      if (scrapeBranding.logo) brand.logoUrl = scrapeBranding.logo;
      const c = scrapeBranding.colors || {};
      brand.colors = {
        primary: c.primary || brand.colors.primary,
        secondary: c.secondary || brand.colors.secondary,
        accent: c.accent || brand.colors.accent,
        background: c.background || brand.colors.background,
        text: c.textPrimary || brand.colors.text,
      };
      const fams = scrapeBranding.typography?.fontFamilies || {};
      if (fams.heading) brand.fonts.heading = `${fams.heading}, ${brand.fonts.heading}`;
      if (fams.primary || fams.body) brand.fonts.body = `${fams.primary || fams.body}, ${brand.fonts.body}`;
    }

    brand.phone = extractPhone(scrapeMarkdown);

    // Ask AI to fill tone/voice/doNotUse based on the scraped copy + profile.
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (OPENROUTER_API_KEY) {
      const sys = `You extract brand tone-of-voice guidelines from a business's own website copy and profile. Output STRICT JSON with keys: tone (string, 1 sentence), voice (string, 1 sentence), doNotUse (array of 3-6 short strings). No markdown, no prose.`;
      const usr = `Business: ${profile.practice_name || ""}
Focus / offering: ${profile.campaign_focus || ""}
Target audience: ${profile.target_audience || ""}
Website copy (excerpt):
${(scrapeMarkdown || "").slice(0, 4000)}

Return JSON only.`;
      try {
        const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
            response_format: { type: "json_object" },
            max_tokens: 600,
          }),
        });
        if (aiResp.ok) {
          const j = await aiResp.json();
          const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
          if (parsed.tone) brand.tone = String(parsed.tone);
          if (parsed.voice) brand.voice = String(parsed.voice);
          if (Array.isArray(parsed.doNotUse) && parsed.doNotUse.length) brand.doNotUse = parsed.doNotUse.map(String);
        }
      } catch (e) {
        console.warn("Tone AI failed:", e);
      }
    }

    // Build a human-readable markdown doc
    const md = `# Brand Guidelines — ${brand.practiceName || "Practice"}

Auto-generated on ${new Date().toISOString().slice(0, 10)}. Source: ${brand.websiteUrl || "profile"}.

## Contact
- Phone: ${brand.phone || "(not found)"}
- Website: ${brand.websiteUrl || "—"}

## Colors
- Primary: ${brand.colors.primary}
- Secondary: ${brand.colors.secondary}
- Accent: ${brand.colors.accent}
- Background: ${brand.colors.background}
- Text: ${brand.colors.text}

## Fonts
- Heading: ${brand.fonts.heading}
- Body: ${brand.fonts.body}

## Voice
${brand.voice}

## Tone
${brand.tone}

## Do NOT use
${brand.doNotUse.map((d) => `- ${d}`).join("\n")}

---

BRAND_JSON:
\`\`\`json
${JSON.stringify(brand, null, 2)}
\`\`\`
`;

    // Upsert: delete existing brand_guidelines for user, insert fresh
    await supabase
      .from("knowledge_base")
      .delete()
      .eq("user_id", targetUserId)
      .eq("doc_type", "brand_guidelines");

    const { error: insErr } = await supabase.from("knowledge_base").insert({
      user_id: targetUserId,
      account_id: profile.account_id,
      title: `Brand Guidelines — ${brand.practiceName || "Practice"}`,
      doc_type: "brand_guidelines",
      content: md,
      metadata: { brand, auto_generated: true, source_url: brand.websiteUrl },
      scope: "group",
    } as any);
    if (insErr) throw new Error(`KB insert failed: ${insErr.message}`);

    return new Response(JSON.stringify({ success: true, brand }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-brand-guidelines error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
