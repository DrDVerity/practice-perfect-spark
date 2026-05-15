import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALYSSA_EMAIL = "alyssa@synergydental.agency";
const ALYSSA_NAME = "Alyssa";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      campaignId,
      campaignName,
      clientUserId,
      strategyMarkdown,
      budgetTotal,
      pdfUrl,
    } = await req.json();

    if (!campaignId || !clientUserId) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Find existing manager assignment for this client
    let { data: assignment } = await admin
      .from("manager_assignments")
      .select("manager_user_id")
      .eq("client_user_id", clientUserId)
      .maybeSingle();

    let managerUserId: string | null = assignment?.manager_user_id ?? null;
    let isNewAssignment = false;

    // 2. If none, find or create Alyssa
    if (!managerUserId) {
      isNewAssignment = true;

      // Find by email in profiles
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", ALYSSA_EMAIL)
        .maybeSingle();

      if (existingProfile?.user_id) {
        managerUserId = existingProfile.user_id;
      } else {
        // Create auth user for Alyssa
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: ALYSSA_EMAIL,
          email_confirm: true,
          password: crypto.randomUUID(),
          user_metadata: { full_name: ALYSSA_NAME },
        });
        if (createErr) {
          console.error("createUser error", createErr);
          throw createErr;
        }
        managerUserId = created.user.id;

        // Profile (handle_new_user trigger may have created it; upsert name)
        await admin.from("profiles").upsert(
          { user_id: managerUserId, email: ALYSSA_EMAIL, full_name: ALYSSA_NAME },
          { onConflict: "user_id" }
        );
      }

      // Ensure manager role
      await admin.from("user_roles").upsert(
        { user_id: managerUserId, role: "manager" },
        { onConflict: "user_id,role" } as any
      );

      // Insert assignment
      await admin.from("manager_assignments").insert({
        manager_user_id: managerUserId,
        client_user_id: clientUserId,
        assigned_by: clientUserId,
      });
    }

    // 3. Build message body
    const budgetLine = budgetTotal && budgetTotal > 0
      ? `**Budget:** $${Number(budgetTotal).toLocaleString()} — please implement the paid advertising portion.\n\n`
      : "";
    const pdfLine = pdfUrl ? `\n\n**Strategic Plan PDF:** ${pdfUrl}` : "";
    const subject = isNewAssignment
      ? `New campaign assignment: ${campaignName}`
      : `New campaign strategy: ${campaignName}`;
    const intro = isNewAssignment
      ? `You've been assigned as the campaign manager for **${campaignName}**.\n\n`
      : `A new strategy has been approved for **${campaignName}**.\n\n`;
    const body = `${intro}${budgetLine}---\n\n${(strategyMarkdown || "").slice(0, 8000)}${pdfLine}`;

    // 4. Insert message — surfaces in manager dashboard
    await admin.from("messages").insert({
      sender_id: clientUserId,
      recipient_id: managerUserId,
      campaign_id: campaignId,
      subject,
      body,
      read: false,
    });

    // 5. Try to send email — best effort (may fail if email infra not set up)
    try {
      await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "manager-strategy-handoff",
          recipientEmail: ALYSSA_EMAIL,
          idempotencyKey: `strategy-${campaignId}-${Date.now()}`,
          templateData: {
            managerName: ALYSSA_NAME,
            campaignName,
            isNewAssignment,
            budgetTotal: budgetTotal || 0,
            pdfUrl: pdfUrl || "",
          },
        },
      });
    } catch (emailErr) {
      console.warn("email send skipped:", emailErr);
    }

    return new Response(
      JSON.stringify({ ok: true, managerUserId, isNewAssignment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-manager-strategy error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
