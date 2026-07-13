
-- 1. Fix mutable search_path on functions
CREATE OR REPLACE FUNCTION public.normalize_website_url(_url text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(_url, ''))), '^https?://', ''),
        '^www\.', ''
      ),
      '[/?#].*$', ''
    ),
    ''
  );
$function$;

CREATE OR REPLACE FUNCTION public.profiles_set_website_normalized()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.website_url_normalized := public.normalize_website_url(NEW.website_url);
  RETURN NEW;
END;
$function$;

-- 2. Tighten landing_page_leads INSERT policy - require a real email
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.landing_page_leads;
CREATE POLICY "Anyone can submit a lead"
ON public.landing_page_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 3 AND 320
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

-- 3. Restrict prospect_accounts SELECT to admins only (managers had blanket access)
DROP POLICY IF EXISTS "Admins and managers can view prospects" ON public.prospect_accounts;
CREATE POLICY "Admins can view prospects"
ON public.prospect_accounts
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));
