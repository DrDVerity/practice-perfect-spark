-- =====================================================================
-- WORKSPACES FOUNDATION: accounts → locations → members
-- =====================================================================

-- 1. ENUM for account-level role
DO $$ BEGIN
  CREATE TYPE public.account_role AS ENUM ('owner', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.kb_scope AS ENUM ('group', 'location');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. CORE TABLES
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  timezone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locations_account ON public.locations(account_id);

CREATE TABLE IF NOT EXISTS public.account_members (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.account_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_members_user ON public.account_members(user_id);

CREATE TABLE IF NOT EXISTS public.location_members (
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_location_members_user ON public.location_members(user_id);

CREATE TABLE IF NOT EXISTS public.account_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_locations uuid[] NOT NULL DEFAULT '{}',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_invites_account ON public.account_invites(account_id);
CREATE INDEX IF NOT EXISTS idx_account_invites_email ON public.account_invites(lower(email));

-- 3. SECURITY DEFINER HELPERS (no recursive RLS)
CREATE OR REPLACE FUNCTION public.is_account_member(_user_id uuid, _account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND account_id = _account_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_account_owner(_user_id uuid, _account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND account_id = _account_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_location_member(_user_id uuid, _location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.location_members
    WHERE user_id = _user_id AND location_id = _location_id
  )
  OR EXISTS (
    -- Account owners implicitly have access to all locations in their account
    SELECT 1 FROM public.locations l
    JOIN public.account_members am
      ON am.account_id = l.account_id
    WHERE l.id = _location_id
      AND am.user_id = _user_id
      AND am.role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.account_id_for_location(_location_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT account_id FROM public.locations WHERE id = _location_id
$$;

-- 4. ADD account_id / location_id to existing tables (nullable for now, backfill, then NOT NULL)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_id uuid;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.campaign_vault
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.channel_credentials
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS location_id uuid,
  ADD COLUMN IF NOT EXISTS scope public.kb_scope NOT NULL DEFAULT 'location';

-- 5. BACKFILL: one account + one default location per existing profile
DO $$
DECLARE
  prof RECORD;
  new_account_id uuid;
  new_location_id uuid;
BEGIN
  FOR prof IN
    SELECT DISTINCT ON (user_id) user_id, COALESCE(practice_name, email, 'My Practice') AS pname
    FROM public.profiles
    WHERE deleted_at IS NULL
  LOOP
    -- Create account if user doesn't already own one
    SELECT id INTO new_account_id
    FROM public.accounts
    WHERE owner_user_id = prof.user_id
    LIMIT 1;

    IF new_account_id IS NULL THEN
      INSERT INTO public.accounts (name, owner_user_id)
      VALUES (prof.pname, prof.user_id)
      RETURNING id INTO new_account_id;

      INSERT INTO public.account_members (account_id, user_id, role)
      VALUES (new_account_id, prof.user_id, 'owner')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.locations (account_id, name, is_default)
      VALUES (new_account_id, prof.pname || ' (Main)', true)
      RETURNING id INTO new_location_id;

      INSERT INTO public.location_members (location_id, user_id)
      VALUES (new_location_id, prof.user_id)
      ON CONFLICT DO NOTHING;
    ELSE
      SELECT id INTO new_location_id
      FROM public.locations WHERE account_id = new_account_id AND is_default = true LIMIT 1;
    END IF;

    UPDATE public.profiles SET account_id = new_account_id WHERE user_id = prof.user_id;

    -- Stamp existing rows owned by this user
    UPDATE public.campaigns SET location_id = new_location_id
      WHERE user_id = prof.user_id AND location_id IS NULL;
    UPDATE public.campaign_vault SET location_id = new_location_id
      WHERE user_id = prof.user_id AND location_id IS NULL;
    UPDATE public.channel_credentials SET location_id = new_location_id
      WHERE user_id = prof.user_id AND location_id IS NULL;
    UPDATE public.knowledge_base
      SET account_id = new_account_id, location_id = new_location_id, scope = 'location'
      WHERE user_id = prof.user_id AND location_id IS NULL;
  END LOOP;
END $$;

-- 6. NOT NULL constraints after backfill
ALTER TABLE public.campaigns ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.campaign_vault ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.channel_credentials ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.knowledge_base ALTER COLUMN account_id SET NOT NULL;

-- 7. Indexes on new FK-style columns
CREATE INDEX IF NOT EXISTS idx_campaigns_location ON public.campaigns(location_id);
CREATE INDEX IF NOT EXISTS idx_campaign_vault_location ON public.campaign_vault(location_id);
CREATE INDEX IF NOT EXISTS idx_channel_credentials_location ON public.channel_credentials(location_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_account ON public.knowledge_base(account_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_location ON public.knowledge_base(location_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account ON public.profiles(account_id);

-- 8. ENABLE RLS on new tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;

-- 9. POLICIES — accounts
CREATE POLICY "members view their account"
  ON public.accounts FOR SELECT
  USING (is_admin(auth.uid()) OR is_account_member(auth.uid(), id));

CREATE POLICY "owner updates account"
  ON public.accounts FOR UPDATE
  USING (is_admin(auth.uid()) OR is_account_owner(auth.uid(), id));

CREATE POLICY "users can create their account"
  ON public.accounts FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- 10. POLICIES — locations
CREATE POLICY "members view locations in their account"
  ON public.locations FOR SELECT
  USING (is_admin(auth.uid()) OR is_account_member(auth.uid(), account_id));

CREATE POLICY "owners manage locations"
  ON public.locations FOR INSERT
  WITH CHECK (is_account_owner(auth.uid(), account_id));

CREATE POLICY "owners update locations"
  ON public.locations FOR UPDATE
  USING (is_account_owner(auth.uid(), account_id));

CREATE POLICY "owners delete locations"
  ON public.locations FOR DELETE
  USING (is_account_owner(auth.uid(), account_id));

-- 11. POLICIES — account_members
CREATE POLICY "view account memberships you belong to"
  ON public.account_members FOR SELECT
  USING (is_admin(auth.uid()) OR user_id = auth.uid() OR is_account_member(auth.uid(), account_id));

CREATE POLICY "owners add account members"
  ON public.account_members FOR INSERT
  WITH CHECK (is_account_owner(auth.uid(), account_id) OR user_id = auth.uid());

CREATE POLICY "owners update account members"
  ON public.account_members FOR UPDATE
  USING (is_account_owner(auth.uid(), account_id));

CREATE POLICY "owners remove account members"
  ON public.account_members FOR DELETE
  USING (is_account_owner(auth.uid(), account_id));

-- 12. POLICIES — location_members
CREATE POLICY "view location memberships you belong to"
  ON public.location_members FOR SELECT
  USING (
    is_admin(auth.uid())
    OR user_id = auth.uid()
    OR is_account_owner(auth.uid(), account_id_for_location(location_id))
  );

CREATE POLICY "owners add location members"
  ON public.location_members FOR INSERT
  WITH CHECK (
    is_account_owner(auth.uid(), account_id_for_location(location_id))
    OR user_id = auth.uid()
  );

CREATE POLICY "owners remove location members"
  ON public.location_members FOR DELETE
  USING (is_account_owner(auth.uid(), account_id_for_location(location_id)));

-- 13. POLICIES — account_invites
CREATE POLICY "owners view invites"
  ON public.account_invites FOR SELECT
  USING (is_account_owner(auth.uid(), account_id) OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE POLICY "owners create invites"
  ON public.account_invites FOR INSERT
  WITH CHECK (is_account_owner(auth.uid(), account_id) AND invited_by = auth.uid());

CREATE POLICY "owners delete invites"
  ON public.account_invites FOR DELETE
  USING (is_account_owner(auth.uid(), account_id));

CREATE POLICY "invitee can accept own invite"
  ON public.account_invites FOR UPDATE
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- 14. REWRITE RLS ON SCOPED TABLES (use location_id)
-- campaigns
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can create own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;

CREATE POLICY "view campaigns by location membership"
  ON public.campaigns FOR SELECT
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));
CREATE POLICY "insert campaigns into your location"
  ON public.campaigns FOR INSERT
  WITH CHECK (is_location_member(auth.uid(), location_id) AND auth.uid() = user_id);
CREATE POLICY "update campaigns in your location"
  ON public.campaigns FOR UPDATE
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));
CREATE POLICY "delete campaigns in your location"
  ON public.campaigns FOR DELETE
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));

-- campaign_vault
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaign_vault;
DROP POLICY IF EXISTS "Users can create own campaigns" ON public.campaign_vault;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaign_vault;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaign_vault;

CREATE POLICY "view vault by location"
  ON public.campaign_vault FOR SELECT
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));
CREATE POLICY "insert vault into your location"
  ON public.campaign_vault FOR INSERT
  WITH CHECK (is_location_member(auth.uid(), location_id) AND auth.uid() = user_id);
CREATE POLICY "update vault in your location"
  ON public.campaign_vault FOR UPDATE
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));
CREATE POLICY "delete vault in your location"
  ON public.campaign_vault FOR DELETE
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));

-- channel_credentials
DROP POLICY IF EXISTS "Users can view own credentials" ON public.channel_credentials;
DROP POLICY IF EXISTS "Users can create own credentials" ON public.channel_credentials;
DROP POLICY IF EXISTS "Users can update own credentials" ON public.channel_credentials;
DROP POLICY IF EXISTS "Users can delete own credentials" ON public.channel_credentials;
DROP POLICY IF EXISTS "Admins and managers can view credentials" ON public.channel_credentials;
DROP POLICY IF EXISTS "Admins and managers can update credentials" ON public.channel_credentials;
DROP POLICY IF EXISTS "Admins and managers can delete credentials" ON public.channel_credentials;

CREATE POLICY "view credentials by location"
  ON public.channel_credentials FOR SELECT
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));
CREATE POLICY "insert credentials into your location"
  ON public.channel_credentials FOR INSERT
  WITH CHECK (is_location_member(auth.uid(), location_id) AND auth.uid() = user_id);
CREATE POLICY "update credentials in your location"
  ON public.channel_credentials FOR UPDATE
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));
CREATE POLICY "delete credentials in your location"
  ON public.channel_credentials FOR DELETE
  USING (is_admin(auth.uid()) OR is_location_member(auth.uid(), location_id) OR is_manager_of(auth.uid(), user_id));

-- knowledge_base: group scope = visible to any account member; location scope = location members only
DROP POLICY IF EXISTS "Users can view own KB docs" ON public.knowledge_base;
DROP POLICY IF EXISTS "Users can create own KB docs" ON public.knowledge_base;
DROP POLICY IF EXISTS "Admins and managers can create KB docs" ON public.knowledge_base;
DROP POLICY IF EXISTS "Users can update own KB docs" ON public.knowledge_base;
DROP POLICY IF EXISTS "Users can delete own KB docs" ON public.knowledge_base;

CREATE POLICY "view KB by scope"
  ON public.knowledge_base FOR SELECT
  USING (
    is_admin(auth.uid())
    OR (scope = 'group' AND is_account_member(auth.uid(), account_id))
    OR (scope = 'location' AND location_id IS NOT NULL AND is_location_member(auth.uid(), location_id))
    OR is_manager_of(auth.uid(), user_id)
  );

CREATE POLICY "insert KB by scope"
  ON public.knowledge_base FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      (scope = 'group' AND is_account_owner(auth.uid(), account_id))
      OR (scope = 'location' AND location_id IS NOT NULL AND is_location_member(auth.uid(), location_id))
    )
  );

CREATE POLICY "update KB by scope"
  ON public.knowledge_base FOR UPDATE
  USING (
    is_admin(auth.uid())
    OR (scope = 'group' AND is_account_owner(auth.uid(), account_id))
    OR (scope = 'location' AND location_id IS NOT NULL AND is_location_member(auth.uid(), location_id))
    OR is_manager_of(auth.uid(), user_id)
  );

CREATE POLICY "delete KB by scope"
  ON public.knowledge_base FOR DELETE
  USING (
    is_admin(auth.uid())
    OR (scope = 'group' AND is_account_owner(auth.uid(), account_id))
    OR (scope = 'location' AND location_id IS NOT NULL AND is_location_member(auth.uid(), location_id))
    OR is_manager_of(auth.uid(), user_id)
  );

-- 15. Trigger to auto-create account + default location + memberships for NEW signups
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_location_id uuid;
  v_name text;
BEGIN
  -- Only run if profile doesn't already have an account
  IF NEW.account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(NEW.practice_name, NEW.email, 'My Practice');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (v_name, NEW.user_id)
  RETURNING id INTO v_account_id;

  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (v_account_id, NEW.user_id, 'owner');

  INSERT INTO public.locations (account_id, name, is_default)
  VALUES (v_account_id, v_name || ' (Main)', true)
  RETURNING id INTO v_location_id;

  INSERT INTO public.location_members (location_id, user_id)
  VALUES (v_location_id, NEW.user_id);

  NEW.account_id := v_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_insert_workspace ON public.profiles;
CREATE TRIGGER on_profile_insert_workspace
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_workspace();

-- updated_at triggers for the new tables
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();