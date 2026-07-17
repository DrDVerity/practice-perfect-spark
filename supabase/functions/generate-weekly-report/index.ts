/**
 * generate-weekly-report
 *
 * Generates a professional weekly marketing report PDF for a single account,
 * uploads it to the private `weekly-reports` bucket, and records the row in
 * public.weekly_reports.
 *
 * Body: { accountId: string, weekStart?: string (YYYY-MM-DD, Monday) }
 * If weekStart omitted, uses the most recently completed Mon-Sun window.
 *
 * Callable by:
 *   - authenticated admin/owner/manager (via user JWT), or
 *   - service role (from the cron function) with header `x-service-key`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-service-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtHuman(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const raw of (text || "").split("\n")) {
    if (!raw.trim()) { lines.push(""); continue; }
    const words = raw.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (t.length > max) { if (cur) lines.push(cur); cur = w; } else { cur = t; }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}
function money(n: number) { return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function num(n: number) { return Number(n || 0).toLocaleString(); }
function pct(n: number, d: number) { return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—"; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { accountId, weekStart } = body ?? {};
    if (!accountId) throw new Error("accountId required");

    // Auth: allow service key from cron, otherwise require user JWT with access
    const svcHeader = req.headers.get("x-service-key");
    const isService = svcHeader && svcHeader === SERVICE_KEY;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (!isService) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Unauthorized");
      const anon = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userErr } = await anon.auth.getUser();
      if (userErr || !userData?.user) throw new Error("Unauthorized");
      // Confirm caller has access to the account
      const uid = userData.user.id;
      const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: uid });
      const { data: memberFlag } = await admin.rpc("is_account_member", { _user_id: uid, _account_id: accountId });
      let managerFlag = false;
      if (!adminFlag && !memberFlag) {
        const { data: acct } = await admin.from("accounts").select("owner_user_id").eq("id", accountId).maybeSingle();
        if (acct?.owner_user_id) {
          const { data: m } = await admin.rpc("is_manager_of", { _user_id: uid, _client_id: acct.owner_user_id });
          managerFlag = !!m;
        }
      }
      if (!adminFlag && !memberFlag && !managerFlag) throw new Error("Forbidden");
    }

    // Resolve week window (Mon-Sun, defaults to most recently completed week)
    let start: Date;
    if (weekStart) {
      start = new Date(weekStart + "T00:00:00Z");
    } else {
      const now = new Date();
      // Move to previous Monday
      const day = now.getUTCDay(); // 0=Sun..6=Sat
      const offset = day === 0 ? 13 : 6 + day; // last full Mon
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    }
    const end = new Date(start.getTime() + 6 * 86400000);
    const prevStart = new Date(start.getTime() - 7 * 86400000);
    const prevEnd = new Date(start.getTime() - 1 * 86400000);

    // Load account + owner profile
    const { data: account } = await admin.from("accounts").select("id, name, owner_user_id").eq("id", accountId).maybeSingle();
    if (!account) throw new Error("Account not found");
    const { data: profile } = await admin.from("profiles")
      .select("practice_name, website_url, full_name, email, avg_patient_value_general, avg_patient_value_allonx")
      .eq("user_id", account.owner_user_id).maybeSingle();

    // Campaigns owned by this account owner
    const { data: campaigns } = await admin.from("campaigns")
      .select("id, name, status, start_date, end_date")
      .eq("user_id", account.owner_user_id);
    const campaignIds = (campaigns || []).map((c: any) => c.id);

    // Daily metrics for current + prior week
    const { data: metricsCurr } = campaignIds.length
      ? await admin.from("campaign_daily_metrics")
          .select("campaign_id, platform, date, impressions, clicks, leads, appointments, spend")
          .in("campaign_id", campaignIds)
          .gte("date", fmtDate(start))
          .lte("date", fmtDate(end))
      : { data: [] as any[] };
    const { data: metricsPrev } = campaignIds.length
      ? await admin.from("campaign_daily_metrics")
          .select("impressions, clicks, leads, appointments, spend")
          .in("campaign_id", campaignIds)
          .gte("date", fmtDate(prevStart))
          .lte("date", fmtDate(prevEnd))
      : { data: [] as any[] };

    const sum = (rows: any[], key: string) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
    const curr = {
      impressions: sum(metricsCurr || [], "impressions"),
      clicks: sum(metricsCurr || [], "clicks"),
      leads: sum(metricsCurr || [], "leads"),
      appointments: sum(metricsCurr || [], "appointments"),
      spend: sum(metricsCurr || [], "spend"),
    };
    const prev = {
      impressions: sum(metricsPrev || [], "impressions"),
      clicks: sum(metricsPrev || [], "clicks"),
      leads: sum(metricsPrev || [], "leads"),
      appointments: sum(metricsPrev || [], "appointments"),
      spend: sum(metricsPrev || [], "spend"),
    };

    const avgVal = Number(profile?.avg_patient_value_general || 2500);
    const estRevenue = curr.appointments * avgVal;
    const ctr = curr.impressions > 0 ? (curr.clicks / curr.impressions) * 100 : 0;
    const cvr = curr.clicks > 0 ? (curr.leads / curr.clicks) * 100 : 0;
    const bookRate = curr.leads > 0 ? (curr.appointments / curr.leads) * 100 : 0;

    // Per-platform breakdown
    const perPlatform: Record<string, any> = {};
    for (const r of (metricsCurr || []) as any[]) {
      const p = r.platform || "other";
      perPlatform[p] ??= { impressions: 0, clicks: 0, leads: 0, appointments: 0, spend: 0 };
      perPlatform[p].impressions += r.impressions || 0;
      perPlatform[p].clicks += r.clicks || 0;
      perPlatform[p].leads += r.leads || 0;
      perPlatform[p].appointments += r.appointments || 0;
      perPlatform[p].spend += Number(r.spend || 0);
    }

    // Delta helper
    const delta = (c: number, p: number) => {
      if (p === 0 && c === 0) return "0.0%";
      if (p === 0) return "+∞";
      const d = ((c - p) / p) * 100;
      return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
    };

    // Key takeaways
    const takeaways: string[] = [];
    if (curr.leads > prev.leads) takeaways.push(`Lead volume grew ${delta(curr.leads, prev.leads)} week-over-week to ${num(curr.leads)} new leads.`);
    else if (curr.leads < prev.leads) takeaways.push(`Lead volume dropped ${delta(curr.leads, prev.leads)} week-over-week — worth investigating creative or targeting.`);
    if (curr.appointments > 0) takeaways.push(`${num(curr.appointments)} appointments booked (~${money(estRevenue)} in estimated first-year revenue).`);
    if (curr.impressions > 0) takeaways.push(`Overall CTR was ${ctr.toFixed(2)}% across ${num(curr.impressions)} impressions.`);
    if (Object.keys(perPlatform).length > 0) {
      const best = Object.entries(perPlatform).sort((a, b) => (b[1].leads || 0) - (a[1].leads || 0))[0];
      if (best && best[1].leads > 0) takeaways.push(`Top-performing channel: ${best[0]} with ${num(best[1].leads)} leads.`);
    }
    if (takeaways.length === 0) takeaways.push("No campaign activity recorded this week — schedule new posts to keep momentum.");

    // -------------- BUILD PDF --------------
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${profile?.practice_name || account.name} — Weekly Marketing Report`);
    pdf.setAuthor("Archer — Practice Perfect Marketing Agent");
    pdf.setSubject(`Week of ${fmtHuman(start)}`);

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const NAVY = rgb(0, 0.122, 0.357);
    const GOLD = rgb(0.831, 0.686, 0.216);
    const INK = rgb(0.12, 0.12, 0.12);
    const MUTED = rgb(0.4, 0.4, 0.4);
    const LIGHT = rgb(0.94, 0.94, 0.96);

    const PAGE_W = 612;
    const PAGE_H = 792;
    const MARGIN = 54;

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const practiceName = profile?.practice_name || account.name;

    const letterhead = () => {
      page.drawRectangle({ x: 0, y: PAGE_H - 60, width: PAGE_W, height: 60, color: NAVY });
      page.drawRectangle({ x: 0, y: PAGE_H - 64, width: PAGE_W, height: 4, color: GOLD });
      page.drawText("ARCHER", { x: MARGIN, y: PAGE_H - 30, size: 14, font: bold, color: GOLD });
      page.drawText("Weekly Marketing Report", { x: MARGIN, y: PAGE_H - 48, size: 9, font, color: rgb(0.85, 0.85, 0.9) });
      const wk = `Week of ${fmtHuman(start)} – ${fmtHuman(end)}`;
      const nameLine = practiceName;
      page.drawText(nameLine.slice(0, 40), { x: PAGE_W - MARGIN - font.widthOfTextAtSize(nameLine.slice(0, 40), 10), y: PAGE_H - 28, size: 10, font: bold, color: rgb(1, 1, 1) });
      page.drawText(wk, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(wk, 9), y: PAGE_H - 44, size: 9, font, color: rgb(0.85, 0.85, 0.9) });
    };
    const newPage = () => { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 90; letterhead(); };
    const ensure = (n: number) => { if (y - n < 60) newPage(); };

    const h1 = (t: string) => {
      ensure(40);
      page.drawText(t, { x: MARGIN, y, size: 20, font: bold, color: NAVY });
      y -= 8;
      page.drawRectangle({ x: MARGIN, y: y - 2, width: 48, height: 3, color: GOLD });
      y -= 20;
    };
    const h2 = (t: string) => {
      ensure(24); y -= 4;
      page.drawText(t, { x: MARGIN, y, size: 13, font: bold, color: NAVY });
      y -= 16;
    };
    const p = (t: string, opts: { size?: number; color?: any; maxChars?: number } = {}) => {
      const size = opts.size ?? 10;
      const color = opts.color ?? INK;
      const maxChars = opts.maxChars ?? 92;
      const lines = wrap(t, maxChars);
      for (const l of lines) {
        ensure(size * 1.4);
        page.drawText(l || " ", { x: MARGIN, y, size, font, color });
        y -= size * 1.4;
      }
    };
    const bullet = (t: string) => {
      const lines = wrap(t, 88);
      ensure(14);
      page.drawText("•", { x: MARGIN, y, size: 11, font: bold, color: GOLD });
      page.drawText(lines[0] || "", { x: MARGIN + 14, y, size: 10, font, color: INK });
      y -= 14;
      for (let i = 1; i < lines.length; i++) {
        ensure(14);
        page.drawText(lines[i], { x: MARGIN + 14, y, size: 10, font, color: INK });
        y -= 14;
      }
    };

    // Page 1: Letterhead + Executive Summary
    letterhead();
    y = PAGE_H - 90;

    h1("Executive Summary");
    p(`Prepared for ${practiceName}${profile?.website_url ? ` (${profile.website_url})` : ""}.`);
    p(`Reporting period: ${fmtHuman(start)} through ${fmtHuman(end)}.`);
    y -= 6;

    // Headline KPI grid (2x3)
    const kpis: Array<[string, string, string]> = [
      ["New Leads", num(curr.leads), `${delta(curr.leads, prev.leads)} vs last week`],
      ["Appointments Booked", num(curr.appointments), `${delta(curr.appointments, prev.appointments)} vs last week`],
      ["Ad Spend", money(curr.spend), `${delta(curr.spend, prev.spend)} vs last week`],
      ["Impressions", num(curr.impressions), `${delta(curr.impressions, prev.impressions)} vs last week`],
      ["Clicks", num(curr.clicks), `${delta(curr.clicks, prev.clicks)} vs last week`],
      ["Est. Revenue", money(estRevenue), `Avg patient value ${money(avgVal)}`],
    ];
    const cardW = (PAGE_W - MARGIN * 2 - 20) / 3;
    const cardH = 62;
    ensure(cardH * 2 + 20);
    for (let i = 0; i < kpis.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = MARGIN + col * (cardW + 10);
      const cy = y - row * (cardH + 10);
      page.drawRectangle({ x, y: cy - cardH, width: cardW, height: cardH, color: LIGHT });
      page.drawRectangle({ x, y: cy - cardH, width: 3, height: cardH, color: GOLD });
      page.drawText(kpis[i][0], { x: x + 10, y: cy - 16, size: 8, font: bold, color: MUTED });
      page.drawText(kpis[i][1], { x: x + 10, y: cy - 34, size: 16, font: bold, color: NAVY });
      page.drawText(kpis[i][2], { x: x + 10, y: cy - 52, size: 8, font, color: MUTED });
    }
    y -= cardH * 2 + 24;

    // Marketing funnel
    h2("Marketing Funnel");
    const funnel = [
      ["Impressions", num(curr.impressions), ""],
      ["Clicks", num(curr.clicks), `CTR ${ctr.toFixed(2)}%`],
      ["Leads", num(curr.leads), `CVR ${cvr.toFixed(2)}%`],
      ["Appointments", num(curr.appointments), `Book rate ${bookRate.toFixed(2)}%`],
    ];
    for (const [k, v, note] of funnel) {
      ensure(16);
      page.drawText(k, { x: MARGIN, y, size: 10, font: bold, color: NAVY });
      page.drawText(v, { x: MARGIN + 140, y, size: 10, font, color: INK });
      page.drawText(note, { x: MARGIN + 240, y, size: 9, font, color: MUTED });
      y -= 14;
    }

    // Key Takeaways
    y -= 8;
    h2("Key Takeaways");
    for (const t of takeaways) bullet(t);

    // Per-platform table
    if (Object.keys(perPlatform).length > 0) {
      y -= 8;
      h2("Channel Performance");
      const cx = [MARGIN, MARGIN + 110, MARGIN + 180, MARGIN + 250, MARGIN + 320, MARGIN + 400];
      ensure(18);
      const hdrs = ["Channel", "Impr.", "Clicks", "Leads", "Appts", "Spend"];
      hdrs.forEach((h, i) => page.drawText(h, { x: cx[i], y, size: 9, font: bold, color: MUTED }));
      y -= 12;
      page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 }, color: GOLD, thickness: 0.6 });
      for (const [plat, s] of Object.entries(perPlatform) as any) {
        ensure(14);
        page.drawText(String(plat).slice(0, 16), { x: cx[0], y, size: 10, font, color: INK });
        page.drawText(num(s.impressions), { x: cx[1], y, size: 10, font, color: INK });
        page.drawText(num(s.clicks), { x: cx[2], y, size: 10, font, color: INK });
        page.drawText(num(s.leads), { x: cx[3], y, size: 10, font: bold, color: NAVY });
        page.drawText(num(s.appointments), { x: cx[4], y, size: 10, font: bold, color: NAVY });
        page.drawText(money(s.spend), { x: cx[5], y, size: 10, font, color: INK });
        y -= 14;
      }
    }

    // Campaign snapshot
    if (campaigns && campaigns.length > 0) {
      y -= 8;
      h2("Active Campaigns");
      for (const c of campaigns as any[]) {
        ensure(16);
        page.drawText(`• ${String(c.name).slice(0, 60)}`, { x: MARGIN, y, size: 10, font: bold, color: INK });
        page.drawText(String(c.status || "").toUpperCase(), { x: PAGE_W - MARGIN - 80, y, size: 8, font: bold, color: GOLD });
        y -= 14;
      }
    }

    // Footer on every page
    const pageCount = pdf.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const pg = pdf.getPage(i);
      pg.drawText("Prepared by Archer — Practice Perfect Marketing Agent", { x: MARGIN, y: 24, size: 8, font, color: MUTED });
      const pn = `Page ${i + 1} of ${pageCount}`;
      pg.drawText(pn, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(pn, 8), y: 24, size: 8, font, color: MUTED });
      pg.drawText(new Date().toLocaleDateString(), { x: PAGE_W / 2 - 30, y: 24, size: 8, font, color: MUTED });
    }

    const pdfBytes = await pdf.save();
    const path = `${accountId}/${fmtDate(start)}.pdf`;
    const { error: upErr } = await admin.storage.from("weekly-reports").upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw upErr;

    // Signed URL (7 days)
    const { data: signed } = await admin.storage.from("weekly-reports").createSignedUrl(path, 60 * 60 * 24 * 7);
    const pdfUrl = signed?.signedUrl || path;

    const metricsJson = {
      current: curr,
      previous: prev,
      per_platform: perPlatform,
      est_revenue: estRevenue,
      takeaways,
    };

    const { data: row, error: rowErr } = await admin.from("weekly_reports").upsert({
      account_id: accountId,
      week_start: fmtDate(start),
      week_end: fmtDate(end),
      pdf_url: pdfUrl,
      metrics_json: metricsJson,
      generated_at: new Date().toISOString(),
    }, { onConflict: "account_id,week_start" }).select().maybeSingle();
    if (rowErr) throw rowErr;

    return new Response(JSON.stringify({ ok: true, report: row, pdfUrl, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("generate-weekly-report error:", msg);
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
