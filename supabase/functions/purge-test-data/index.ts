// Purges all rows tagged as test data (is_test = true) and any campaigns
// whose name starts with "[TEST]". Admin only.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
  const { data: userData } = await authed.auth.getUser();
  if (!userData?.user) {
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

  const { count: mCount } = await admin
    .from('campaign_daily_metrics')
    .delete({ count: 'exact' })
    .eq('is_test', true);
  const { count: fCount } = await admin
    .from('campaign_financials')
    .delete({ count: 'exact' })
    .eq('is_test', true);
  const { count: cCount } = await admin
    .from('campaigns')
    .delete({ count: 'exact' })
    .ilike('name', '[TEST]%');

  return new Response(
    JSON.stringify({
      success: true,
      deleted: { metrics: mCount, financials: fCount, campaigns: cCount },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
