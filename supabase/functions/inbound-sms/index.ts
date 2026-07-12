import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_DOMAIN = 'mg.archerdental.marketing';

/** Twilio SMS inbound webhook: application/x-www-form-urlencoded with From, To, Body. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const form = await req.formData();
    const from = String(form.get('From') || '').trim();
    const to = String(form.get('To') || '').trim();
    const body = String(form.get('Body') || '');
    if (!from || !body) return xml('<Response/>', 400);

    // Match sender by phone across profiles (add a `phone` column later; fall back to metadata)
    const { data: profile } = await admin
      .from('profiles').select('user_id, practice_name, email').ilike('phone' as any, from).maybeSingle();

    let accountId: string | null = null;
    let recipient_type: 'manager' | 'client' | 'vendor' = 'vendor';
    if (profile?.user_id) {
      const { data: mem } = await admin
        .from('account_members').select('account_id, role').eq('user_id', profile.user_id).limit(1).maybeSingle();
      if (mem) { accountId = mem.account_id; recipient_type = mem.role === 'owner' ? 'client' : 'manager'; }
    }
    if (!accountId) return xml('<Response/>'); // silently drop unknown senders

    await admin.from('campaign_messages').insert({
      account_id: accountId,
      campaign_id: null,
      sender_user_id: profile?.user_id ?? null,
      sender_display: profile?.practice_name || from,
      sender_address: from,
      recipient_type,
      recipient_address: to,
      type: 'sms',
      direction: 'inbound',
      body,
      metadata: { channel: 'twilio' },
    });

    // Forward identical content to owner's personal email
    if (RESEND_API_KEY) {
      const { data: acc } = await admin.from('accounts').select('owner_user_id').eq('id', accountId).maybeSingle();
      if (acc?.owner_user_id) {
        const { data: owner } = await admin.from('profiles').select('email').eq('user_id', acc.owner_user_id).maybeSingle();
        if (owner?.email) {
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: `Archer Inbound <inbound@${FROM_DOMAIN}>`,
              to: [owner.email],
              subject: `[Archer SMS] From ${from}`,
              text: body,
            }),
          }).catch(() => {});
        }
      }
    }

    return xml('<Response/>');
  } catch {
    return xml('<Response/>', 500);
  }
});

function xml(s: string, status = 200) {
  return new Response(s, { status, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } });
}
