/**
 * weekly-report-cron
 *
 * Runs every Monday morning. For each active account:
 *   1. Calls generate-weekly-report to produce/refresh the PDF.
 *   2. Emails the practice owner and assigned marketing managers with a
 *      signed link to the PDF (via SendGrid, matching send-campaign-message).
 *
 * Callable by pg_cron via net.http_post (no user JWT). Requires `x-cron-key`
 * matching SUPABASE_SERVICE_ROLE_KEY to avoid public abuse.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const FROM_DOMAIN = "mg.archerdental.marketing";
const FROM_EMAIL = `reports@${FROM_DOMAIN}`;

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY missing; skipping email to", to);
    return { ok: false, skipped: true };
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SENDGRID_API_KEY}` },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: FROM_EMAIL, name: "Archer Weekly Reports" },
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`SendGrid ${res.status} for ${to}:`, body);
    return { ok: false, error: body };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cronKey = req.headers.get("x-cron-key");
    if (cronKey !== SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch all accounts (skip deleted profile owners)
    const { data: accounts, error: acctErr } = await admin.from("accounts").select("id, owner_user_id, name");
    if (acctErr) throw acctErr;

    const results: any[] = [];
    for (const acct of accounts || []) {
      try {
        // 1) Generate the report
        const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-weekly-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-service-key": SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ accountId: acct.id }),
        });
        const genBody = await genRes.json().catch(() => ({}));
        if (!genRes.ok) {
          results.push({ account_id: acct.id, status: "generate_failed", details: genBody });
          continue;
        }
        const pdfUrl: string = genBody.pdfUrl;

        // 2) Recipients: owner + assigned marketing managers + account members with role 'owner'
        const recipients = new Set<string>();

        const { data: ownerProfile } = await admin.from("profiles")
          .select("email, practice_name, full_name").eq("user_id", acct.owner_user_id).maybeSingle();
        if (ownerProfile?.email) recipients.add(ownerProfile.email);

        const { data: mgrAssign } = await admin.from("manager_assignments")
          .select("manager_user_id").eq("client_user_id", acct.owner_user_id);
        const mgrIds = (mgrAssign || []).map((m: any) => m.manager_user_id);
        if (mgrIds.length > 0) {
          const { data: mgrs } = await admin.from("profiles").select("email").in("user_id", mgrIds);
          for (const m of mgrs || []) if (m.email) recipients.add(m.email);
        }

        // Also any account member with role 'owner' (practice manager access)
        const { data: members } = await admin.from("account_members")
          .select("user_id, role").eq("account_id", acct.id).eq("role", "owner");
        const memberIds = (members || []).map((m: any) => m.user_id);
        if (memberIds.length > 0) {
          const { data: memberProfiles } = await admin.from("profiles").select("email").in("user_id", memberIds);
          for (const m of memberProfiles || []) if (m.email) recipients.add(m.email);
        }

        if (recipients.size === 0) {
          results.push({ account_id: acct.id, status: "generated_no_recipients" });
          continue;
        }

        const practiceName = ownerProfile?.practice_name || acct.name;
        const subject = `Your weekly marketing report — ${practiceName}`;
        const text = `Your weekly marketing report is ready.\n\nDownload it here (link expires in 7 days):\n${pdfUrl}\n\nPrepared by Archer — Practice Perfect Marketing Agent.`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color:#111;">
            <div style="background:#001f5b; padding:20px 24px;">
              <div style="color:#d4af37; font-weight:bold; letter-spacing:1px; font-size:14px;">ARCHER</div>
              <div style="color:#fff; font-size:18px; margin-top:4px;">Weekly Marketing Report</div>
            </div>
            <div style="padding:24px;">
              <p>Hi ${ownerProfile?.full_name || "there"},</p>
              <p>Your marketing report for <strong>${practiceName}</strong> is ready. It includes lead volume, appointment bookings, ad spend, and per-channel performance versus last week.</p>
              <p style="text-align:center; margin: 32px 0;">
                <a href="${pdfUrl}" style="background:#001f5b; color:#fff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Download report (PDF)</a>
              </p>
              <p style="color:#666; font-size:12px;">This link expires in 7 days. You can also view all past reports inside your Archer dashboard.</p>
            </div>
            <div style="background:#f4f4f6; padding:16px 24px; font-size:12px; color:#666;">
              Prepared by Archer — Practice Perfect Marketing Agent.
            </div>
          </div>
        `;

        const sends: any[] = [];
        for (const rcpt of recipients) {
          const r = await sendEmail(rcpt, subject, html, text);
          sends.push({ to: rcpt, ...r });
        }
        results.push({ account_id: acct.id, status: "sent", recipients: sends.length, sends });
      } catch (inner: any) {
        console.error(`weekly-report-cron account ${acct.id} error:`, inner);
        results.push({ account_id: acct.id, status: "error", error: String(inner?.message || inner) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("weekly-report-cron error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
