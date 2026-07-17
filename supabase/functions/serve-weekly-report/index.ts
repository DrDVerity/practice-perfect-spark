/**
 * serve-weekly-report
 *
 * Authenticated proxy for weekly report PDFs. The client receives a base64 PDF
 * payload from this function, so browser PDF viewers never navigate to the
 * backend storage host directly.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function safeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "weekly-marketing-report";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { reportId } = await req.json().catch(() => ({}));
    if (!reportId) throw new Error("reportId required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Unauthorized");
    const uid = userData.user.id;

    const { data: report, error: reportErr } = await admin
      .from("weekly_reports")
      .select("id, account_id, week_start, week_end")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr) throw reportErr;
    if (!report) throw new Error("Report not found");

    const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: uid });
    const { data: memberFlag } = await admin.rpc("is_account_member", {
      _user_id: uid,
      _account_id: report.account_id,
    });

    let managerFlag = false;
    if (!adminFlag && !memberFlag) {
      const { data: acct } = await admin
        .from("accounts")
        .select("owner_user_id")
        .eq("id", report.account_id)
        .maybeSingle();
      if (acct?.owner_user_id) {
        const { data: m } = await admin.rpc("is_manager_of", {
          _user_id: uid,
          _client_id: acct.owner_user_id,
        });
        managerFlag = !!m;
      }
    }

    if (!adminFlag && !memberFlag && !managerFlag) throw new Error("Forbidden");

    const storagePath = `${report.account_id}/${report.week_start}.pdf`;
    const { data: file, error: downloadErr } = await admin.storage.from("weekly-reports").download(storagePath);
    if (downloadErr || !file) throw downloadErr || new Error("Report PDF not found");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename = `${safeFilename(`weekly-report-${report.week_start}-to-${report.week_end}`)}.pdf`;

    return new Response(JSON.stringify({
      filename,
      mimeType: "application/pdf",
      base64: toBase64(bytes),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : msg === "Report not found" ? 404 : 400;
    console.error("serve-weekly-report error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});