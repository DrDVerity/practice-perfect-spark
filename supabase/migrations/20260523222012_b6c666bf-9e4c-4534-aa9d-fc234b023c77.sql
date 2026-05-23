
-- 1) account_members INSERT: require owner/admin only
DROP POLICY IF EXISTS "owners add account members" ON public.account_members;
CREATE POLICY "owners add account members"
ON public.account_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_account_owner(auth.uid(), account_id)
  OR public.is_admin(auth.uid())
);

-- 2) location_members INSERT: require owner/admin only
DROP POLICY IF EXISTS "owners add location members" ON public.location_members;
CREATE POLICY "owners add location members"
ON public.location_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_account_owner(auth.uid(), public.account_id_for_location(location_id))
  OR public.is_admin(auth.uid())
);

-- 3) account_invites: remove invitee email-match SELECT exposure
DROP POLICY IF EXISTS "owners view invites" ON public.account_invites;
CREATE POLICY "owners view invites"
ON public.account_invites
FOR SELECT
TO authenticated
USING (public.is_account_owner(auth.uid(), account_id));

-- Also drop invitee UPDATE policy (acceptance now via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "invitee can accept own invite" ON public.account_invites;

-- 4) Safe invite preview (no token returned)
CREATE OR REPLACE FUNCTION public.get_invite_preview(_token text)
RETURNS TABLE (
  email text,
  account_id uuid,
  account_name text,
  expires_at timestamptz,
  accepted_at timestamptz,
  invited_locations uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, i.account_id, a.name, i.expires_at, i.accepted_at, i.invited_locations
  FROM public.account_invites i
  JOIN public.accounts a ON a.id = i.account_id
  WHERE i.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;

-- 5) Secure invite acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_account_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite public.account_invites%ROWTYPE;
  _user_email text;
  _loc uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _invite FROM public.account_invites WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF _invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already used';
  END IF;
  IF _invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  _user_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  IF _user_email = '' OR _user_email <> lower(_invite.email) THEN
    RAISE EXCEPTION 'Sign in as % to accept this invite', _invite.email;
  END IF;

  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (_invite.account_id, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;

  FOREACH _loc IN ARRAY COALESCE(_invite.invited_locations, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.location_members (location_id, user_id)
    VALUES (_loc, auth.uid())
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE public.account_invites
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = _invite.id;

  RETURN jsonb_build_object('account_id', _invite.account_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_account_invite(text) TO authenticated;

-- 6) ai_rate_limits: explicit admin-only DELETE; writes remain DEFINER-only via check_and_consume_rate_limit
DROP POLICY IF EXISTS "Admins delete rate limits" ON public.ai_rate_limits;
CREATE POLICY "Admins delete rate limits"
ON public.ai_rate_limits
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
