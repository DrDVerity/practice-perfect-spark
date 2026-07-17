
CREATE POLICY "Weekly reports read by members/admins/managers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'weekly-reports'
    AND (
      is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.weekly_reports wr
        WHERE wr.pdf_url LIKE '%' || storage.objects.name
          AND (
            is_account_member(auth.uid(), wr.account_id)
            OR EXISTS (
              SELECT 1 FROM public.accounts a
              WHERE a.id = wr.account_id
                AND is_manager_of(auth.uid(), a.owner_user_id)
            )
          )
      )
    )
  );
