import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 255;
}
function isStr(v: unknown, max = 1000): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { campaign_id, name, email, phone, message, source_url } = body || {};

    if (!isStr(campaign_id, 64)) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isEmail(email)) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (name && !isStr(name, 200)) {
      return new Response(JSON.stringify({ error: "Invalid name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (phone && (typeof phone !== "string" || phone.length > 40)) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message && (typeof message !== "string" || message.length > 4000)) {
      return new Response(JSON.stringify({ error: "Message too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve campaign -> account + owner
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, name, user_id")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the owner's account (first owned account)
    const { data: acct } = await supabase
      .from("accounts")
      .select("id, name, owner_user_id")
      .eq("owner_user_id", campaign.user_id)
      .maybeSingle();

    const accountId = acct?.id;
    if (!accountId) {
      return new Response(JSON.stringify({ error: "Account not found for campaign owner" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit by campaign_id to prevent spam
    const { data: ok } = await supabase.rpc("check_and_consume_rate_limit", {
      _user_id: campaign.user_id,
      _endpoint: `landing-page-lead:${campaign_id}`,
      _max_per_minute: 20,
    });
    if (ok === false) {
      return new Response(JSON.stringify({ error: "Too many submissions, please try later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: insErr } = await supabase
      .from("landing_page_leads")
      .insert({
        campaign_id,
        account_id: accountId,
        name: name || null,
        email,
        phone: phone || null,
        message: message || null,
        source_url: source_url || null,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    // Best-effort: send transactional email to account owner
    try {
      const { data: ownerProfile } = await supabase
        .from("profiles").select("email, practice_name")
        .eq("user_id", campaign.user_id).maybeSingle();
      if (ownerProfile?.email) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "landing-page-lead-notification",
            recipientEmail: ownerProfile.email,
            idempotencyKey: `lead-${lead.id}`,
            templateData: {
              practiceName: ownerProfile.practice_name || "your practice",
              campaignName: campaign.name || "your campaign",
              leadName: name || "(no name)",
              leadEmail: email,
              leadPhone: phone || "(none)",
              leadMessage: message || "(no message)",
            },
          },
        });
      }
    } catch (e) {
      console.warn("Lead notification email failed (non-fatal):", e);
    }

    // In-app message (owner sees it in their dashboard)
    try {
      await supabase.from("messages").insert({
        sender_id: campaign.user_id,
        recipient_id: campaign.user_id,
        campaign_id,
        subject: `New lead — ${campaign.name || "campaign"}`,
        body: `${name || "(no name)"} <${email}>${phone ? " · " + phone : ""}\n\n${message || "(no message)"}`,
        read: false,
      } as any);
    } catch (e) {
      console.warn("In-app lead message failed (non-fatal):", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("landing-page-lead error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
