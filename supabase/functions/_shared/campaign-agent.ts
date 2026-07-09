/**
 * Shared helpers for the Campaign Agent pipeline.
 * All AI calls go through OpenRouter (matches existing project pattern).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callAI(
  apiKey: string,
  system: string,
  user: string,
  opts: { model?: string; temperature?: number; jsonObject?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const body: any = {
    model: opts.model || "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
  };
  if (opts.jsonObject) body.response_format = { type: "json_object" };

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI call failed ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export function extractJson<T = any>(raw: string): T {
  const cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const arr = cleaned.match(/\[[\s\S]*\]/);
  if (arr) return JSON.parse(arr[0]) as T;
  const obj = cleaned.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]) as T;
  throw new Error("No JSON found in AI response");
}

export async function computeInputsHash(inputs: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(inputs));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Load campaign + owner profile + KB excerpts + channels + addons + budget.
 * Used as the shared context bundle for every agent phase.
 */
export async function loadCampaignContext(admin: any, campaignId: string) {
  const { data: campaign } = await admin
    .from("campaigns")
    .select("*, campaign_channels(*)")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");

  const { data: profile } = await admin
    .from("profiles")
    .select("practice_name, website_url, target_audience, campaign_focus, brand_voice, city, state")
    .eq("user_id", campaign.user_id)
    .maybeSingle();

  const { data: kbDocs } = await admin
    .from("knowledge_base")
    .select("title, doc_type, content, metadata")
    .eq("user_id", campaign.user_id)
    .in("doc_type", [
      "audience_analysis", "market_analysis", "brand_guidelines",
      "competitive_landscape", "system_prompt", "demographics", "custom",
    ])
    .order("updated_at", { ascending: false })
    .limit(12);

  const { data: budget } = await admin
    .from("campaign_budgets")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const { data: addons } = await admin
    .from("campaign_addons")
    .select("addon_type, custom_label")
    .eq("campaign_id", campaignId);

  const campaignTokens = [
    campaign.name,
    campaign.focus,
    campaign.target_audience,
    profile?.practice_name,
    profile?.campaign_focus,
    profile?.target_audience,
  ]
    .filter(Boolean)
    .flatMap((s: string) => String(s).toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length >= 4 && ![
      "practice", "dental", "campaign", "marketing", "business", "account",
      "target", "audience", "owner", "owners", "patients", "services",
    ].includes(w));
  const campaignTokenSet = new Set(campaignTokens);

  const isLikelyOtherClientReport = (doc: any): boolean => {
    const title = String(doc?.title || "").toLowerCase();
    const metadata = doc?.metadata || {};
    const sourceCampaignId = metadata?.campaign_id || metadata?.campaignId;
    if (sourceCampaignId && sourceCampaignId !== campaignId) return true;

    const looksLikeClientReport =
      /practice intelligence report|competitive landscape|reputation.*sentiment|sentiment analysis|campaign research|blog:/i.test(title);
    if (!looksLikeClientReport) return false;

    for (const tok of campaignTokenSet) if (title.includes(tok)) return false;
    return true;
  };

  const kbExcerpt = (kbDocs || [])
    .filter((d: any) => (d.metadata as any)?.file_kind !== "image")
    .filter((d: any) => !isLikelyOtherClientReport(d))
    .map((d: any) => `### ${d.title} (${d.doc_type})\n${(d.content || "").slice(0, 800)}`)
    .join("\n\n")
    .slice(0, 6000);

  return { campaign, profile, kbDocs: kbDocs || [], budget, addons: addons || [], kbExcerpt };
}

/**
 * Compute the hash of the inputs that should invalidate the strategic plan.
 * Change → banner appears; matches → banner hidden.
 */
export async function currentInputsHash(ctx: {
  campaign: any; budget: any; addons: any[];
}): Promise<string> {
  const inputs = {
    focus: ctx.campaign.focus || null,
    target_audience: ctx.campaign.target_audience || null,
    start: ctx.campaign.start_date || null,
    end: ctx.campaign.end_date || null,
    duration_value: ctx.campaign.duration_value || null,
    duration_unit: ctx.campaign.duration_unit || null,
    total: ctx.budget?.total_amount || 0,
    channels: (ctx.campaign.campaign_channels || [])
      .map((c: any) => `${c.channel_type}:${c.platform}`).sort(),
    addons: (ctx.addons || []).map((a: any) => a.addon_type).sort(),
  };
  return computeInputsHash(inputs);
}

export async function requireAccess(admin: any, authHeader: string | null, campaignId: string) {
  if (!authHeader) throw new Error("Unauthorized");
  const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  const caller = userData?.user;
  if (!caller) throw new Error("Unauthorized");

  const { data: campaign } = await admin.from("campaigns").select("user_id").eq("id", campaignId).single();
  if (!campaign) throw new Error("Campaign not found");
  if (caller.id === campaign.user_id) return { caller, campaign };

  const { data: adminRole } = await admin.from("user_roles")
    .select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
  if (adminRole) return { caller, campaign };

  const { data: mgr } = await admin.from("manager_assignments")
    .select("id").eq("manager_user_id", caller.id).eq("client_user_id", campaign.user_id).maybeSingle();
  if (mgr) return { caller, campaign };

  throw new Error("Forbidden");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Strategic plan runner (used by orchestrator, refresh, and standalone fn) ───

export interface StrategicPlanResult {
  target_market_refined: string;
  psychological_approach: string;
  strategy: string;
  allocations: Record<string, { percent: number; amount: number }>;
  plan_inputs_hash: string;
}

export async function runStrategicPlan(admin: any, apiKey: string, campaignId: string): Promise<StrategicPlanResult> {
  const ctx = await loadCampaignContext(admin, campaignId);
  const { campaign, profile, kbExcerpt, budget, addons } = ctx;
  const total = budget?.total_amount || 0;
  const channels = campaign.campaign_channels || [];

  const explicitAudience = campaign.target_audience || profile?.target_audience || "(none)";
  const explicitFocus = campaign.focus || campaign.name || profile?.campaign_focus || "(none)";
  const profileName = profile?.practice_name || "(unknown)";
  const genericProfileName = /^(administrator|admin|test|demo|client|account|administrator account)$/i.test(String(profileName).trim());
  const publisherIdentity = [
    `Profile/business name: ${genericProfileName ? `${profileName} (generic account label; do not treat as the promoted business name)` : profileName}`,
    profile?.website_url ? `Website: ${profile.website_url}` : "Website: (unknown)",
    profile?.campaign_focus ? `Business positioning / core offer from profile: ${profile.campaign_focus}` : "Business positioning / core offer from profile: (none)",
    profile?.brand_voice ? `Brand voice: ${profile.brand_voice}` : "Brand voice: (none)",
  ].join("\n");

  const audienceRaw = await callAI(apiKey,
    `You are a market researcher. Produce STRICT JSON with keys:
{"persona":{"name":string,"age_range":string,"lifestyle":string,"income":string},
 "psychographics":{"values":string[],"fears":string[],"desires":string[],"triggers":string[]},
 "media_habits":string[],
 "buying_journey":string[]}
No prose, no markdown fences.

SOURCE PRIORITY — obey this order when sources conflict:
1) Campaign focus, target audience, name, budget, and selected channels are authoritative.
2) Profile fields explain the publishing business and core offer.
3) Knowledge base excerpts are background only. Ignore stale reports about other practices, cities, doctors, services, or audiences.

Do not assume this is a patient-facing dental treatment campaign. Infer the real business, offer, and buyer from the campaign focus, profile, and filtered KB. If the campaign is about an AI marketing agent, marketing agency, fractional marketing, ROI, cost efficiency, or a business service for dental practices, the persona is the practice owner/operator, not a patient.`,
    `PUBLISHING BUSINESS IDENTITY:
${publisherIdentity}

Location: ${[profile?.city, profile?.state].filter(Boolean).join(", ") || "(unknown)"}
Stated campaign target audience: ${explicitAudience}
Campaign focus: ${explicitFocus}
Campaign name: ${campaign.name}
Total budget: $${total}
Knowledge base excerpts:
${kbExcerpt || "(none)"}

Augment the target audience into a rich persona + psychographic profile tailored to this campaign focus.`,
    { model: "google/gemini-2.5-pro", temperature: 0.6, jsonObject: true },
  );

  let targetRefined = audienceRaw;
  try { targetRefined = JSON.stringify(extractJson(audienceRaw), null, 2); } catch { /* keep raw */ }

  const psych = await callAI(apiKey,
    `You are a persuasion strategist. In <=180 words, name and justify ONE dominant psychological approach
(e.g. authority + social proof, loss aversion, aspirational identity, community belonging, curiosity gap).
Explain WHY it fits this campaign given the persona. Plain prose, no markdown headings.`,
    `Campaign focus: ${explicitFocus}
Persona + psychographics:
${targetRefined}`,
    { model: "google/gemini-2.5-pro", temperature: 0.5 },
  );

  const strategy = await callAI(apiKey,
    `You are a senior campaign strategist. First identify the actual publishing business, core offer, and target buyer from the authoritative campaign inputs and profile, then write the plan for that business.
Write a concrete, non-generic strategic campaign plan in markdown.
Use these sections (## headings): Executive Summary, Target Audience, Key Message,
Channel Mix, Content Themes, Timeline, KPIs, Budget Rationale.
600-900 words. No emojis. No fluff. Reference the psychological approach in Key Message.

Critical fidelity rule: campaign focus, target audience, and budget are authoritative. Do not drift into patient-facing dental services, whitening, Invisalign, implants, appointments, smile makeovers, seasonal specials, or similar treatment promotions unless the campaign focus explicitly names them. If the campaign is about hiring/using an AI marketing agent, a marketing agency, fractional marketing, ROI, cost efficiency, or business growth for practices, write to dental practice owners/operators about ROI, efficiency, cost effectiveness, delegation, and growth.

IDENTITY GUARDRAIL: Knowledge base documents can contain stale reports about other client practices. Never adopt a practice name, city, address, doctor, treatment offer, or patient audience from KB unless it matches the campaign focus/name or profile identity. Generic account labels like "Administrator Account" are not the promoted business name.`,
    `PUBLISHING BUSINESS IDENTITY:
${publisherIdentity}

Campaign name: ${campaign.name}
Focus: ${explicitFocus}
Campaign target audience: ${explicitAudience}
Duration: ${campaign.duration_value || 30} ${campaign.duration_unit || "days"}
Total budget: $${total}
Selected channels: ${channels.map((c: any) => `${c.platform} (${c.channel_type})`).join(", ") || "(none - recommend a default mix)"}
Selected add-ons: ${addons.map((a: any) => a.custom_label || a.addon_type).join(", ") || "(none)"}
Psychological approach:
${psych}

Persona:
${targetRefined}

Knowledge base excerpts:
${kbExcerpt || "(none)"}`,
    { model: "google/gemini-2.5-pro", temperature: 0.7 },
  );

  let allocations: Record<string, { percent: number; amount: number }> = {};
  if (total > 0 && (channels.length > 0 || addons.length > 0)) {
    const allocRaw = await callAI(apiKey,
      `You are a media planner. Return STRICT JSON:
{"allocations":[{"key":"channel:<platform>"|"addon:<addon_type>","percent":number}]}
Percents must sum to 100. Weight based on ROI expectation for this focus and channel mix.
No prose.`,
      `Total budget: $${total}
Channels: ${channels.map((c: any) => `channel:${c.platform}`).join(", ") || "(none)"}
Addons: ${addons.map((a: any) => `addon:${a.addon_type}`).join(", ") || "(none)"}
Focus: ${campaign.focus || campaign.name}`,
      { model: "google/gemini-2.5-flash", temperature: 0.4, jsonObject: true },
    );
    try {
      const parsed = extractJson<{ allocations: { key: string; percent: number }[] }>(allocRaw);
      const items = parsed.allocations || [];
      const sum = items.reduce((s, i) => s + (i.percent || 0), 0) || 1;
      for (const it of items) {
        const pct = ((it.percent || 0) / sum) * 100;
        allocations[it.key] = { percent: pct, amount: Math.round((pct / 100) * total * 100) / 100 };
      }
    } catch (e) { console.warn("[strategic-plan] allocation parse failed", e); }
  }

  const hash = await currentInputsHash({ campaign, budget, addons });

  await admin.from("campaigns").update({
    strategy,
    target_market_refined: targetRefined,
    psychological_approach: psych,
    plan_version: (campaign.plan_version || 1) + 1,
    plan_inputs_hash: hash,
    generation_status: "plan_ready",
    generation_error: null,
  }).eq("id", campaignId);

  if (Object.keys(allocations).length > 0) {
    if (budget?.id) {
      await admin.from("campaign_budgets").update({ allocations }).eq("id", budget.id);
    } else if (total > 0) {
      await admin.from("campaign_budgets").insert({
        campaign_id: campaignId, total_amount: total, allocations, accepted: false,
      });
    }
  }

  return {
    target_market_refined: targetRefined,
    psychological_approach: psych,
    strategy,
    allocations,
    plan_inputs_hash: hash,
  };
}
