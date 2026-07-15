import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Missing auth' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(url, service);

    // Verify admin or manager
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin');
    const isManager = (roles ?? []).some((r: any) => r.role === 'manager');
    if (!isAdmin && !isManager) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const { docId, targetUserId, scope, locationId } = body as {
      docId?: string; targetUserId?: string; scope?: 'group' | 'location'; locationId?: string | null;
    };
    if (!docId || !targetUserId || !scope) return json({ error: 'Missing docId/targetUserId/scope' }, 400);
    if (scope !== 'group' && scope !== 'location') return json({ error: 'Invalid scope' }, 400);

    // Manager scope: must be assigned to target client
    if (!isAdmin) {
      const { data: ma } = await admin.from('manager_assignments')
        .select('id').eq('manager_user_id', user.id).eq('client_user_id', targetUserId).maybeSingle();
      if (!ma) return json({ error: 'Not assigned to target client' }, 403);
    }

    // Resolve target account from profile
    const { data: prof, error: profErr } = await admin.from('profiles')
      .select('account_id').eq('user_id', targetUserId).maybeSingle();
    if (profErr || !prof?.account_id) return json({ error: 'Target account not found' }, 400);
    const accountId = prof.account_id as string;

    let finalLocationId: string | null = null;
    if (scope === 'location') {
      if (locationId) {
        // Verify location belongs to account
        const { data: loc } = await admin.from('locations').select('id, account_id').eq('id', locationId).maybeSingle();
        if (!loc || loc.account_id !== accountId) return json({ error: 'Location does not belong to target account' }, 400);
        finalLocationId = locationId;
      } else {
        const { data: defLoc } = await admin.from('locations')
          .select('id').eq('account_id', accountId).order('is_default', { ascending: false }).limit(1).maybeSingle();
        if (!defLoc) return json({ error: 'No location found for target account' }, 400);
        finalLocationId = defLoc.id as string;
      }
    }

    const { error: updErr } = await admin.from('knowledge_base').update({
      account_id: accountId,
      location_id: finalLocationId,
      scope,
      user_id: targetUserId,
    }).eq('id', docId);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, accountId, locationId: finalLocationId, scope });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Unknown error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
