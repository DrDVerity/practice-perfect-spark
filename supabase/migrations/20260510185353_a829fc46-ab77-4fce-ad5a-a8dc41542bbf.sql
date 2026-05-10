-- #1 Remove hardcoded admin auto-assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.is_admin_email(text);

-- #5 auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- #4 updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
           WHERE table_schema='public' AND column_name='updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- #9 Foreign keys (idempotent: drop-if-exists then add)
DO $$
DECLARE
  fks text[][] := ARRAY[
    ['profiles','profiles_user_id_fkey','user_id','auth.users','id','CASCADE'],
    ['profiles','profiles_parent_account_fkey','parent_account_id','auth.users','id','SET NULL'],
    ['user_roles','user_roles_user_id_fkey','user_id','auth.users','id','CASCADE'],
    ['user_secrets','user_secrets_user_id_fkey','user_id','auth.users','id','CASCADE'],
    ['knowledge_base','knowledge_base_user_id_fkey','user_id','auth.users','id','CASCADE'],
    ['campaigns','campaigns_user_id_fkey','user_id','auth.users','id','CASCADE'],
    ['campaign_channels','campaign_channels_campaign_id_fkey','campaign_id','public.campaigns','id','CASCADE'],
    ['campaign_addons','campaign_addons_campaign_id_fkey','campaign_id','public.campaigns','id','CASCADE'],
    ['campaign_budgets','campaign_budgets_campaign_id_fkey','campaign_id','public.campaigns','id','CASCADE'],
    ['channel_posts','channel_posts_campaign_channel_id_fkey','campaign_channel_id','public.campaign_channels','id','CASCADE'],
    ['channel_credentials','channel_credentials_user_id_fkey','user_id','auth.users','id','CASCADE'],
    ['manager_assignments','manager_assignments_manager_fkey','manager_user_id','auth.users','id','CASCADE'],
    ['manager_assignments','manager_assignments_client_fkey','client_user_id','auth.users','id','CASCADE'],
    ['messages','messages_sender_fkey','sender_id','auth.users','id','CASCADE'],
    ['messages','messages_recipient_fkey','recipient_id','auth.users','id','CASCADE'],
    ['messages','messages_campaign_fkey','campaign_id','public.campaigns','id','CASCADE']
  ];
  fk text[];
BEGIN
  FOREACH fk SLICE 1 IN ARRAY fks LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', fk[1], fk[2]);
    -- null-out or delete orphans depending on action
    IF fk[6] = 'SET NULL' THEN
      EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s r WHERE r.%I = public.%I.%I)',
                     fk[1], fk[3], fk[3], fk[4], fk[5], fk[1], fk[3]);
    ELSE
      EXECUTE format('DELETE FROM public.%I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s r WHERE r.%I = t.%I)',
                     fk[1], fk[3], fk[4], fk[5], fk[3]);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE %s',
                   fk[1], fk[2], fk[3], fk[4], fk[5], fk[6]);
  END LOOP;
END $$;

-- #10 Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_parent_account ON public.profiles(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_channels_campaign_id ON public.campaign_channels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_addons_campaign_id ON public.campaign_addons(campaign_id);
CREATE INDEX IF NOT EXISTS idx_channel_posts_campaign_channel_id ON public.channel_posts(campaign_channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_posts_scheduled_start ON public.channel_posts(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_channel_credentials_user_id ON public.channel_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_user_id ON public.knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_doc_type ON public.knowledge_base(doc_type);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_manager ON public.manager_assignments(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_client ON public.manager_assignments(client_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON public.messages(campaign_id);