DROP POLICY IF EXISTS "owners/managers decide approvals" ON public.approval_requests;
CREATE POLICY "owners/managers decide approvals" ON public.approval_requests
FOR UPDATE
USING (
  is_admin(auth.uid())
  OR (account_id IS NOT NULL AND is_account_owner(auth.uid(), account_id))
  OR (account_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = approval_requests.account_id
      AND is_manager_of(auth.uid(), a.owner_user_id)
  ))
);