-- Weekly "% de nomina sobre venta" analysis Maria computes by hand (with
-- Claude Cowork) outside Sinexia OS: which refunds/tips to exclude and how
-- to split tips between businesses is her judgment call, never
-- recomputed here. Stores her already-computed JSON as-is (subtotals and
-- percentages included) so the PDF only ever formats numbers she supplied.

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_analysis (
  payroll_id UUID PRIMARY KEY REFERENCES public.tresbe_payrolls(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tresbe_payroll_analysis_updated_at ON public.tresbe_payroll_analysis;
CREATE TRIGGER tresbe_payroll_analysis_updated_at
  BEFORE UPDATE ON public.tresbe_payroll_analysis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tresbe_payroll_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage Tresbe payroll analysis"
  ON public.tresbe_payroll_analysis FOR ALL TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.tresbe_payrolls p
      WHERE p.id = payroll_id AND public.is_tresbe_company(p.company_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.tresbe_payrolls p
      WHERE p.id = payroll_id AND public.is_tresbe_company(p.company_id)
    )
  );
