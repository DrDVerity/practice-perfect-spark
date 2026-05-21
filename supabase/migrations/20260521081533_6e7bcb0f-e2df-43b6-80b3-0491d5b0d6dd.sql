CREATE POLICY "admins create invites" ON public.account_invites
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "admins view invites" ON public.account_invites
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "admins delete invites" ON public.account_invites
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));