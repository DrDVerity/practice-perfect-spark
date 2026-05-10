
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_account_id UUID NULL,
  ADD COLUMN IF NOT EXISTS full_name TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_parent_account_id ON public.profiles(parent_account_id);

-- Allow the parent business user to view their sub-account profiles
DROP POLICY IF EXISTS "Parent can view sub accounts" ON public.profiles;
CREATE POLICY "Parent can view sub accounts"
ON public.profiles
FOR SELECT
USING (
  parent_account_id IS NOT NULL
  AND parent_account_id = auth.uid()
);
