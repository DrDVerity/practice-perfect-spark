CREATE POLICY "Admins can delete prospects" ON public.prospect_accounts
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update prospects" ON public.prospect_accounts
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));