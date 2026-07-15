// Seeds one year of test data for a practice named "Ohana Dental Implants".
// Marks all rows with is_test = true so the admin purge button can clean them up.
// Admin-only edge function.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Monthly ad spend schedule requested by the user.
const MONTHLY_SPEND = [2000, 2000, 2000, 5000, 5000, 5000, 7000, 5000, 5000, 5000, 5000, 5000];
const PLATFORMS = ['facebook', 'instagram', 'twitter', 'tiktok'];

// Basic seedable RNG so runs are stable and easy to reason about.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function findOhanaUser(admin: any) {
  const { data } = await admin
    .from('profiles')
    .select('user_id, practice_name')
    .ilike('practice_name', '%ohana%')
    .limit(1)
    .maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const authed = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await authed.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: isAdminRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (!isAdminRow) {
    return new Response(JSON.stringify({ error: 'Admin only' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const owner = await findOhanaUser(admin);
  if (!owner) {
    return new Response(JSON.stringify({ error: 'No Ohana Dental Implants profile found. Create the account first.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: loc } = await admin
    .from('locations')
    .select('id, account_id')
    .eq('id', (await admin.from('profiles').select('account_id').eq('user_id', owner.user_id).maybeSingle()).data?.account_id || '')
    .maybeSingle();

  // Simpler: pull any location owned by this user's account.
  const { data: prof } = await admin
    .from('profiles')
    .select('account_id')
    .eq('user_id', owner.user_id)
    .maybeSingle();
  const { data: loc2 } = await admin
    .from('locations')
    .select('id')
    .eq('account_id', prof?.account_id || '')
    .limit(1)
    .maybeSingle();
  const locationId = loc2?.id;
  if (!locationId) {
    return new Response(JSON.stringify({ error: 'Ohana account has no location.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  // Create 4 test campaigns (one per platform theme) tagged as test via name.
  const campaignsInsert = [
    { name: '[TEST] Implant Awareness — Facebook Lead', focus: 'All-on-X awareness' },
    { name: '[TEST] Smile Makeover Reels — Instagram', focus: 'Smile makeover reels' },
    { name: '[TEST] Community Voice — X/Twitter', focus: 'Community engagement' },
    { name: '[TEST] Patient Stories — TikTok', focus: 'Patient story shorts' },
  ].map((c) => ({
    ...c,
    status: 'active',
    user_id: owner.user_id,
    location_id: locationId,
    start_date: startMonth.toISOString().slice(0, 10),
    duration_value: 12,
    duration_unit: 'months',
  }));

  const { data: insertedCampaigns, error: campErr } = await admin
    .from('campaigns')
    .insert(campaignsInsert)
    .select('id, name');
  if (campErr) {
    return new Response(JSON.stringify({ error: campErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rand = rng(42);
  const metricRows: any[] = [];
  const finRows: any[] = [];

  // Distribute monthly spend evenly across the 4 campaigns.
  for (let mi = 0; mi < 12; mi++) {
    const monthDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + mi, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const totalSpend = MONTHLY_SPEND[mi];

    for (let ci = 0; ci < insertedCampaigns!.length; ci++) {
      const campaign = insertedCampaigns![ci];
      const campaignShare = totalSpend / insertedCampaigns!.length;
      const platform = PLATFORMS[ci];

      let campaignImpr = 0, campaignClicks = 0, campaignLeads = 0, campaignAppts = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), d).toISOString().slice(0, 10);
        const spend = Math.round((campaignShare / daysInMonth) * (0.7 + rand() * 0.6));
        // Rough funnel: CPM $8-15 → CTR 1-3% → CVR 4-8% → booking 25%.
        const impressions = Math.round((spend / (8 + rand() * 7)) * 1000);
        const clicks = Math.round(impressions * (0.01 + rand() * 0.02));
        const views = Math.round(impressions * (0.3 + rand() * 0.4));
        const leads = Math.round(clicks * (0.04 + rand() * 0.04));
        const appointments = Math.round(leads * (0.15 + rand() * 0.2));

        campaignImpr += impressions;
        campaignClicks += clicks;
        campaignLeads += leads;
        campaignAppts += appointments;

        metricRows.push({
          campaign_id: campaign.id,
          platform,
          date,
          impressions,
          views,
          clicks,
          leads,
          appointments,
          spend,
          is_test: true,
        });
      }

      // ~10% of appointments assumed All-on-X; blended avg patient value.
      const allonxAppts = Math.round(campaignAppts * 0.1);
      const generalAppts = campaignAppts - allonxAppts;
      const revenue = generalAppts * 2500 + allonxAppts * 25000;
      const blendedAvg = campaignAppts > 0 ? Math.round(revenue / campaignAppts) : 2500;

      finRows.push({
        campaign_id: campaign.id,
        month: monthDate.toISOString().slice(0, 10),
        spend: Math.round(campaignShare),
        new_patients: campaignAppts,
        avg_patient_value: blendedAvg,
        revenue,
        is_test: true,
      });
    }
  }

  // Chunk inserts to avoid payload limits.
  for (let i = 0; i < metricRows.length; i += 500) {
    const chunk = metricRows.slice(i, i + 500);
    const { error } = await admin.from('campaign_daily_metrics').insert(chunk);
    if (error) {
      return new Response(JSON.stringify({ error: `metrics insert failed: ${error.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  const { error: finErr } = await admin.from('campaign_financials').insert(finRows);
  if (finErr) {
    return new Response(JSON.stringify({ error: `financials insert failed: ${finErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      campaigns: insertedCampaigns!.length,
      metric_rows: metricRows.length,
      financial_rows: finRows.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
