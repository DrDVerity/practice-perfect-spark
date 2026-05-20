CREATE OR REPLACE FUNCTION public.bundle_social_team_for_user(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owner_team AS (
    SELECT p.bundle_social_team_id
    FROM public.account_members am
    JOIN public.accounts a ON a.id = am.account_id
    JOIN public.profiles p ON p.user_id = a.owner_user_id
    WHERE am.user_id = _user_id
      AND p.bundle_social_team_id IS NOT NULL
    ORDER BY am.created_at ASC
    LIMIT 1
  ),
  self_team AS (
    SELECT bundle_social_team_id
    FROM public.profiles
    WHERE user_id = _user_id
      AND bundle_social_team_id IS NOT NULL
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT bundle_social_team_id FROM owner_team),
    (SELECT bundle_social_team_id FROM self_team)
  );
$$;

GRANT EXECUTE ON FUNCTION public.bundle_social_team_for_user(uuid) TO authenticated, anon, service_role;