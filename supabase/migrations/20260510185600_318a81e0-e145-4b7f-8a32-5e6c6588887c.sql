CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_window
  ON public.ai_rate_limits(window_start);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own rate limits" ON public.ai_rate_limits;
CREATE POLICY "Users view own rate limits"
  ON public.ai_rate_limits FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.check_and_consume_rate_limit(
  _user_id uuid,
  _endpoint text,
  _max_per_minute integer DEFAULT 10
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bucket timestamptz := date_trunc('minute', now());
  _count integer;
BEGIN
  INSERT INTO public.ai_rate_limits (user_id, endpoint, window_start, call_count)
  VALUES (_user_id, _endpoint, _bucket, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET call_count = public.ai_rate_limits.call_count + 1
  RETURNING call_count INTO _count;

  -- Cleanup old buckets occasionally (older than 1 hour)
  IF random() < 0.01 THEN
    DELETE FROM public.ai_rate_limits
    WHERE window_start < now() - interval '1 hour';
  END IF;

  RETURN _count <= _max_per_minute;
END;
$$;