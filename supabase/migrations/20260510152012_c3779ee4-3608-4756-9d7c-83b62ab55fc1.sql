
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

-- Replace SELECT policies to hide deleted profiles from non-admins
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (
  (
    (auth.uid() = user_id AND deleted_at IS NULL)
    OR is_manager_of(auth.uid(), user_id)
  ) OR is_admin(auth.uid())
);
