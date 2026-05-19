UPDATE public.campaigns
SET landing_page_url = 'https://practice-perfect-spark.lovable.app/landing/' || id::text
WHERE landing_page_url ILIKE '%/functions/v1/serve-landing-page%'
  AND landing_page_html IS NOT NULL;