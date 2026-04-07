DROP POLICY "Users can create own campaign addons" ON public.campaign_addons;
CREATE POLICY "Users can create own campaign addons" ON public.campaign_addons
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = campaign_addons.campaign_id
    AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id))
  )
);