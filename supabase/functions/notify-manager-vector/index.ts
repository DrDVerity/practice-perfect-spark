import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId, addonType, addonLabel } = await req.json();
    if (!campaignId || !addonType) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fetch campaign + client info
    const { data: campaign } = await admin
      .from("campaigns")
      .select("id, name, user_id")
      .eq("id", campaignId)
      .maybeSingle();

    if (!campaign) {
      return new Response(JSON.stringify({ error: "campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientUserId = campaign.user_id as string;
    const campaignName = campaign.name as string;
    const label = addonLabel || addonType;

    // Find manager assignment
    const { data: assignment } = await admin
      .from("manager_assignments")
      .select("manager_user_id")
      .eq("client_user_id", clientUserId)
      .maybeSingle();

    const managerUserId = assignment?.manager_user_id ?? null;

    if (managerUserId) {
      // Notify manager
      const { data: mgrProfile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", managerUserId)
        .maybeSingle();

      const subject = `Vector requires implementation: ${label} (${campaignName})`;
      const body = `A new campaign vector **${label}** was added to **${campaignName}**.\n\nThis vector requires ad-spend investment. Please implement the vector and manage the budget allocation accordingly.`;

      await admin.from("messages").insert({
        sender_id: clientUserId,
        recipient_id: managerUserId,
        campaign_id: campaignId,
        subject,
        body,
        read: false,
      });

      if (mgrProfile?.email) {
        try {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "manager-vector-implementation",
              recipientEmail: mgrProfile.email,
              idempotencyKey: `vector-${campaignId}-${addonType}-${Date.now()}`,
              templateData: {
                managerName: mgrProfile.full_name || "Manager",
                campaignName,
                vectorLabel: label,
              },
            },
          });
        } catch (e) { console.warn("email send skipped", e); }
      }

      return new Response(JSON.stringify({ ok: true, notified: "manager", managerUserId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No manager — notify all admins
    const { data: adminRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (adminRoles || []).map((r: any) => r.user_id);
    const { data: adminProfiles } = adminIds.length
      ? await admin.from("profiles").select("user_id, email, full_name").in("user_id", adminIds)
      : { data: [] as any[] };

    const subject = `Manager assignment needed: ${campaignName}`;
    const body = `Client added vector **${label}** to campaign **${campaignName}**, but no account manager is assigned to this client.\n\nPlease assign a manager so this vector can be implemented and its budget managed.`;

    for (const a of adminProfiles || []) {
      await admin.from("messages").insert({
        sender_id: clientUserId,
        recipient_id: a.user_id,
        campaign_id: campaignId,
        subject,
        body,
        read: false,
      });

      if (a.email) {
        try {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "admin-assign-manager-vector",
              recipientEmail: a.email,
              idempotencyKey: `assign-mgr-${campaignId}-${addonType}-${a.user_id}-${Date.now()}`,
              templateData: {
                adminName: a.full_name || "Admin",
                campaignName,
                vectorLabel: label,
                clientUserId,
              },
            },
          });
        } catch (e) { console.warn("admin email skipped", e); }
      }
    }

    return new Response(JSON.stringify({ ok: true, notified: "admins", count: (adminProfiles || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-manager-vector error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
