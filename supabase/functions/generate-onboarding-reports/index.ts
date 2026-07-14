/**
 * generate-onboarding-reports
 *
 * One-shot research suite for a newly onboarded practice. Triggered once the
 * practice has (a) a website URL on their profile and (b) at least one connected
 * social account on their Bundle.social team.
 *
 * It scrapes the practice website, gathers online reviews and nearby competitors
 * (Firecrawl), inspects the connected social accounts, then generates the full
 * report set and upserts each into the practice knowledge base:
 *
 *   1.  Practice Intelligence Report        (market_analysis)
 *   2.  Competitive Landscape Report        (competitive_landscape)
 *   3.  Market Analysis Report              (market_analysis)
 *   4.  Target Audience Analysis            (audience_analysis)
 *   5.  Audience Analysis Report            (audience_analysis)
 *   6.  Demographics Report                 (demographics)
 *   7.  Brand Guidelines Report             (brand_guidelines)
 *   8.  Reputation & Sentiment Analysis     (reputation_sentiment)  — reviews only
 *   9.  Detailed Business DNA               (business_dna)
 *   10. Social Media                        (social_media)          — tone/voice/sentiment
 *
 * The work runs in the background (EdgeRuntime.waitUntil); the request returns
 * 202 immediately. Progress is tracked on profiles.onboarding_reports_*.
 *
 * POST body: { userId?: string, force?: boolean }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertKBDoc } from "../_shared/kb-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUNDLE_BASE = "https://api.bundle.social/api/v1";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const RUNNING_STALE_MS = 15 * 60 * 1000; // re-allow a stuck "running" after 15 min

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBundleApiKey = () => {
  const raw = Deno.env.get("BUNDLE_SOCIAL_API_KEY")?.trim();
  if (!raw) return undefined;
  const explicitMatch = raw.match(/(?:BUNDLE_SOCIAL_API_KEY|x-api-key|apiKey)[\s"':=]+([^\s"'`,}]+)/i);
  return (explicitMatch?.[1] || raw)
    .trim()
    .replace(/^["'`“”‘’]|["'`“”‘’]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/[\s​-‍﻿]/g, "")
    .trim();
};

const truncate = (s: string, max: number) =>
  s.length > max ? s.substring(0, max) + "\n[...truncated]" : s;

interface SocialAccount {
  type: string;
  username?: string;
  displayName?: string;
}

// ---- Firecrawl helpers -----------------------------------------------------

async function firecrawlScrape(apiKey: string, url: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.startsWith("http") ? url : `https://${url}`,
        formats: ["markdown"],
        onlyMainContent: false,
      }),
    });
    const data = await res.json();
    return data?.data?.markdown || data?.markdown || "";
  } catch (e) {
    console.error("firecrawlScrape failed", e);
    return "";
  }
}

async function firecrawlSearch(apiKey: string, query: string, limit = 5): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
    });
    const data = await res.json();
    const results = data?.data || [];
    return results
      .map((r: any) => `Source: ${r.url}\nTitle: ${r.title}\n${r.markdown || r.description || ""}`)
      .join("\n\n---\n\n");
  } catch (e) {
    console.error("firecrawlSearch failed", e);
    return "";
  }
}

// ---- Bundle.social: list connected social accounts -------------------------

async function getConnectedSocials(apiKey: string, teamId: string, timeoutMs = 8000): Promise<SocialAccount[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${BUNDLE_BASE}/team/${encodeURIComponent(teamId)}`, {
      headers: { "x-api-key": apiKey },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) {
      console.error("Bundle team fetch failed", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    const accounts: any[] = data?.socialAccounts || data?.team?.socialAccounts || [];
    return accounts
      .filter((a) => a && (a.type || a.platform))
      .map((a) => ({
        type: String(a.type || a.platform || "").toUpperCase(),
        username: a.username || a.name || a.displayName || undefined,
        displayName: a.displayName || a.name || undefined,
      }));
  } catch (e) {
    console.error("getConnectedSocials failed", e);
    return [];
  }
}

// ---- AI call ---------------------------------------------------------------

async function callAI(apiKey: string, system: string, user: string): Promise<string> {
  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI call failed ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

// ---- Report definitions ----------------------------------------------------

interface Ctx {
  practiceName: string;
  websiteUrl: string;
  campaignFocus: string;
  targetAudience: string;
  websiteContent: string;
  reviews: string;
  competitors: string;
  socials: SocialAccount[];
  socialContent: string;
}

const SYSTEM_ANALYST =
  "You are an expert healthcare/dental marketing analyst. Produce detailed, " +
  "actionable reports grounded in the supplied scraped data. Reference concrete " +
  "details from the content rather than generic filler. Use clean markdown with " +
  "clear headers and bullet points.";

const SYSTEM_BRAND =
  "You are a brand strategist for healthcare practices. Produce a precise, " +
  "usable brand/voice guide grounded in the supplied content. Use clean markdown.";

const baseContext = (c: Ctx) => `
PRACTICE: ${c.practiceName}
WEBSITE: ${c.websiteUrl}
STATED CAMPAIGN FOCUS: ${c.campaignFocus || "(not provided)"}
STATED TARGET AUDIENCE: ${c.targetAudience || "(not provided)"}

## WEBSITE CONTENT
${truncate(c.websiteContent || "[no website content scraped]", 12000)}

## ONLINE REVIEWS & REPUTATION
${truncate(c.reviews || "[no review data]", 6000)}

## COMPETITOR LANDSCAPE
${truncate(c.competitors || "[no competitor data]", 6000)}
`.trim();

const socialBlock = (c: Ctx) => `
## CONNECTED SOCIAL ACCOUNTS
${c.socials.length
    ? c.socials.map((s) => `- ${s.type}${s.username ? ` (@${s.username})` : ""}`).join("\n")
    : "[none connected]"}

## SOCIAL CONTENT SAMPLES
${truncate(c.socialContent || "[no social content gathered]", 8000)}
`.trim();

interface ReportDef {
  title: (name: string) => string;
  docType: string;
  system: string;
  prompt: (c: Ctx) => string;
}

const REPORTS: ReportDef[] = [
  {
    title: (n) => `Practice Intelligence Report - ${n}`,
    docType: "market_analysis",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

Write a comprehensive Practice Intelligence Report with these sections:
# 1. Practice Overview (name, address, phone, services, philosophy, key team)
# 2. Reputation & Sentiment summary
# 3. Strengths & distinguishing characteristics
# 4. Competitive landscape positioning
# 5. Market position & share assessment
# 6. SWOT analysis
# 7. Top marketing recommendations
# 8. Key metrics to track`,
  },
  {
    title: (n) => `Competitive Landscape Report - ${n}`,
    docType: "competitive_landscape",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

Write a focused Competitive Landscape Report:
# 1. Key nearby competitors (name each, with what is known)
# 2. Service & specialty comparison vs ${c.practiceName}
# 3. Pricing / positioning signals
# 4. Competitor strengths to defend against
# 5. Market gaps and differentiation opportunities for ${c.practiceName}
# 6. Recommended competitive positioning statement`,
  },
  {
    title: (n) => `Market Analysis Report - ${n}`,
    docType: "market_analysis",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

Write a Market Analysis Report for the dental/healthcare market this practice serves:
# 1. Market segmentation (primary, secondary, niche)
# 2. Local market size & growth trends
# 3. Demand drivers & seasonal patterns
# 4. Value proposition opportunities
# 5. Pricing & service-mix opportunities
# 6. Channel & messaging implications`,
  },
  {
    title: (n) => `Target Audience Analysis - ${n}`,
    docType: "audience_analysis",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

Write a Target Audience Analysis focused on who this practice should market to:
# 1. Primary persona(s) — demographics, motivations, objections
# 2. Secondary persona(s)
# 3. Content formats & channels each persona prefers
# 4. Messaging that resonates / language to avoid
# 5. Decision triggers & the patient journey
# 6. Recommended targeting approach`,
  },
  {
    title: (n) => `Audience Analysis Report - ${n}`,
    docType: "audience_analysis",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

Write an Audience Analysis Report on the practice's CURRENT audience and engagement:
# 1. Who currently engages (from reviews, site, social signals)
# 2. Engagement patterns & behaviours
# 3. Sentiment & loyalty indicators
# 4. Gaps between current and ideal audience
# 5. Retention & referral opportunities
# 6. Recommended audience-development actions`,
  },
  {
    title: (n) => `Demographics Report - ${n}`,
    docType: "demographics",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

Write a Demographics Report for the practice's geographic catchment:
# 1. Local population & household profile (infer from location)
# 2. Age, income, family-structure breakdown
# 3. Insurance & payment mix implications
# 4. Cultural / language considerations
# 5. Demand implications for specific dental services
# 6. Demographic-driven marketing recommendations
State clearly where figures are estimates/inferences.`,
  },
  {
    title: (n) => `Brand Guidelines Report - ${n}`,
    docType: "brand_guidelines",
    system: SYSTEM_BRAND,
    prompt: (c) => `${baseContext(c)}

${socialBlock(c)}

Write a practical Brand Guidelines Report:
# 1. Brand essence & positioning
# 2. Brand personality & values
# 3. Voice & tone (with do/don't examples drawn from their actual content)
# 4. Messaging pillars & key phrases
# 5. Visual identity cues observed (colour, imagery, style)
# 6. Content guidelines for social & web`,
  },
  {
    title: (n) => `Reputation & Sentiment Analysis - ${n}`,
    docType: "reputation_sentiment",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

Write a Reputation & Sentiment Analysis based on REVIEWS and online reputation ONLY
(do NOT analyse their social media posting voice — that is a separate report):
# 1. Overall review sentiment & star-rating summary
# 2. Common praise themes (quote where possible)
# 3. Common complaints & concerns
# 4. Reputation risks
# 5. Review-generation & response strategy
# 6. Reputation KPIs to track`,
  },
  {
    title: (n) => `Detailed Business DNA - ${n}`,
    docType: "business_dna",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

${socialBlock(c)}

Write a "Detailed Business DNA" profile — the deep identity of this practice that any
marketer or AI should internalise before creating content:
# 1. Origin story & mission
# 2. Core values & beliefs
# 3. Signature services & what they are known for
# 4. Ideal patient & the transformation they deliver
# 5. Unique mechanism / what makes them different
# 6. Personality, tone, and non-negotiables
# 7. Words, phrases, and themes that are "on-brand" vs "off-brand"`,
  },
  {
    title: (n) => `Social Media - ${n}`,
    docType: "social_media",
    system: SYSTEM_ANALYST,
    prompt: (c) => `${baseContext(c)}

${socialBlock(c)}

Write a dedicated Social Media report reviewing the practice's CURRENT social media
presence on the connected accounts. This is a standalone report (not part of reputation):
# 1. Connected accounts overview (platforms, handles, apparent activity)
# 2. Tone — how they currently sound (formal/casual, warmth, energy)
# 3. Voice — recurring style, vocabulary, personality on social
# 4. Sentiment — how their content and audience interactions feel
# 5. Content themes & formats currently used
# 6. Gaps, inconsistencies, and quick wins per platform
# 7. Recommended social tone/voice guidelines going forward
If little social content is available, say so and base guidance on the website/brand.`,
  },
];

// ---- Background runner -----------------------------------------------------

async function runGeneration(
  admin: ReturnType<typeof createClient>,
  userId: string,
  profile: any,
) {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const BUNDLE_API_KEY = getBundleApiKey();

  const setStatus = (patch: Record<string, unknown>) =>
    admin.from("profiles").update(patch).eq("user_id", userId);

  try {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const practiceName: string = profile.practice_name || "the practice";
    const websiteUrl: string = profile.website_url;
    const teamId: string | null = profile.bundle_social_team_id;

    // Gather connected social accounts.
    const socials = BUNDLE_API_KEY && teamId
      ? await getConnectedSocials(BUNDLE_API_KEY, teamId)
      : [];

    // Scrape site, reviews, competitors, and social presence in parallel.
    const [websiteContent, reviews, competitors, socialSearch] = await Promise.all([
      firecrawlScrape(FIRECRAWL_API_KEY, websiteUrl),
      firecrawlSearch(FIRECRAWL_API_KEY, `${practiceName} reviews`),
      firecrawlSearch(FIRECRAWL_API_KEY, `dental practices near ${practiceName} competitors`),
      socials.length
        ? firecrawlSearch(
            FIRECRAWL_API_KEY,
            `${practiceName} ${socials.map((s) => s.type).join(" ")} social media posts`,
            5,
          )
        : Promise.resolve(""),
    ]);

    const ctx: Ctx = {
      practiceName,
      websiteUrl,
      campaignFocus: profile.campaign_focus || "",
      targetAudience: profile.target_audience || "",
      websiteContent,
      reviews,
      competitors,
      socials,
      socialContent: socialSearch,
    };

    const matchKey = {
      practice_name: practiceName,
      source_url: websiteUrl,
      campaign_focus: ctx.campaignFocus,
      target_audience: ctx.targetAudience,
    };

    await setStatus({ onboarding_reports_total: REPORTS.length, onboarding_reports_done: 0 });

    // Generate in small batches to bound concurrency / cost.
    let done = 0;
    const BATCH = 3;
    for (let i = 0; i < REPORTS.length; i += BATCH) {
      const batch = REPORTS.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (def) => {
          const title = def.title(practiceName);
          try {
            const content = await callAI(OPENROUTER_API_KEY, def.system, def.prompt(ctx));
            await upsertKBDoc({
              userId,
              docType: def.docType,
              title,
              content: content || `[generation returned empty for ${title}]`,
              matchKey,
              extraMetadata: {
                source_url: websiteUrl,
                practice_name: practiceName,
                generator: "generate-onboarding-reports",
                connected_socials: ctx.socials.map((s) => s.type),
              },
              accountId: profile.account_id ?? null,
            });
          } catch (e) {
            console.error(`Report failed: ${title}`, e);
          }
        }),
      );
      done += batch.length;
      await setStatus({ onboarding_reports_done: Math.min(done, REPORTS.length) });
    }

    await setStatus({
      onboarding_reports_status: "complete",
      onboarding_reports_done: REPORTS.length,
      onboarding_reports_completed_at: new Date().toISOString(),
      onboarding_reports_error: null,
    });
    console.log(`[generate-onboarding-reports] complete for ${userId}`);
  } catch (e) {
    console.error("[generate-onboarding-reports] failed", e);
    await setStatus({
      onboarding_reports_status: "error",
      onboarding_reports_error: e instanceof Error ? e.message : String(e),
    });
  }
}

// ---- Request handler -------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth — require a valid user JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const caller = userData?.user;
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const userId: string = body.userId || caller.id;

    // Authorization — self, admin, or assigned manager.
    let allowed = caller.id === userId;
    if (!allowed) {
      const { data: roleRow } = await admin.from("user_roles")
        .select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (roleRow) allowed = true;
    }
    if (!allowed) {
      const { data: mgrRow } = await admin.from("manager_assignments")
        .select("id").eq("manager_user_id", caller.id).eq("client_user_id", userId).maybeSingle();
      if (mgrRow) allowed = true;
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    // Load profile.
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, practice_name, website_url, campaign_focus, target_audience, bundle_social_team_id, account_id, onboarding_reports_status, onboarding_reports_started_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);
    if (!profile.website_url) {
      return json({ status: "missing_website", message: "A practice website URL is required first." });
    }

    // Require at least one connected social account (unless forced).
    const BUNDLE_API_KEY = getBundleApiKey();
    const socials = BUNDLE_API_KEY && profile.bundle_social_team_id
      ? await getConnectedSocials(BUNDLE_API_KEY, profile.bundle_social_team_id)
      : [];
    if (socials.length === 0 && !force) {
      // Leave status untouched so it retries once accounts are connected.
      return json({ status: "awaiting_social", message: "Connect at least one social account to begin research." });
    }

    // Idempotency guards.
    const status = profile.onboarding_reports_status;
    const startedAt = profile.onboarding_reports_started_at
      ? new Date(profile.onboarding_reports_started_at).getTime()
      : 0;
    const isStale = Date.now() - startedAt > RUNNING_STALE_MS;
    if (!force) {
      if (status === "complete") return json({ status: "complete" });
      if (status === "running" && !isStale) return json({ status: "running" });
    }

    // Mark running and kick off background work.
    await admin.from("profiles").update({
      onboarding_reports_status: "running",
      onboarding_reports_started_at: new Date().toISOString(),
      onboarding_reports_error: null,
      onboarding_reports_done: 0,
      onboarding_reports_total: REPORTS.length,
    }).eq("user_id", userId);

    // @ts-ignore — EdgeRuntime is provided by the Supabase Edge runtime.
    EdgeRuntime.waitUntil(runGeneration(admin, userId, profile));

    return json({ status: "running", total: REPORTS.length, connectedSocials: socials.map((s) => s.type) }, 202);
  } catch (e) {
    console.error("[generate-onboarding-reports] handler error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
