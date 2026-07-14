/**
 * publish-campaign-preflight
 *
 * Server-side completeness check before handing a campaign to Bundle.social.
 * Returns { ok, checks: [{ id, name, ok, message }] }.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAccess } from "../_shared/campaign-agent.ts";

const SOCIAL_PLATFORMS = new Set(["facebook", "instagram", "linkedin", "twitter", "youtube", "tiktok"]);
const EMAIL_PLATFORMS = new Set(["internal_email", "mailchimp", "beehiiv"]);
const SMS_PLATFORMS = new Set(["internal_sms"]);

interface Check { id: string; name: string; ok: boolean; message?: string }

const dateKey = (value: string | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId required");
    await requireAccess(admin, req.headers.get("Authorization"), campaignId);

    const checks: Check[] = [];

    const { data: campaignRow, error: campaignError } = await admin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (campaignError) throw new Error(`Could not load campaign: ${campaignError.message}`);
    if (!campaignRow) throw new Error("Campaign not found");

    const { data: channelRows, error: channelsError } = await admin
      .from("campaign_channels")
      .select("*")
      .eq("campaign_id", campaignId);
    if (channelsError) throw new Error(`Could not load channels: ${channelsError.message}`);

    const channelIds = (channelRows || []).map((c: any) => c.id);
    let postRows: any[] = [];
    if (channelIds.length) {
      const { data: posts, error: postsError } = await admin
        .from("channel_posts")
        .select("*")
        .in("campaign_channel_id", channelIds);
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

    // ---- 1. Strategic plan present + accepted --------------------------------
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

    // ---- 2. Blog article present + accepted ----------------------------------
    checks.push({
      id: "blog_present",
      name: "Blog article ready",
      ok: !!(campaign.blog_article && campaign.blog_article.trim().length > 200 && campaign.blog_title),
      message: campaign.blog_article ? undefined : "The blog article is missing.",
    });
    checks.push({
      id: "blog_accepted",
      name: "Blog article accepted",
      ok: !!accepted.blog,
      message: accepted.blog ? undefined : "Review and accept the blog article.",
    });

    // ---- 3. Dates ------------------------------------------------------------
    const startKey = dateKey(campaign.start_date);
    const endKey = dateKey(campaign.end_date);
    const start = startKey ? new Date(`${startKey}T00:00:00.000Z`) : null;
    const end = endKey ? new Date(`${endKey}T23:59:59.999Z`) : null;
    const datesOk = !!(start && end && end.getTime() > start.getTime());
    checks.push({
      id: "dates_set",
      name: "Campaign dates set",
      ok: datesOk,
      message: datesOk ? undefined : "Set both start and end dates (end must be after start).",
    });

    // ---- 4. Budget accepted --------------------------------------------------
    const { data: budget, error: budgetError } = await admin
      .from("campaign_budgets").select("*").eq("campaign_id", campaignId).maybeSingle();
    if (budgetError) throw new Error(`Could not load budget: ${budgetError.message}`);
    checks.push({
      id: "budget_accepted",
      name: "Budget allocation accepted",
      ok: !!(budget?.accepted && (budget?.total_amount || 0) > 0),
      message: budget?.accepted ? undefined : "Accept the budget allocation.",
    });

    // ---- 5. Channels + posts -------------------------------------------------
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

    let emailFunnelCount = 0;
    if (hasEmailChannel) {
      const { count, error } = await admin
        .from("campaign_email_funnel")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId);
      if (error) throw new Error(`Could not load email funnel: ${error.message}`);
      emailFunnelCount = count || 0;
      checks.push({
        id: "email_funnel_ready",
        name: "Email nurture content ready",
        ok: emailFunnelCount > 0,
        message: emailFunnelCount > 0 ? undefined : "Generate the email funnel for the selected email channel.",
      });
    }

    if (hasSmsChannel) {
      const { count, error } = await admin
        .from("campaign_drip_series")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId);
      if (error) throw new Error(`Could not load SMS drip series: ${error.message}`);
      checks.push({
        id: "sms_drip_ready",
        name: "SMS drip content ready",
        ok: (count || 0) > 0,
        message: (count || 0) > 0 ? undefined : "Generate the SMS drip content for the selected SMS channel.",
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
        checks.push({ id: `posts_${ch.id}_count`, name: `${label}: has posts`, ok: false, message: "No posts drafted. Generate missing posts for this platform." });
        continue;
      }
      const missingText = posts.filter((p: any) => !(p.text_content || "").trim());
      const missingMedia = SOCIAL_PLATFORMS.has(platform)
        ? posts.filter((p: any) => !p.image_url && !p.video_url)
        : [];
      // Unscheduled posts are OK — Bundle.social can post immediately.
      // Only fail if scheduled_start is set and lands outside the campaign window.
      const outOfWindow = datesOk ? posts.filter((p: any) => {
        if (!p.scheduled_start) return false;
        const t = new Date(p.scheduled_start).getTime();
        return t < start!.getTime() || t > end!.getTime();
      }) : [];
      const unaccepted = posts.filter((p: any) => !(p.accepted || postAccepted[p.id]));

      checks.push({
        id: `posts_${ch.id}_text`,
        name: `${label}: all posts have text`,
        ok: missingText.length === 0,
        message: missingText.length ? `${missingText.length} post(s) missing text.` : undefined,
      });
      if (SOCIAL_PLATFORMS.has(platform)) {
        checks.push({
          id: `posts_${ch.id}_media`,
          name: `${label}: all posts have image or video`,
          ok: missingMedia.length === 0,
          message: missingMedia.length ? `${missingMedia.length} post(s) missing media.` : undefined,
        });
      }
      checks.push({
        id: `posts_${ch.id}_window`,
        name: `${label}: posts scheduled within campaign window`,
        ok: outOfWindow.length === 0,
        message: outOfWindow.length ? `${outOfWindow.length} post(s) outside window or unscheduled.` : undefined,
      });
      checks.push({
        id: `posts_${ch.id}_accepted`,
        name: `${label}: all posts accepted`,
        ok: unaccepted.length === 0,
        message: unaccepted.length ? `${unaccepted.length} post(s) not accepted.` : undefined,
      });
    }

    // ---- 6. Bundle.social team + connected socials for social channels -------
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("bundle_social_team_id").eq("user_id", campaign.user_id).maybeSingle();
    if (profileError) throw new Error(`Could not load Bundle.social connection: ${profileError.message}`);
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

    const ok = checks.every((c) => c.ok);
    return new Response(JSON.stringify({ ok, checks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("[publish-campaign-preflight]", msg, e);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
