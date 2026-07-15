
-- Allow admins and managers-of-the-owner to view KPI metrics/financials
-- so admin-impersonation dashboards can render seeded/test data.
DROP POLICY IF EXISTS "Members view metrics" ON public.campaign_daily_metrics;
CREATE POLICY "Members view metrics" ON public.campaign_daily_metrics
FOR SELECT USING (
  public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id))
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_daily_metrics.campaign_id
      AND public.is_manager_of(auth.uid(), c.user_id)
  )
);

DROP POLICY IF EXISTS "Members view financials" ON public.campaign_financials;
CREATE POLICY "Members view financials" ON public.campaign_financials
FOR SELECT USING (
  public.is_account_member(auth.uid(), public.account_id_for_campaign(campaign_id))
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_financials.campaign_id
      AND public.is_manager_of(auth.uid(), c.user_id)
  )
);
