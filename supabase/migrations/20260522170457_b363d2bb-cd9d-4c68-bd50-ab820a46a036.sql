DROP POLICY IF EXISTS "insert campaigns into your location" ON public.campaigns;

CREATE POLICY "insert campaigns into authorized location"
ON public.campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  (
    auth.uid() = user_id
    AND public.is_location_member(auth.uid(), location_id)
  )
  OR public.is_admin(auth.uid())
  OR (
    public.is_manager_of(auth.uid(), user_id)
    AND public.is_location_member(user_id, location_id)
  )
);