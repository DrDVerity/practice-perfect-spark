/**
 * generate-strategy-pdf  (auth required)
 *
 * Renders a campaign's strategic plan + budget worksheet as a professional PDF
 * using pdf-lib, uploads it to the `landing-pages` storage bucket (public),
 * and stores the URL on campaigns.strategy_pdf_url.
 *
 * Body: { campaignId: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) { lines.push(""); continue; }
    const words = raw.split(/\s+/);
    let current = "";
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (test.length > maxChars) {
        if (current) lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Unauthorized");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: campaign } = await admin.from("campaigns")
      .select("id, name, focus, target_audience, strategy, step_plan, start_date, end_date, user_id")
      .eq("id", campaignId).maybeSingle();
    if (!campaign) throw new Error("Campaign not found");

    const { data: profile } = await admin.from("profiles")
      .select("practice_name, website_url").eq("user_id", campaign.user_id).maybeSingle();
    const { data: budget } = await admin.from("campaign_budgets")
      .select("total_amount, currency, allocations, notes")
      .eq("campaign_id", campaignId).maybeSingle();
    const { data: addons } = await admin.from("campaign_addons")
      .select("name, description, budget_amount, budget_currency").eq("campaign_id", campaignId);

    // --- Build PDF ---
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${campaign.name} — Strategic Plan`);
    pdf.setAuthor(profile?.practice_name || "Synergy Dental Marketing");
    pdf.setSubject("Campaign Strategic Plan");
    pdf.setCreator("Synergy Dental Marketing Agent");

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const NAVY = rgb(0, 0.122, 0.357); // #001f5b
    const GOLD = rgb(0.831, 0.686, 0.216); // #d4af37
    const INK = rgb(0.12, 0.12, 0.12);
    const MUTED = rgb(0.4, 0.4, 0.4);

    const PAGE_W = 612;
    const PAGE_H = 792;
    const MARGIN = 54;
    const MAX_CHARS_BODY = 90;
    const MAX_CHARS_H2 = 60;

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      // Header stripe
      page.drawRectangle({ x: 0, y: PAGE_H - 20, width: PAGE_W, height: 20, color: NAVY });
      page.drawText(profile?.practice_name || "Strategic Plan", {
        x: MARGIN, y: PAGE_H - 14, size: 9, font: bold, color: rgb(1, 1, 1),
      });
    };

    const ensureSpace = (needed: number) => {
      if (y - needed < MARGIN + 30) newPage();
    };

    const drawText = (text: string, opts: { size?: number; font?: any; color?: any; leading?: number; maxChars?: number } = {}) => {
      const size = opts.size ?? 11;
      const f = opts.font ?? font;
      const color = opts.color ?? INK;
      const leading = opts.leading ?? size * 1.4;
      const maxChars = opts.maxChars ?? MAX_CHARS_BODY;
      const lines = wrapText(text, maxChars);
      for (const line of lines) {
        ensureSpace(leading);
        page.drawText(line || " ", { x: MARGIN, y, size, font: f, color });
        y -= leading;
      }
    };

    const h1 = (t: string) => {
      ensureSpace(40);
      page.drawText(t, { x: MARGIN, y, size: 22, font: bold, color: NAVY });
      y -= 8;
      page.drawRectangle({ x: MARGIN, y: y - 2, width: 60, height: 3, color: GOLD });
      y -= 22;
    };

    const h2 = (t: string) => {
      ensureSpace(28);
      y -= 6;
      page.drawText(t, { x: MARGIN, y, size: 14, font: bold, color: NAVY });
      y -= 18;
    };

    // ============ COVER ============
    page.drawRectangle({ x: 0, y: PAGE_H - 220, width: PAGE_W, height: 220, color: NAVY });
    page.drawRectangle({ x: 0, y: PAGE_H - 226, width: PAGE_W, height: 6, color: GOLD });
    page.drawText("STRATEGIC MARKETING PLAN", {
      x: MARGIN, y: PAGE_H - 100, size: 12, font: bold, color: GOLD,
    });
    const nameLines = wrapText(campaign.name || "Campaign", 34);
    let cy = PAGE_H - 130;
    for (const line of nameLines.slice(0, 3)) {
      page.drawText(line, { x: MARGIN, y: cy, size: 28, font: bold, color: rgb(1, 1, 1) });
      cy -= 32;
    }
    page.drawText(profile?.practice_name || "Your Practice", {
      x: MARGIN, y: PAGE_H - 200, size: 12, font, color: rgb(0.85, 0.85, 0.9),
    });
    y = PAGE_H - 260;

    // Meta table
    const rows: Array<[string, string]> = [
      ["Prepared for", profile?.practice_name || "—"],
      ["Website", profile?.website_url || "—"],
      ["Campaign focus", campaign.focus || "—"],
      ["Target audience", campaign.target_audience || "—"],
      ["Start date", campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : "—"],
      ["End date", campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : "—"],
      ["Total budget", budget?.total_amount != null ? `${budget.currency || "USD"} ${Number(budget.total_amount).toLocaleString()}` : "—"],
      ["Generated", new Date().toLocaleString()],
    ];
    for (const [k, v] of rows) {
      ensureSpace(18);
      page.drawText(k, { x: MARGIN, y, size: 10, font: bold, color: MUTED });
      const vLines = wrapText(v, 60);
      page.drawText(vLines[0] || "—", { x: MARGIN + 130, y, size: 11, font, color: INK });
      y -= 16;
      for (let i = 1; i < vLines.length; i++) {
        ensureSpace(16);
        page.drawText(vLines[i], { x: MARGIN + 130, y, size: 11, font, color: INK });
        y -= 16;
      }
    }

    // ============ STRATEGY ============
    newPage();
    h1("Strategy");
    const strategyText = stripHtml(campaign.strategy) || "No strategy content available.";
    drawText(strategyText, { size: 11 });

    // ============ STEP-BY-STEP PLAN ============
    const steps = (campaign.step_plan as any)?.steps || (Array.isArray(campaign.step_plan) ? campaign.step_plan : null);
    if (steps && Array.isArray(steps) && steps.length > 0) {
      newPage();
      h1("Step-by-step plan");
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i] as any;
        const title = typeof s === "string" ? s : (s?.title || s?.name || `Step ${i + 1}`);
        const detail = typeof s === "string" ? "" : (s?.description || s?.detail || s?.body || "");
        h2(`${i + 1}. ${title}`);
        if (detail) drawText(String(detail), { size: 10 });
      }
    }

    // ============ BUDGET WORKSHEET ============
    newPage();
    h1("Budget worksheet");
    if (budget?.total_amount != null) {
      drawText(`Total budget: ${budget.currency || "USD"} ${Number(budget.total_amount).toLocaleString()}`, { size: 12, font: bold });
      y -= 6;
    }

    const allocations = budget?.allocations as Record<string, any> | null | undefined;
    if (allocations && Object.keys(allocations).length > 0) {
      h2("Allocations");
      // Simple table
      const colX = [MARGIN, MARGIN + 260, MARGIN + 400];
      ensureSpace(20);
      page.drawText("Line item", { x: colX[0], y, size: 10, font: bold, color: MUTED });
      page.drawText("Type", { x: colX[1], y, size: 10, font: bold, color: MUTED });
      page.drawText("Amount", { x: colX[2], y, size: 10, font: bold, color: MUTED });
      y -= 14;
      page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 }, color: GOLD, thickness: 0.8 });

      for (const [key, val] of Object.entries(allocations)) {
        ensureSpace(16);
        const [type, ...rest] = key.split(":");
        const label = rest.join(":") || key;
        const amount = typeof val === "number" ? val : (val as any)?.amount ?? 0;
        page.drawText(label.slice(0, 45), { x: colX[0], y, size: 10, font, color: INK });
        page.drawText(type || "—", { x: colX[1], y, size: 10, font, color: MUTED });
        page.drawText(`$${Number(amount).toLocaleString()}`, { x: colX[2], y, size: 10, font: bold, color: INK });
        y -= 14;
      }
    } else {
      drawText("No allocations set. The manager should distribute the total budget across the campaign channels and add-ons before publishing.", { size: 10, color: MUTED });
    }

    if (addons && addons.length > 0) {
      h2("Add-ons");
      for (const a of addons) {
        ensureSpace(28);
        page.drawText(`• ${a.name}`, { x: MARGIN, y, size: 11, font: bold, color: INK });
        if (a.budget_amount != null) {
          page.drawText(`${a.budget_currency || "USD"} ${Number(a.budget_amount).toLocaleString()}`, {
            x: PAGE_W - MARGIN - 100, y, size: 10, font: bold, color: NAVY,
          });
        }
        y -= 14;
        if (a.description) drawText(String(a.description), { size: 9, color: MUTED, maxChars: 100 });
      }
    }

    if (budget?.notes) {
      h2("Notes");
      drawText(String(budget.notes), { size: 10 });
    }

    // ============ SIGNATURE BLOCK ============
    ensureSpace(80);
    y -= 20;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, color: MUTED, thickness: 0.5 });
    y -= 20;
    drawText("Prepared by Synergy Dental Marketing Agent. Owner or practice manager approval is required before this budget can be executed.", { size: 9, color: MUTED });

    // Footer page numbers
    const pageCount = pdf.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const p = pdf.getPage(i);
      p.drawText(`${i + 1} / ${pageCount}`, {
        x: PAGE_W - MARGIN - 30, y: 20, size: 8, font, color: MUTED,
      });
      p.drawText(profile?.practice_name || "Strategic Plan", {
        x: MARGIN, y: 20, size: 8, font, color: MUTED,
      });
    }

    const pdfBytes = await pdf.save();

    const path = `strategy-plans/${campaignId}-${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from("landing-pages").upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw upErr;
    const { data: pub } = admin.storage.from("landing-pages").getPublicUrl(path);
    const url = pub.publicUrl;

    await admin.from("campaigns").update({ strategy_pdf_url: url }).eq("id", campaignId);

    return new Response(JSON.stringify({ ok: true, url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("generate-strategy-pdf error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
