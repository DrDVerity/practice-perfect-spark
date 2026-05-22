
CREATE TABLE public.campaign_agent_instructions (
  campaign_id uuid PRIMARY KEY,
  chat_instructions text NOT NULL DEFAULT '',
  dev_instructions text NOT NULL DEFAULT '',
  generate_instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_agent_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view agent instructions"
ON public.campaign_agent_instructions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_agent_instructions.campaign_id
    AND (is_admin(auth.uid()) OR is_location_member(auth.uid(), c.location_id) OR is_manager_of(auth.uid(), c.user_id))
));

CREATE POLICY "insert agent instructions"
ON public.campaign_agent_instructions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_agent_instructions.campaign_id
    AND (is_admin(auth.uid()) OR is_location_member(auth.uid(), c.location_id) OR is_manager_of(auth.uid(), c.user_id))
));

CREATE POLICY "update agent instructions"
ON public.campaign_agent_instructions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_agent_instructions.campaign_id
    AND (is_admin(auth.uid()) OR is_location_member(auth.uid(), c.location_id) OR is_manager_of(auth.uid(), c.user_id))
));

CREATE POLICY "delete agent instructions"
ON public.campaign_agent_instructions FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_agent_instructions.campaign_id
    AND (is_admin(auth.uid()) OR is_location_member(auth.uid(), c.location_id) OR is_manager_of(auth.uid(), c.user_id))
));
