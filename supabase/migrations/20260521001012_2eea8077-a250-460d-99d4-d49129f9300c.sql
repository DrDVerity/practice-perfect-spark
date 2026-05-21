DROP POLICY IF EXISTS "insert KB by scope" ON public.knowledge_base;

CREATE POLICY "insert KB by scope"
ON public.knowledge_base
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- Clients can create their own KB documents in their own account/location.
    (
      auth.uid() = user_id
      AND (
        (scope = 'group'::kb_scope AND is_account_owner(auth.uid(), account_id))
        OR
        (scope = 'location'::kb_scope AND location_id IS NOT NULL AND is_location_member(auth.uid(), location_id))
      )
    )
    OR
    -- Admins can create KB documents for any client account/location.
    is_admin(auth.uid())
    OR
    -- Assigned managers can create KB documents for the clients they manage.
    is_manager_of(auth.uid(), user_id)
  )
  AND (
    (scope = 'group'::kb_scope AND location_id IS NULL)
    OR
    (scope = 'location'::kb_scope AND location_id IS NOT NULL AND account_id_for_location(location_id) = account_id)
  )
);