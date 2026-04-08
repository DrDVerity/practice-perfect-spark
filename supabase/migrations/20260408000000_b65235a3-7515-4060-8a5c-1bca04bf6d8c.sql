
-- Campaign budgets table
CREATE TABLE public.campaign_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL DEFAULT 0,
  allocations jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id)
);

ALTER TABLE public.campaign_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaign budgets" ON public.campaign_budgets
FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id)))
);

CREATE POLICY "Users can create own campaign budgets" ON public.campaign_budgets
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id)))
);

CREATE POLICY "Users can update own campaign budgets" ON public.campaign_budgets
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id)))
);

CREATE POLICY "Users can delete own campaign budgets" ON public.campaign_budgets
FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id)))
);

CREATE TRIGGER update_campaign_budgets_updated_at
BEFORE UPDATE ON public.campaign_budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
  OR is_admin(auth.uid())
  OR is_manager_of(auth.uid(), recipient_id)
  OR is_manager_of(auth.uid(), sender_id)
);

CREATE POLICY "Users can send messages" ON public.messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update messages" ON public.messages
FOR UPDATE USING (auth.uid() = recipient_id OR is_admin(auth.uid()));

CREATE POLICY "Users can delete own messages" ON public.messages
FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR is_admin(auth.uid()));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
