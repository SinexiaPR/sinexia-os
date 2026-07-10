-- Allow admins to bootstrap document_processing rows at report upload time.
-- Pipeline writes still use the service role; this only creates the pending row.

DROP POLICY IF EXISTS "Admins insert document processing" ON public.document_processing;
CREATE POLICY "Admins insert document processing"
  ON public.document_processing FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
