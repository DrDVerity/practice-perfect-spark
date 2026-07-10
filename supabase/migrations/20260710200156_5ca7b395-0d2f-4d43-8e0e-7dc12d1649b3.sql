
ALTER TABLE public.channel_posts
  ADD COLUMN IF NOT EXISTS post_format text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS carousel_slides jsonb,
  ADD COLUMN IF NOT EXISTS interactive_payload jsonb;

ALTER TABLE public.prospect_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view prospects" ON public.prospect_accounts;
CREATE POLICY "Admins and managers can view prospects"
ON public.prospect_accounts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_manager(auth.uid()));

GRANT SELECT ON public.prospect_accounts TO authenticated;
