/**
 * publish-campaign-preflight
 *
 * Server-side completeness check before handing a campaign to Bundle.social.
 * Supports an autofix mode that resolves everything the agent can (generate
 * missing content, snap out-of-window posts back into the campaign window)
 * and re-runs the checks so only user-actionable items remain.
 *
 * Request body: { campaignId: string, mode?: "check" | "autofix" }
 * Response: { ok, checks: [{ id, name, ok, message, autofixable? }],
 *             resolved?: string[], pendingJobs?: string[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAccess } from "../_shared/campaign-agent.ts";

const SOCIAL_PLATFORMS = new Set(["facebook", "instagram", "linkedin", "twitter", "youtube", "tiktok"]);
const EMAIL_PLATFORMS = new Set(["internal_email", "mailchimp", "beehiiv", "beehive"]);
const SMS_PLATFORMS = new Set(["internal_sms"]);
const LAUNCH_PLATFORMS = new Set(["facebook", "instagram", "linkedin", "twitter"]);

// ---- Best-practice tables (mirrors src/lib/scheduling.ts) ------------------
const BEST_PRACTICE: Record<string, { days: number[]; times: string[] }> = {
  facebook:       { days: [1, 2, 3, 4],    times: ["09:00", "19:00"] },
  instagram:      { days: [1, 2, 3, 4, 5], times: ["09:00", "14:00", "19:00"] },
  linkedin:       { days: [2, 3, 4],       times: ["08:00", "12:00"] },
  twitter:        { days: [1, 2, 3, 4, 5], times: ["09:00", "12:00", "19:00"] },
  youtube:        { days: [4, 5, 6],       times: ["15:00", "17:00"] },
  tiktok:         { days: [2, 3, 4, 5],    times: ["10:00", "19:00"] },
  internal_email: { days: [2, 3, 4],       times: ["09:00", "10:00"] },
  mailchimp:      { days: [2, 3, 4],       times: ["09:00", "10:00"] },
  beehiiv:        { days: [2, 3, 4],       times: ["09:00", "10:00"] },
  beehive:        { days: [2, 3, 4],       times: ["09:00", "10:00"] },
  internal_sms:   { days: [2, 3, 4, 5],    times: ["11:00", "17:00"] },
};

const ONE_DAY = 24 * 60 * 60 * 1000;

interface Check { id: string; name: string; ok: boolean; message?: string; autofixable?: boolean }

const dateKey = (value: string | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : null;

/** Snap a JS Date to the next best-practice weekday for `platform`, clamped. */
function snapDay(day: Date, platform: string, min: Date, max: Date): Date {
  const rule = BEST_PRACTICE[platform];
  if (!rule) return day;
  for (let delta = 0; delta <= 6; delta++) {
    for (const dir of delta === 0 ? [0] : [-1, 1]) {
      const cand = new Date(day.getTime() + delta * dir * ONE_DAY);
      if (cand < min || cand > max) continue;
      if (rule.days.includes(cand.getUTCDay())) return cand;
    }
  }
  return day;
}

/** Fit a list of posts into [start,end] with launch-day + first-week + cadence rules. */
function fitPostsWindow(
  posts: Array<{ id: string; scheduled_start: string | null }>,
  platform: string,
  start: Date,
  end: Date,
): Array<{ id: string; iso: string }> {
  if (!posts.length) return [];
  const rule = BEST_PRACTICE[platform];
  const dstStart = new Date(start.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const dstEnd = new Date(end.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const span = Math.max(0, Math.round((dstEnd.getTime() - dstStart.getTime()) / ONE_DAY));

  const sorted = [...posts].sort((a, b) => {
    const at = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
    const bt = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
    return at - bt;
  });
  const isSocial = LAUNCH_PLATFORMS.has(platform) || platform === "youtube" || platform === "tiktok";
  const isEmail = EMAIL_PLATFORMS.has(platform);
  const isSms = SMS_PLATFORMS.has(platform);
  const useLaunch = LAUNCH_PLATFORMS.has(platform);

  const used = new Set<string>();
  const out: Array<{ id: string; iso: string }> = [];
  let lastNonFunnel: Date | null = null;

  sorted.forEach((p, idx) => {
    // Position ratio + first-week bias for social.
    const posR = sorted.length === 1 ? 0 : idx / (sorted.length - 1);
    let r = posR;
    if (isSocial && span > 7) {
      const week1 = 7 / span;
      r = posR < 0.6 ? (posR / 0.6) * week1 : week1 + ((posR - 0.6) / 0.4) * (1 - week1);
    }
    let day = new Date(dstStart.getTime() + Math.round(r * span) * ONE_DAY);
    if (useLaunch && idx === 0) day = dstStart;
    else day = snapDay(day, platform, dstStart, dstEnd);
    // Enforce max-1 / platform / day.
    let key = day.toISOString().slice(0, 10);
    while (used.has(key) && day < dstEnd) {
      day = new Date(day.getTime() + ONE_DAY);
      day = snapDay(day, platform, dstStart, dstEnd);
      key = day.toISOString().slice(0, 10);
    }
    // Email weekly cap / SMS 3-day gap. Funnel posts skipped.
    if ((isEmail || isSms) && lastNonFunnel) {
      const gapDays = isSms ? 3 : 7;
      const gap = Math.round((day.getTime() - lastNonFunnel.getTime()) / ONE_DAY);
      if (gap < gapDays) {
        day = new Date(lastNonFunnel.getTime() + gapDays * ONE_DAY);
        day = snapDay(day, platform, dstStart, dstEnd);
        key = day.toISOString().slice(0, 10);
      }
    }
    used.add(key);
    if (isEmail || isSms) lastNonFunnel = day;
    const time = (rule && rule.times[0]) || "09:00";
    out.push({ id: p.id, iso: new Date(`${key}T${time}:00.000Z`).toISOString() });
  });
  return out;
}

async function invokeSelf(fn: string, authHeader: string | null, body: unknown) {
  if (!authHeader) return null;
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${fn} ${resp.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function runChecks(
  admin: ReturnType<typeof createClient>,
  campaignId: string,
): Promise<{ checks: Check[]; ctx: any }> {
  const checks: Check[] = [];
  const { data: campaignRow, error: campaignError } = await admin
    .from("campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (campaignError) throw new Error(`Could not load campaign: ${campaignError.message}`);
  if (!campaignRow) throw new Error("Campaign not found");

  const { data: channelRows, error: channelsError } = await admin
    .from("campaign_channels").select("*").eq("campaign_id", campaignId);
  if (channelsError) throw new Error(`Could not load channels: ${channelsError.message}`);

  const channelIds = (channelRows || []).map((c: any) => c.id);
  let postRows: any[] = [];
  if (channelIds.length) {
    const { data: posts, error: postsError } = await admin
      .from("channel_posts").select("*").in("campaign_channel_id", channelIds);
    if (postsError) throw new Error(`Could not load posts: ${postsError.message}`);
    postRows = posts || [];
  }
  const campaign: any = {
    ...campaignRow,
    campaign_channels: (channelRows || []).map((ch: any) => ({
      ...ch,
      channel_posts: postRows.filter((p) => p.campaign_channel_id === ch.id),
    })),
  };
  const accepted = (campaign.assets_accepted || {}) as Record<string, any>;

  checks.push({
    id: "strategy_present",
    name: "Strategic plan present",
    ok: !!(campaign.strategy && campaign.strategy.trim().length > 100),
    message: campaign.strategy ? undefined : "Run the Campaign Agent to generate a strategic plan.",
  });
  const strategyAccepted = !!(accepted.strategy || accepted.plan);
  checks.push({
    id: "strategy_accepted",
    name: "Strategic plan accepted",
    ok: strategyAccepted,
    message: strategyAccepted ? undefined : "Review and accept the strategic plan.",
  });

  checks.push({
    id: "blog_present",
    name: "Blog article ready",
    ok: !!(campaign.blog_article && campaign.blog_article.trim().length > 200 && campaign.blog_title),
    message: campaign.blog_article ? undefined : "The blog article is missing.",
    autofixable: !campaign.blog_article,
  });
  checks.push({
    id: "blog_accepted",
    name: "Blog article accepted",
    ok: !!accepted.blog,
    message: accepted.blog ? undefined : "Review and accept the blog article.",
  });

  const startKey = dateKey(campaign.start_date);
  const endKey = dateKey(campaign.end_date);
  const start = startKey ? new Date(`${startKey}T00:00:00.000Z`) : null;
  const end = endKey ? new Date(`${endKey}T23:59:59.999Z`) : null;
  const datesOk = !!(start && end && end.getTime() > start.getTime());
  checks.push({
    id: "dates_set", name: "Campaign dates set",
    ok: datesOk,
    message: datesOk ? undefined : "Set both start and end dates (end must be after start).",
  });

  const { data: budget } = await admin
    .from("campaign_budgets").select("*").eq("campaign_id", campaignId).maybeSingle();
  checks.push({
    id: "budget_accepted",
    name: "Budget allocation accepted",
    ok: !!(budget?.accepted && ((budget as any)?.total_amount || 0) > 0),
    message: budget?.accepted ? undefined : "Accept the budget allocation.",
  });

  const channels = campaign.campaign_channels || [];
  checks.push({
    id: "channels_present",
    name: "At least one channel configured",
    ok: channels.length > 0,
    message: channels.length ? undefined : "Add at least one channel.",
  });

  const postAccepted = accepted.posts || {};
  const hasEmailChannel = channels.some((c: any) => c.channel_type === "email" || EMAIL_PLATFORMS.has(String(c.platform).toLowerCase()));
  const hasSmsChannel = channels.some((c: any) => c.channel_type === "sms" || SMS_PLATFORMS.has(String(c.platform).toLowerCase()));

  if (hasEmailChannel) {
    const { count } = await admin
      .from("campaign_email_funnel").select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    const emailFunnelCount = count || 0;
    checks.push({
      id: "email_funnel_ready",
      name: "Email nurture content ready",
      ok: emailFunnelCount > 0,
      message: emailFunnelCount > 0 ? undefined : "Generate the email funnel for the selected email channel.",
      autofixable: emailFunnelCount === 0,
    });
  }

  for (const ch of channels) {
    const channelType = String(ch.channel_type || "").toLowerCase();
    const platform = String(ch.platform || "").toLowerCase();
    if (channelType !== "email" && !EMAIL_PLATFORMS.has(platform)) continue;
    const isGeneralTest = (ch as any).distribution_list_mode === "general_test";
    const hasRealList = !!(ch as any).distribution_list_id && !isGeneralTest;
    checks.push({
      id: `email_${ch.id}_distribution_list`,
      name: `Patient Email: real distribution list attached`,
      ok: hasRealList,
      message: isGeneralTest
        ? "This channel is on the General email list (test only). Attach a real list before publishing."
        : hasRealList ? undefined : "Select or import a distribution list for the email channel.",
    });
  }

  if (hasSmsChannel) {
    const { count } = await admin
      .from("campaign_drip_series").select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    checks.push({
      id: "sms_drip_ready",
      name: "SMS drip content ready",
      ok: (count || 0) > 0,
      message: (count || 0) > 0 ? undefined : "Generate the SMS drip content for the selected SMS channel.",
      autofixable: (count || 0) === 0,
    });
  }

  for (const ch of channels) {
    const posts = ch.channel_posts || [];
    const label = `${ch.platform}`;
    const platform = String(ch.platform || "").toLowerCase();
    const channelType = String(ch.channel_type || "").toLowerCase();
    if (channelType === "email" || channelType === "sms" || EMAIL_PLATFORMS.has(platform) || SMS_PLATFORMS.has(platform)) {
      continue;
    }
    if (posts.length === 0) {
      checks.push({ id: `posts_${ch.id}_count`, name: `${label}: has posts`, ok: false, message: "No posts drafted. Generate missing posts for this platform.", autofixable: true });
      continue;
    }
    const missingText = posts.filter((p: any) => !(p.text_content || "").trim());
    const missingMedia = SOCIAL_PLATFORMS.has(platform)
      ? posts.filter((p: any) => !p.image_url && !p.video_url)
      : [];
    const outOfWindow = datesOk ? posts.filter((p: any) => {
      if (!p.scheduled_start) return false;
      const t = new Date(p.scheduled_start).getTime();
      return t < start!.getTime() || t > end!.getTime();
    }) : [];
    const unaccepted = posts.filter((p: any) => !(p.accepted || postAccepted[p.id]));

    checks.push({
      id: `posts_${ch.id}_text`, name: `${label}: all posts have text`,
      ok: missingText.length === 0,
      message: missingText.length ? `${missingText.length} post(s) missing text.` : undefined,
    });
    if (SOCIAL_PLATFORMS.has(platform)) {
      checks.push({
        id: `posts_${ch.id}_media`, name: `${label}: all posts have image or video`,
        ok: missingMedia.length === 0,
        message: missingMedia.length ? `${missingMedia.length} post(s) missing media.` : undefined,
      });
    }
    checks.push({
      id: `posts_${ch.id}_window`, name: `${label}: posts scheduled within campaign window`,
      ok: outOfWindow.length === 0,
      message: outOfWindow.length ? `${outOfWindow.length} post(s) outside window or unscheduled.` : undefined,
      autofixable: outOfWindow.length > 0 && datesOk,
    });
    checks.push({
      id: `posts_${ch.id}_accepted`, name: `${label}: all posts accepted`,
      ok: unaccepted.length === 0,
      message: unaccepted.length ? `${unaccepted.length} post(s) not accepted.` : undefined,
    });
  }

  const { data: profile } = await admin.from("profiles")
    .select("bundle_social_team_id").eq("user_id", campaign.user_id).maybeSingle();
  const hasTeam = !!profile?.bundle_social_team_id;
  const hasSocial = channels.some((c: any) => SOCIAL_PLATFORMS.has(c.platform));
  if (hasSocial) {
    checks.push({
      id: "bundle_team",
      name: "Bundle.social team connected",
      ok: hasTeam,
      message: hasTeam ? undefined : "Connect Bundle.social from Connected Platforms.",
    });
  }

  return { checks, ctx: { campaign, channels, start, end, datesOk } };
}

async function performAutofix(
  admin: ReturnType<typeof createClient>,
  authHeader: string | null,
  campaignId: string,
  checks: Check[],
  ctx: any,
): Promise<{ resolved: string[]; pendingJobs: string[] }> {
  const resolved: string[] = [];
  const pendingJobs: string[] = [];
  const { channels, start, end, datesOk } = ctx;

  // 1. Snap out-of-window posts back into range (sync, per channel).
  if (datesOk) {
    for (const ch of channels) {
      const platform = String(ch.platform || "").toLowerCase();
      const channelType = String(ch.channel_type || "").toLowerCase();
      if (channelType === "email" || channelType === "sms" || EMAIL_PLATFORMS.has(platform) || SMS_PLATFORMS.has(platform)) continue;
      const posts = (ch.channel_posts || []) as any[];
      const bad = posts.filter((p) => {
        if (!p.scheduled_start) return false;
        const t = new Date(p.scheduled_start).getTime();
        return t < start.getTime() || t > end.getTime();
      });
      if (!bad.length) continue;
      const fitted = fitPostsWindow(posts.filter((p) => p.scheduled_start), platform, start, end);
      await Promise.all(fitted.map((f) =>
        admin.from("channel_posts")
          .update({ scheduled_start: f.iso, status: "scheduled" })
          .eq("id", f.id),
      ));
      resolved.push(`Reflowed ${bad.length} ${platform} post${bad.length === 1 ? "" : "s"} into the campaign window`);
    }
  }

  // 2. Generate missing per-channel posts (background — long-running).
  for (const check of checks) {
    if (check.ok || !check.id.startsWith("posts_") || !check.id.endsWith("_count")) continue;
    const channelId = check.id.replace(/^posts_/, "").replace(/_count$/, "");
    try {
      await invokeSelf("generate-campaign-content", authHeader, { campaignId, channelId, force: true });
      pendingJobs.push(`Generating posts for channel ${channelId}`);
    } catch (e) {
      console.warn("[preflight-autofix] generate-campaign-content failed", e);
    }
  }

  // 3. SMS drip missing.
  if (checks.some((c) => c.id === "sms_drip_ready" && !c.ok)) {
    try {
      const { data: smsChannels } = await admin
        .from("campaign_channels")
        .select("id, channel_type")
        .eq("campaign_id", campaignId)
        .or("channel_type.eq.sms,platform.eq.internal_sms");
      for (const ch of smsChannels || []) {
        let { data: series } = await admin
          .from("campaign_drip_series")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("channel_id", ch.id)
          .maybeSingle();
        if (!series) {
          const { data: created } = await admin
            .from("campaign_drip_series")
            .insert({
              campaign_id: campaignId,
              channel_id: ch.id,
              channel_type: ch.channel_type || "sms",
              recipient_mode: "existing",
              recipient_config: {},
              series_length: 3,
              complete: false,
            })
            .select("id").single();
          series = created;
        }
        if (series) {
          await invokeSelf("generate-drip-series", authHeader, {
            campaignId, channelId: ch.id, seriesId: series.id,
          });
          pendingJobs.push("Generating SMS drip series");
        }
      }
    } catch (e) {
      console.warn("[preflight-autofix] SMS drip generation failed", e);
    }
  }

  // 4. Email funnel missing.
  if (checks.some((c) => c.id === "email_funnel_ready" && !c.ok)) {
    try {
      await invokeSelf("generate-email-funnel", authHeader, { campaignId });
      pendingJobs.push("Generating email nurture funnel");
    } catch (e) {
      console.warn("[preflight-autofix] email funnel generation failed", e);
    }
  }

  // 5. Blog article missing.
  if (checks.some((c) => c.id === "blog_present" && !c.ok)) {
    try {
      await invokeSelf("generate-content-hub", authHeader, { campaignId });
      pendingJobs.push("Generating blog article + hero image");
    } catch (e) {
      console.warn("[preflight-autofix] content hub generation failed", e);
    }
  }

  return { resolved, pendingJobs };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { campaignId } = body || {};
    const mode = (body?.mode || "check") as "check" | "autofix";
    if (!campaignId) throw new Error("campaignId required");
    const authHeader = req.headers.get("Authorization");
    await requireAccess(admin, authHeader, campaignId);

    const first = await runChecks(admin, campaignId);

    if (mode !== "autofix") {
      const ok = first.checks.every((c) => c.ok);
      return new Response(JSON.stringify({ ok, checks: first.checks }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { resolved, pendingJobs } = await performAutofix(
      admin, authHeader, campaignId, first.checks, first.ctx,
    );
    // Re-scan after in-line fixes; background jobs may still be running.
    const second = await runChecks(admin, campaignId);
    const ok = second.checks.every((c) => c.ok);
    return new Response(JSON.stringify({ ok, checks: second.checks, resolved, pendingJobs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("[publish-campaign-preflight]", msg, e);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
