
-- Add system_prompt to kb_document_type enum
ALTER TYPE public.kb_document_type ADD VALUE IF NOT EXISTS 'system_prompt';

-- Create campaign_addons table
CREATE TABLE public.campaign_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  addon_type text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaign addons"
  ON public.campaign_addons FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = campaign_addons.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id))
  ));

CREATE POLICY "Users can create own campaign addons"
  ON public.campaign_addons FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = campaign_addons.campaign_id
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own campaign addons"
  ON public.campaign_addons FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = campaign_addons.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id))
  ));

CREATE POLICY "Users can delete own campaign addons"
  ON public.campaign_addons FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = campaign_addons.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id))
  ));
