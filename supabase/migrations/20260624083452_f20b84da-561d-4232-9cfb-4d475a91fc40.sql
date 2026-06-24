
-- Fix 1: account_invites token exposure
-- Revoke column-level SELECT on token from authenticated; invite previews use SECURITY DEFINER function get_invite_preview.
REVOKE SELECT (token) ON public.account_invites FROM authenticated;
REVOKE SELECT (token) ON public.account_invites FROM anon;

-- Fix 2: ai_rate_limits missing INSERT/UPDATE policies
-- The check_and_consume_rate_limit() function is SECURITY DEFINER and bypasses RLS, so restrict client writes to admins only.
CREATE POLICY "Admins insert rate limits"
  ON public.ai_rate_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update rate limits"
  ON public.ai_rate_limits
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Fix 3: profiles.parent_account_id privilege escalation
-- Prevent regular users from updating parent_account_id (which controls the "Parent can view sub accounts" SELECT policy).
REVOKE UPDATE (parent_account_id) ON public.profiles FROM authenticated;
REVOKE UPDATE (parent_account_id) ON public.profiles FROM anon;
-- service_role (used by admin edge functions) retains full access via GRANT ALL.
