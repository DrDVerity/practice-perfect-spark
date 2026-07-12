CREATE TABLE public.campaign_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_display TEXT,
  sender_address TEXT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('manager','client','vendor')),
  recipient_address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email','sms')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  subject TEXT,
  body TEXT NOT NULL,
  external_message_id TEXT,
  in_reply_to TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_messages_account_created ON public.campaign_messages(account_id, created_at DESC);
CREATE INDEX idx_campaign_messages_campaign_created ON public.campaign_messages(campaign_id, created_at DESC);

GRANT SELECT, INSERT ON public.campaign_messages TO authenticated;
GRANT ALL ON public.campaign_messages TO service_role;

ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view messages"
  ON public.campaign_messages FOR SELECT
  TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Account members can insert messages"
  ON public.campaign_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_account_member(auth.uid(), account_id)
    AND sender_user_id = auth.uid()
    AND direction = 'outbound'
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_messages;