
-- Create table for storing channel platform credentials
CREATE TABLE public.channel_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform_name TEXT NOT NULL,
  platform_url TEXT,
  username TEXT,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channel_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only see their own credentials
CREATE POLICY "Users can view own credentials"
  ON public.channel_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own credentials"
  ON public.channel_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON public.channel_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON public.channel_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Admin access
CREATE POLICY "Admins can view all credentials"
  ON public.channel_credentials FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all credentials"
  ON public.channel_credentials FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete all credentials"
  ON public.channel_credentials FOR DELETE
  USING (is_admin(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_channel_credentials_updated_at
  BEFORE UPDATE ON public.channel_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
