-- Allow upsert on notification_reads (UPDATE on conflict requires UPDATE policy)
DROP POLICY IF EXISTS "Users update own notification reads" ON public.notification_reads;
CREATE POLICY "Users update own notification reads"
  ON public.notification_reads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
