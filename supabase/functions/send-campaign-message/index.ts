import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER'); // E.164

const FROM_DOMAIN = 'mg.archerdental.marketing';

const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'user';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Missing auth' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userRes } = await admin.auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return json({ error: 'Invalid user' }, 401);

    const payload = await req.json();
    const { account_id, campaign_id, type, recipient_type, recipient_address, subject, body } = payload ?? {};
    if (!account_id || !type || !recipient_type || !recipient_address || !body)
      return json({ error: 'Missing fields' }, 400);
    if (!['email', 'sms'].includes(type)) return json({ error: 'Bad type' }, 400);

    // Verify membership
    const { data: member } = await admin
      .from('account_members').select('user_id').eq('account_id', account_id).eq('user_id', user.id).maybeSingle();
    if (!member) return json({ error: 'Not a member of this account' }, 403);

    // Fetch profile for display + personal email
    const { data: profile } = await admin
      .from('profiles').select('practice_name, email').eq('user_id', user.id).maybeSingle();

    const displayName = (profile?.practice_name || (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || 'Team').toString();
    const localPart = sanitize((user.email || 'user').split('@')[0]);
    const senderAddress = type === 'email' ? `${localPart}@${FROM_DOMAIN}` : (TWILIO_FROM ?? 'app');
    const fromHeader = `${displayName} <${senderAddress}>`;
    const personalReply = profile?.email || user.email || undefined;

    let external_message_id: string | null = null;

    if (type === 'email') {
      if (!SENDGRID_API_KEY) return json({ error: 'Email not configured (SENDGRID_API_KEY missing)' }, 500);
      // Plus-addressed reply-to so inbound replies map back to tenant/campaign
      const routingLocal = `campaign+${campaign_id ?? 'general'}.${account_id}`;
      const routedReplyTo = `${routingLocal}@${FROM_DOMAIN}`;

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: recipient_address }],
            subject: subject || `Message from ${displayName}`,
          }],
          from: { email: senderAddress, name: displayName },
          reply_to: { email: routedReplyTo, name: personalReply || displayName },
          content: [{ type: 'text/plain', value: body }],
          custom_args: {
            account_id,
            campaign_id: campaign_id ?? '',
          },
          headers: {
            'X-Archer-Account': account_id,
            'X-Archer-Campaign': campaign_id ?? '',
            ...(personalReply ? { 'X-Archer-Personal-Reply': personalReply } : {}),
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return json({ error: `SendGrid ${res.status}: ${txt}` }, res.status);
      }
      external_message_id = res.headers.get('x-message-id');
    } else {
      if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_FROM)
        return json({ error: 'SMS not configured (Twilio connector or from-number missing)' }, 500);
      const form = new URLSearchParams({ To: recipient_address, From: TWILIO_FROM, Body: body });
      const res = await fetch('https://connector-gateway.lovable.dev/twilio/Messages.json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });
      const txt = await res.text();
      if (!res.ok) return json({ error: `Twilio ${res.status}: ${txt}` }, res.status);
      try { external_message_id = JSON.parse(txt)?.sid ?? null; } catch { /* ignore */ }
    }

    const { data: inserted, error: insErr } = await admin
      .from('campaign_messages')
      .insert({
        account_id,
        campaign_id: campaign_id ?? null,
        sender_user_id: user.id,
        sender_display: displayName,
        sender_address: senderAddress,
        recipient_type,
        recipient_address,
        type,
        direction: 'outbound',
        subject: subject ?? null,
        body,
        external_message_id,
        metadata: { from: fromHeader, reply_to: personalReply },
      })
      .select().single();
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, message: inserted });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
