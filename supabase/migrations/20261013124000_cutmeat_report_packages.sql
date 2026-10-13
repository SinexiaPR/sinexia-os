-- "Paquete para el dueño" de Cut Meat Distributors (Wagyu Food Service
-- LLC) -- Fase 2: un solo PDF con los 5 informes del día, portada primero.
-- Cada generación crea una versión nueva (nunca pisa), igual patrón que
-- cutmeat_daily_generated_pdfs del módulo "Informes diarios". Admin
-- genera/regenera/marca enviado; Gabriel (el cliente de esta empresa, el
-- dueño) solo lee y descarga -- reutiliza is_cut_meat_company() y
-- current_company_id(), ya existentes.

CREATE TABLE IF NOT EXISTS public.cutmeat_report_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  storage_path TEXT NOT NULL,
  cover_image_path TEXT,
  content_hash TEXT NOT NULL,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_to_owner BOOLEAN NOT NULL DEFAULT false,
  sent_marked_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sent_marked_at TIMESTAMPTZ,
  UNIQUE (company_id, report_date, version)
);
CREATE INDEX IF NOT EXISTS cutmeat_report_packages_company_date_idx
  ON public.cutmeat_report_packages (company_id, report_date);

ALTER TABLE public.cutmeat_report_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_report_packages" ON public.cutmeat_report_packages;
CREATE POLICY "Admins manage cutmeat_report_packages" ON public.cutmeat_report_packages FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

DROP POLICY IF EXISTS "Cut Meat client reads cutmeat_report_packages" ON public.cutmeat_report_packages;
CREATE POLICY "Cut Meat client reads cutmeat_report_packages" ON public.cutmeat_report_packages FOR SELECT TO authenticated
USING (public.current_company_id() = company_id);

-- Mismo bucket privado que los 5 PDF individuales (cutmeat-daily); ya
-- tiene su política de "solo admin" sobre storage.objects. El paquete y
-- la portada se suben ahí también, bajo su propio prefijo de ruta.
