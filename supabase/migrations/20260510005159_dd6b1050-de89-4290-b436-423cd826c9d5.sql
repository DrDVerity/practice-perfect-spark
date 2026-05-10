DROP POLICY IF EXISTS "Users can create own campaign channels" ON public.campaign_channels;

CREATE POLICY "Users can create own campaign channels"
ON public.campaign_channels
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_channels.campaign_id
      AND (
        campaigns.user_id = auth.uid()
        OR public.is_admin(auth.uid())
        OR public.is_manager_of(auth.uid(), campaigns.user_id)
      )
  )
);