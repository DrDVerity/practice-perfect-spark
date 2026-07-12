# Campaign Collaboration Center

Multi-tenant messaging hub for Managers, Clients, and outside Vendors, tied to campaigns, with email (Resend on `mg.archerdental.marketing`) and SMS (Twilio) support and inbound webhooks.

## 1. Database

New table `public.campaign_messages`:
- `id uuid pk`
- `account_id uuid` (tenant/practice id — the app models practice = account)
- `campaign_id uuid null` references `campaigns`
- `sender_user_id uuid null` (auth user; null for external inbound)
- `sender_display` text, `sender_address` text (email or phone)
- `recipient_type text check in ('manager','client','vendor')`
- `recipient_address text` (email or phone)
- `type text check in ('email','sms')`
- `direction text check in ('inbound','outbound')`
- `subject text null`, `body text`
- `external_message_id text null` (Resend/Twilio id), `in_reply_to text null`
- `metadata jsonb`, `created_at timestamptz default now()`

RLS: SELECT/INSERT allowed to account members via `is_account_member(auth.uid(), account_id)`; service_role full access for webhooks.

Grants: `authenticated` select/insert/update; `service_role` all.

Indexes on `(account_id, created_at)`, `(campaign_id, created_at)`.

## 2. UI

- Add "Messages" item to `AppSidebar` (`MessageSquare` icon, route `/messages`), include in `isAppRoute`.
- New page `src/pages/Messages.tsx` — split pane using shadcn:
  - Left: list of the practice's campaigns (from `useCampaigns`) plus a pinned "General" thread (campaign_id null).
  - Right: chat-style timeline (outbound right-aligned, inbound left), composer with Email/SMS toggle, recipient input, subject (email only), body. Realtime via Supabase channel on `campaign_messages` filtered by account_id.
- Route registered in `App.tsx`.

## 3. Sender identity

Compose "From" as `"<display_name> <username@mg.archerdental.marketing>"` where:
- `display_name` = profile.practice_name or user metadata full_name, fallback email local-part.
- `username` = sanitized local-part of user's login email.
Reply-To set to user's real email so replies still reach them; Message-Id references let us thread inbound.

## 4. Edge functions

- `send-campaign-message` (verify_jwt=true): validates account membership, sends via Resend (email) or Twilio (SMS) through connector gateway, inserts outbound row.
- `inbound-email` (verify_jwt=false): Resend/SendGrid Inbound Parse webhook. Parses `to` address `campaign+<campaignId>.<accountId>@mg.archerdental.marketing` (plus-addressing) to resolve tenant/campaign; falls back to matching by sender email → known member. Inserts inbound row. Also forwards identical content to the account owner's personal email via Resend.
- `inbound-sms` (verify_jwt=false): Twilio webhook (form-urlencoded). Looks up account via `From` phone matching a profile/member phone; inserts inbound row; forwards to owner's personal email.

Secrets: `RESEND_API_KEY` (already), Twilio via connector (`TWILIO_API_KEY`, gateway).

## 5. External forwarding

On inbound insert, edge function immediately calls Resend to send an identical copy to the account owner's `profiles.email` (or a new `notification_email` if set later), subject prefixed with `[Archer Inbound]`.

## Files

New: migration; `src/pages/Messages.tsx`; `src/hooks/useCampaignMessages.ts`; `supabase/functions/{send-campaign-message,inbound-email,inbound-sms}/index.ts`; sidebar + route edits; `supabase/config.toml` entries for the 3 functions.

Webhook URLs to configure in Resend/Twilio dashboards will be printed after deploy.

Ready to build.