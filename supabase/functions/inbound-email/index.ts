import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_DOMAIN = 'mg.archerdental.marketing';

/**
 * Inbound email webhook (Resend/SendGrid Inbound Parse compatible).
 * Expects JSON or multipart with `from`, `to`, `subject`, `text`.
 * `to` should use plus-addressing: campaign+<campaignId|general>.<accountId>@mg.archerdental.marketing
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const contentType = req.headers.get('content-type') || '';
    let payload: any = {};
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
    }

    const from: string = payload.from || payload.From || payload.sender || '';
    const toRaw: string = payload.to || payload.To || payload.recipient || '';
    const subject: string = payload.subject || payload.Subject || '';
    const body: string = payload.text || payload['stripped-text'] || payload.html || payload.body || '';

    const fromAddress = extractAddress(from);
    const toAddress = extractAddress(toRaw);

    const { accountId, campaignId } = parseRouting(toAddress);
    if (!accountId) return json({ error: 'Unable to resolve tenant from recipient address' }, 400);

    // Recipient type heuristic
    const { data: senderProfile } = await admin
      .from('profiles').select('user_id, email, practice_name').eq('email', fromAddress).maybeSingle();
    let recipient_type: 'manager' | 'client' | 'vendor' = 'vendor';
    if (senderProfile) {
      const { data: mem } = await admin
        .from('account_members').select('role').eq('user_id', senderProfile.user_id).eq('account_id', accountId).maybeSingle();
      if (mem) recipient_type = mem.role === 'owner' ? 'client' : 'manager';
    }

    const { data: inserted, error } = await admin.from('campaign_messages').insert({
      account_id: accountId,
      campaign_id: campaignId,
      sender_user_id: senderProfile?.user_id ?? null,
      sender_display: senderProfile?.practice_name || from,
      sender_address: fromAddress,
      recipient_type,
      recipient_address: toAddress,
      type: 'email',
      direction: 'inbound',
      subject,
      body,
      metadata: { raw_from: from, raw_to: toRaw },
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    // Forward identical content to account owner's personal email
    await forwardToOwner(admin, accountId, { from, subject, body });

    return json({ ok: true, id: inserted.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function extractAddress(s: string): string {
  if (!s) return '';
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function parseRouting(to: string): { accountId: string | null; campaignId: string | null } {
  // campaign+<campaignId|general>.<accountId>@mg.archerdental.marketing
  if (!to.endsWith(`@${FROM_DOMAIN}`)) return { accountId: null, campaignId: null };
  const local = to.split('@')[0];
  const plus = local.split('+')[1];
  if (!plus) return { accountId: null, campaignId: null };
  const [campRaw, acct] = plus.split('.');
  return {
    accountId: acct || null,
    campaignId: campRaw && campRaw !== 'general' ? campRaw : null,
  };
}

async function forwardToOwner(admin: any, accountId: string, msg: { from: string; subject: string; body: string }) {
  if (!RESEND_API_KEY) return;
  const { data: acc } = await admin.from('accounts').select('owner_user_id, name').eq('id', accountId).maybeSingle();
  if (!acc?.owner_user_id) return;
  const { data: ownerProfile } = await admin
    .from('profiles').select('email').eq('user_id', acc.owner_user_id).maybeSingle();
  const dest = ownerProfile?.email;
  if (!dest) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: `Archer Inbound <inbound@${FROM_DOMAIN}>`,
      to: [dest],
      subject: `[Archer Inbound] ${msg.subject || '(no subject)'}`,
      text: `From: ${msg.from}\n\n${msg.body}`,
    }),
  }).catch(() => {});
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
