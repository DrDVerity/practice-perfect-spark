
-- 1. Create manager_assignments table
CREATE TABLE public.manager_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  client_user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_user_id, client_user_id)
);

ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with assignments"
ON public.manager_assignments FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Managers can view own assignments"
ON public.manager_assignments FOR SELECT
USING (auth.uid() = manager_user_id);

-- 2. Create is_manager_of function
CREATE OR REPLACE FUNCTION public.is_manager_of(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_assignments
    WHERE manager_user_id = _user_id AND client_user_id = _client_id
  )
$$;

-- 3. Create is_manager function
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'manager'
  )
$$;

-- 4. Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    IF LOWER(NEW.email) IN ('strategicaigroup@gmail.com', 'admin@test.com') THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Update is_admin_email
CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT LOWER(_email) IN ('strategicaigroup@gmail.com', 'admin@test.com')
$$;

-- 6. Update RLS policies for manager access

DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
CREATE POLICY "Users can view own campaigns" ON public.campaigns
FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
CREATE POLICY "Users can update own campaigns" ON public.campaigns
FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete own campaigns" ON public.campaigns
FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can view own KB docs" ON public.knowledge_base;
CREATE POLICY "Users can view own KB docs" ON public.knowledge_base
FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can update own KB docs" ON public.knowledge_base;
CREATE POLICY "Users can update own KB docs" ON public.knowledge_base
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own KB docs" ON public.knowledge_base;
CREATE POLICY "Users can delete own KB docs" ON public.knowledge_base
FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can view own campaign channels" ON public.campaign_channels;
CREATE POLICY "Users can view own campaign channels" ON public.campaign_channels
FOR SELECT USING (EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_channels.campaign_id AND (campaigns.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), campaigns.user_id))));

DROP POLICY IF EXISTS "Users can update own campaign channels" ON public.campaign_channels;
CREATE POLICY "Users can update own campaign channels" ON public.campaign_channels
FOR UPDATE USING (EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_channels.campaign_id AND (campaigns.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), campaigns.user_id))));

DROP POLICY IF EXISTS "Users can delete own campaign channels" ON public.campaign_channels;
CREATE POLICY "Users can delete own campaign channels" ON public.campaign_channels
FOR DELETE USING (EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_channels.campaign_id AND (campaigns.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), campaigns.user_id))));

DROP POLICY IF EXISTS "Users can view own channel posts" ON public.channel_posts;
CREATE POLICY "Users can view own channel posts" ON public.channel_posts
FOR SELECT USING (EXISTS (SELECT 1 FROM campaign_channels cc JOIN campaigns c ON c.id = cc.campaign_id WHERE cc.id = channel_posts.campaign_channel_id AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id))));

DROP POLICY IF EXISTS "Users can update own channel posts" ON public.channel_posts;
CREATE POLICY "Users can update own channel posts" ON public.channel_posts
FOR UPDATE USING (EXISTS (SELECT 1 FROM campaign_channels cc JOIN campaigns c ON c.id = cc.campaign_id WHERE cc.id = channel_posts.campaign_channel_id AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id))));

DROP POLICY IF EXISTS "Users can delete own channel posts" ON public.channel_posts;
CREATE POLICY "Users can delete own channel posts" ON public.channel_posts
FOR DELETE USING (EXISTS (SELECT 1 FROM campaign_channels cc JOIN campaigns c ON c.id = cc.campaign_id WHERE cc.id = channel_posts.campaign_channel_id AND (c.user_id = auth.uid() OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), c.user_id))));

DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaign_vault;
CREATE POLICY "Users can view own campaigns" ON public.campaign_vault
FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaign_vault;
CREATE POLICY "Users can update own campaigns" ON public.campaign_vault
FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaign_vault;
CREATE POLICY "Users can delete own campaigns" ON public.campaign_vault
FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins can view all credentials" ON public.channel_credentials;
CREATE POLICY "Admins and managers can view credentials" ON public.channel_credentials
FOR SELECT USING (is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins can update all credentials" ON public.channel_credentials;
CREATE POLICY "Admins and managers can update credentials" ON public.channel_credentials
FOR UPDATE USING (is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins can delete all credentials" ON public.channel_credentials;
CREATE POLICY "Admins and managers can delete credentials" ON public.channel_credentials
FOR DELETE USING (is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Only admins can view roles" ON public.user_roles;
CREATE POLICY "Admins and own user can view roles" ON public.user_roles
FOR SELECT USING (is_admin(auth.uid()) OR auth.uid() = user_id OR is_manager_of(auth.uid(), user_id));
