/**
 * generate-report-pdf  (public — no auth)
 *
 * Renders a prospect research report as a professional, branded, print-ready PDF.
 *
 * Body: { prospectId: string, docType: string }
 * Returns: application/pdf bytes (inline).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REPORT_LABELS: Record<string, string> = {
  practice_analysis: "Practice Analysis",
  competitive_analysis: "Competitive Analysis",
  audience_analysis: "Audience Analysis",
  brand_guidelines: "Brand Guidelines",
};

function sanitize(s: string): string {
  // pdf-lib's WinAnsi encoding rejects most non-latin chars; normalize the common ones.
  return (s || "")
    .replace(/\r/g, "")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022\u25CF\u25E6]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x20-\x7E]/g, ""); // drop remaining non-ASCII
}

interface Token {
  kind: "h1" | "h2" | "h3" | "bullet" | "para" | "blank" | "hr";
  text: string;
  bold?: boolean;
}

function tokenize(md: string): Token[] {
  const lines = sanitize(md).split("\n");
  const out: Token[] = [];
  let inFence = false;
  let paraBuf: string[] = [];
  const flushPara = () => {
    if (paraBuf.length) {
      out.push({ kind: "para", text: paraBuf.join(" ").trim() });
      paraBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (line.startsWith("```")) { flushPara(); inFence = !inFence; continue; }
    if (inFence) continue;
    if (!line.trim()) { flushPara(); out.push({ kind: "blank", text: "" }); continue; }
    if (/^#{1}\s+/.test(line)) { flushPara(); out.push({ kind: "h1", text: line.replace(/^#\s+/, "").trim() }); continue; }
    if (/^#{2}\s+/.test(line)) { flushPara(); out.push({ kind: "h2", text: line.replace(/^##\s+/, "").trim() }); continue; }
    if (/^#{3,}\s+/.test(line)) { flushPara(); out.push({ kind: "h3", text: line.replace(/^#{3,}\s+/, "").trim() }); continue; }
    if (/^\s*[-*]\s+/.test(line)) { flushPara(); out.push({ kind: "bullet", text: line.replace(/^\s*[-*]\s+/, "").trim() }); continue; }
    if (/^\s*\d+\.\s+/.test(line)) { flushPara(); out.push({ kind: "bullet", text: line.replace(/^\s*\d+\.\s+/, "").trim() }); continue; }
    if (/^---+$/.test(line.trim())) { flushPara(); out.push({ kind: "hr", text: "" }); continue; }
    paraBuf.push(line.trim());
  }
  flushPara();
  return out;
}

// Split inline **bold** into runs of {text, bold}
function splitBold(text: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts.length ? parts : [{ text, bold: false }];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { prospectId, docType } = await req.json();
    if (!prospectId || !docType) throw new Error("prospectId and docType required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: doc, error: docErr } = await admin
      .from("prospect_documents")
      .select("title, content, metadata, doc_type, prospect_id")
      .eq("prospect_id", prospectId)
      .eq("doc_type", docType)
      .maybeSingle();
    if (docErr) throw docErr;
    if (!doc) throw new Error("Report not found");

    const { data: prospect } = await admin
      .from("prospect_accounts")
      .select("practice_name, website_url, target_audience, campaign_focus")
      .eq("id", prospectId)
      .maybeSingle();

    const practiceName = sanitize(prospect?.practice_name || "Your Practice");
    const website = sanitize(prospect?.website_url || "");
    const reportTitle = sanitize(REPORT_LABELS[docType] || doc.title || "Research Report");

    // --- Build PDF ---
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${practiceName} — ${reportTitle}`);
    pdf.setAuthor("Archer — Practice Perfect Marketing Agent");
    pdf.setSubject(reportTitle);
    pdf.setCreator("Practice Perfect Marketing Agent");

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

    const NAVY = rgb(0, 0.122, 0.357);
    const GOLD = rgb(0.831, 0.686, 0.216);
    const INK = rgb(0.12, 0.12, 0.12);
    const MUTED = rgb(0.45, 0.45, 0.45);
    const WHITE = rgb(1, 1, 1);

    const PAGE_W = 612;
    const PAGE_H = 792;
    const MARGIN_X = 60;
    const MARGIN_TOP = 90;   // room for letterhead
    const MARGIN_BOTTOM = 60; // room for footer

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN_TOP;

    const drawLetterhead = (p: any) => {
      // Navy band
      p.drawRectangle({ x: 0, y: PAGE_H - 54, width: PAGE_W, height: 54, color: NAVY });
      // Gold accent rule
      p.drawRectangle({ x: 0, y: PAGE_H - 58, width: PAGE_W, height: 3, color: GOLD });
      // Wordmark left
      p.drawText("ARCHER", { x: MARGIN_X, y: PAGE_H - 28, size: 14, font: bold, color: WHITE });
      p.drawText("Practice Perfect Marketing Agent", {
        x: MARGIN_X, y: PAGE_H - 44, size: 8, font, color: rgb(0.85, 0.85, 0.9),
      });
      // Report title right (truncate to fit)
      const titleRight = reportTitle.length > 34 ? reportTitle.slice(0, 33) + "…" : reportTitle;
      const titleW = bold.widthOfTextAtSize(titleRight, 11);
      p.drawText(titleRight, { x: PAGE_W - MARGIN_X - titleW, y: PAGE_H - 28, size: 11, font: bold, color: GOLD });
      const practiceRight = practiceName.length > 44 ? practiceName.slice(0, 43) + "…" : practiceName;
      const pW = font.widthOfTextAtSize(practiceRight, 9);
      p.drawText(practiceRight, { x: PAGE_W - MARGIN_X - pW, y: PAGE_H - 44, size: 9, font, color: rgb(0.85, 0.85, 0.9) });
    };

    drawLetterhead(page);

    const contentW = PAGE_W - MARGIN_X * 2;

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawLetterhead(page);
      y = PAGE_H - MARGIN_TOP;
    };

    const ensureSpace = (needed: number) => {
      if (y - needed < MARGIN_BOTTOM) newPage();
    };

    // Word-wrap runs against a max pixel width. Runs mix bold + regular.
    const wrapRuns = (
      runs: Array<{ text: string; bold: boolean }>,
      size: number,
      maxW: number,
    ): Array<Array<{ text: string; bold: boolean; w: number }>> => {
      const words: Array<{ text: string; bold: boolean }> = [];
      for (const r of runs) {
        const parts = r.text.split(/(\s+)/);
        for (const p of parts) if (p !== "") words.push({ text: p, bold: r.bold });
      }
      const lines: Array<Array<{ text: string; bold: boolean; w: number }>> = [];
      let line: Array<{ text: string; bold: boolean; w: number }> = [];
      let lineW = 0;
      const widthOf = (t: string, b: boolean) => (b ? bold : font).widthOfTextAtSize(t, size);
      for (const w of words) {
        const isSpace = /^\s+$/.test(w.text);
        const ww = widthOf(w.text, w.bold);
        if (line.length === 0 && isSpace) continue;
        if (lineW + ww > maxW && line.length > 0) {
          // trim trailing spaces
          while (line.length && /^\s+$/.test(line[line.length - 1].text)) {
            lineW -= line[line.length - 1].w;
            line.pop();
          }
          lines.push(line);
          line = [];
          lineW = 0;
          if (isSpace) continue;
        }
        line.push({ text: w.text, bold: w.bold, w: ww });
        lineW += ww;
      }
      if (line.length) lines.push(line);
      return lines;
    };

    const drawRuns = (
      runs: Array<{ text: string; bold: boolean }>,
      opts: { size?: number; leading?: number; indent?: number; color?: any } = {},
    ) => {
      const size = opts.size ?? 10.5;
      const leading = opts.leading ?? size * 1.5;
      const indent = opts.indent ?? 0;
      const color = opts.color ?? INK;
      const maxW = contentW - indent;
      const lines = wrapRuns(runs, size, maxW);
      for (const line of lines) {
        ensureSpace(leading);
        let x = MARGIN_X + indent;
        for (const seg of line) {
          if (/^\s+$/.test(seg.text)) { x += seg.w; continue; }
          page.drawText(seg.text, { x, y: y - size, size, font: seg.bold ? bold : font, color });
          x += seg.w;
        }
        y -= leading;
      }
    };

    // ============ COVER ============
    // Big title block
    y = PAGE_H - MARGIN_TOP - 30;
    ensureSpace(120);
    page.drawText("RESEARCH REPORT", { x: MARGIN_X, y, size: 10, font: bold, color: GOLD });
    y -= 30;
    // Title (wrap manually at ~24pt)
    const titleWords = reportTitle.split(/\s+/);
    const titleLines: string[] = [];
    let cur = "";
    for (const w of titleWords) {
      const test = cur ? `${cur} ${w}` : w;
      if (bold.widthOfTextAtSize(test, 26) > contentW) {
        if (cur) titleLines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) titleLines.push(cur);
    for (const line of titleLines) {
      ensureSpace(32);
      page.drawText(line, { x: MARGIN_X, y: y - 26, size: 26, font: bold, color: NAVY });
      y -= 32;
    }
    y -= 6;
    page.drawRectangle({ x: MARGIN_X, y, width: 60, height: 3, color: GOLD });
    y -= 24;

    // Meta rows
    const meta: Array<[string, string]> = [
      ["Prepared for", practiceName],
      ["Website", website || "—"],
      ["Generated", new Date().toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      })],
    ];
    for (const [k, v] of meta) {
      ensureSpace(18);
      page.drawText(k.toUpperCase(), { x: MARGIN_X, y: y - 9, size: 8, font: bold, color: MUTED });
      const vLines = wrapRuns([{ text: v, bold: false }], 11, contentW - 130);
      let vy = y;
      for (const line of vLines) {
        let x = MARGIN_X + 130;
        for (const seg of line) {
          if (/^\s+$/.test(seg.text)) { x += seg.w; continue; }
          page.drawText(seg.text, { x, y: vy - 11, size: 11, font, color: INK });
          x += seg.w;
        }
        vy -= 16;
      }
      y = Math.min(y - 18, vy);
    }

    y -= 12;
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, color: GOLD, thickness: 1 });
    y -= 24;

    // ============ BODY ============
    const tokens = tokenize(String(doc.content || ""));
    for (const t of tokens) {
      if (t.kind === "blank") { y -= 6; continue; }
      if (t.kind === "hr") {
        ensureSpace(16);
        y -= 6;
        page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, color: MUTED, thickness: 0.4 });
        y -= 10;
        continue;
      }
      if (t.kind === "h1") {
        ensureSpace(40);
        y -= 8;
        drawRuns(splitBold(t.text), { size: 18, leading: 22, color: NAVY });
        page.drawRectangle({ x: MARGIN_X, y: y + 2, width: 40, height: 2, color: GOLD });
        y -= 10;
        continue;
      }
      if (t.kind === "h2") {
        ensureSpace(30);
        y -= 6;
        drawRuns(splitBold(t.text), { size: 14, leading: 18, color: NAVY });
        y -= 4;
        continue;
      }
      if (t.kind === "h3") {
        ensureSpace(22);
        y -= 4;
        drawRuns(splitBold(t.text), { size: 11.5, leading: 15, color: NAVY });
        y -= 2;
        continue;
      }
      if (t.kind === "bullet") {
        ensureSpace(16);
        // Bullet glyph
        page.drawCircle({ x: MARGIN_X + 6, y: y - 5, size: 1.6, color: GOLD });
        drawRuns(splitBold(t.text), { size: 10.5, leading: 15, indent: 18 });
        continue;
      }
      // paragraph
      drawRuns(splitBold(t.text), { size: 10.5, leading: 15.5 });
      y -= 4;
    }

    // ============ FOOTERS ============
    const pageCount = pdf.getPageCount();
    const genDate = new Date().toLocaleDateString();
    for (let i = 0; i < pageCount; i++) {
      const p = pdf.getPage(i);
      // Divider
      p.drawLine({
        start: { x: MARGIN_X, y: 40 }, end: { x: PAGE_W - MARGIN_X, y: 40 },
        color: rgb(0.85, 0.85, 0.85), thickness: 0.5,
      });
      p.drawText("Prepared by Archer — Practice Perfect Marketing Agent", {
        x: MARGIN_X, y: 26, size: 8, font: italic, color: MUTED,
      });
      const dateW = font.widthOfTextAtSize(genDate, 8);
      p.drawText(genDate, { x: (PAGE_W - dateW) / 2, y: 26, size: 8, font, color: MUTED });
      const pn = `Page ${i + 1} of ${pageCount}`;
      const pnW = font.widthOfTextAtSize(pn, 8);
      p.drawText(pn, { x: PAGE_W - MARGIN_X - pnW, y: 26, size: 8, font, color: MUTED });
    }

    const bytes = await pdf.save();
    const filename = `${practiceName.replace(/[^A-Za-z0-9]+/g, "_")}_${reportTitle.replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;

    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("generate-report-pdf error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
