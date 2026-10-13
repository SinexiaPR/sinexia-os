-- "Informes diarios" de Cut Meat Distributors (Wagyu Food Service LLC).
-- Reemplaza el Google Sheet diario (una pestaña por día, 5 PDF a mano) por
-- un módulo interno solo-admin, siguiendo el mismo patrón que el
-- presupuesto de Tresbe: función is_cut_meat_company(uuid), RLS
-- is_admin() + chequeo de empresa, bucket privado para los PDF.

CREATE OR REPLACE FUNCTION public.is_cut_meat_company(value UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = value AND slug = 'cut-meat-distributors'
  );
$$;

-- ---------------------------------------------------------------------------
-- El día del informe: borrador / cerrado / reabierto
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'closed', 'reopened')),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, report_date)
);

DROP TRIGGER IF EXISTS cutmeat_daily_reports_updated_at ON public.cutmeat_daily_reports;
CREATE TRIGGER cutmeat_daily_reports_updated_at BEFORE UPDATE ON public.cutmeat_daily_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cutmeat_daily_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_reports" ON public.cutmeat_daily_reports;
CREATE POLICY "Admins manage cutmeat_daily_reports" ON public.cutmeat_daily_reports FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

-- Historial de eventos del día: creado, cerrado, reabierto, PDF generado.
CREATE TABLE IF NOT EXISTS public.cutmeat_daily_report_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('created', 'closed', 'reopened', 'pdf_generated', 'data_updated')),
  detail JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_report_events_report_id_idx
  ON public.cutmeat_daily_report_events (report_id);

ALTER TABLE public.cutmeat_daily_report_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_report_events" ON public.cutmeat_daily_report_events;
CREATE POLICY "Admins manage cutmeat_daily_report_events" ON public.cutmeat_daily_report_events FOR ALL TO authenticated
USING (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.cutmeat_daily_reports r
    WHERE r.id = report_id AND public.is_cut_meat_company(r.company_id)
  )
)
WITH CHECK (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.cutmeat_daily_reports r
    WHERE r.id = report_id AND public.is_cut_meat_company(r.company_id)
  )
);

-- ---------------------------------------------------------------------------
-- Reconciliation Report de QuickBooks (FIRST BANK)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL UNIQUE REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  statement_ending NUMERIC(14, 2) NOT NULL,
  register NUMERIC(14, 2) NOT NULL,
  source_pdf_path TEXT,
  extracted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS cutmeat_daily_reconciliation_updated_at ON public.cutmeat_daily_reconciliation;
CREATE TRIGGER cutmeat_daily_reconciliation_updated_at BEFORE UPDATE ON public.cutmeat_daily_reconciliation
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('uncleared_check', 'uncleared_deposit')),
  reference TEXT NOT NULL CHECK (char_length(trim(reference)) BETWEEN 1 AND 200),
  -- Con signo: los pendientes se cargan en negativo, igual que en el reporte.
  amount NUMERIC(14, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_reconciliation_items_report_id_idx
  ON public.cutmeat_daily_reconciliation_items (report_id);

-- ---------------------------------------------------------------------------
-- Export del banco (Deposit Accounts Activity Summary)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_bank_export (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL UNIQUE REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  closing_balance NUMERIC(14, 2),
  source_pdf_path TEXT,
  extracted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS cutmeat_daily_bank_export_updated_at ON public.cutmeat_daily_bank_export;
CREATE TRIGGER cutmeat_daily_bank_export_updated_at BEFORE UPDATE ON public.cutmeat_daily_bank_export
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 300),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('ingreso', 'egreso')),
  linked_recurring_id UUID,
  is_not_entered_deposit BOOLEAN NOT NULL DEFAULT false,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_bank_movements_report_id_idx
  ON public.cutmeat_daily_bank_movements (report_id);
DROP TRIGGER IF EXISTS cutmeat_daily_bank_movements_updated_at ON public.cutmeat_daily_bank_movements;
CREATE TRIGGER cutmeat_daily_bank_movements_updated_at BEFORE UPDATE ON public.cutmeat_daily_bank_movements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recurrentes del mes (A/P Aging Detail Recurrentes) + historial
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  item_type TEXT CHECK (item_type IS NULL OR char_length(item_type) <= 60),
  reference_number TEXT CHECK (reference_number IS NULL OR char_length(reference_number) <= 60),
  vendor TEXT CHECK (vendor IS NULL OR char_length(vendor) <= 200),
  concept TEXT NOT NULL CHECK (char_length(trim(concept)) BETWEEN 1 AND 200),
  due_date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  is_paid BOOLEAN NOT NULL DEFAULT false,
  actual_amount NUMERIC(14, 2),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_recurring_payments_company_due_idx
  ON public.cutmeat_daily_recurring_payments (company_id, due_date);
DROP TRIGGER IF EXISTS cutmeat_daily_recurring_payments_updated_at ON public.cutmeat_daily_recurring_payments;
CREATE TRIGGER cutmeat_daily_recurring_payments_updated_at BEFORE UPDATE ON public.cutmeat_daily_recurring_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cutmeat_daily_bank_movements
  ADD CONSTRAINT cutmeat_daily_bank_movements_linked_recurring_fkey
  FOREIGN KEY (linked_recurring_id)
  REFERENCES public.cutmeat_daily_recurring_payments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_recurring_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id UUID NOT NULL REFERENCES public.cutmeat_daily_recurring_payments(id) ON DELETE CASCADE,
  previous_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_recurring_payment_history_recurring_id_idx
  ON public.cutmeat_daily_recurring_payment_history (recurring_id);

ALTER TABLE public.cutmeat_daily_recurring_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_recurring_payments" ON public.cutmeat_daily_recurring_payments;
CREATE POLICY "Admins manage cutmeat_daily_recurring_payments" ON public.cutmeat_daily_recurring_payments FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

ALTER TABLE public.cutmeat_daily_recurring_payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_recurring_payment_history" ON public.cutmeat_daily_recurring_payment_history;
CREATE POLICY "Admins manage cutmeat_daily_recurring_payment_history" ON public.cutmeat_daily_recurring_payment_history FOR ALL TO authenticated
USING (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.cutmeat_daily_recurring_payments p
    WHERE p.id = recurring_id AND public.is_cut_meat_company(p.company_id)
  )
)
WITH CHECK (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.cutmeat_daily_recurring_payments p
    WHERE p.id = recurring_id AND public.is_cut_meat_company(p.company_id)
  )
);

-- ---------------------------------------------------------------------------
-- Ingresos proyectados (THIS WEEK)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_income_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  projection_date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 1500,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, projection_date)
);
DROP TRIGGER IF EXISTS cutmeat_daily_income_projection_updated_at ON public.cutmeat_daily_income_projection;
CREATE TRIGGER cutmeat_daily_income_projection_updated_at BEFORE UPDATE ON public.cutmeat_daily_income_projection
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cutmeat_daily_income_projection ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_income_projection" ON public.cutmeat_daily_income_projection;
CREATE POLICY "Admins manage cutmeat_daily_income_projection" ON public.cutmeat_daily_income_projection FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

-- ---------------------------------------------------------------------------
-- Aging de proveedores (A/P) y de clientes (A/R)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_aging_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL UNIQUE REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  raw_total NUMERIC(14, 2) NOT NULL,
  source_pdf_path TEXT,
  extracted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS cutmeat_daily_aging_vendors_updated_at ON public.cutmeat_daily_aging_vendors;
CREATE TRIGGER cutmeat_daily_aging_vendors_updated_at BEFORE UPDATE ON public.cutmeat_daily_aging_vendors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_aging_vendor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL CHECK (char_length(trim(vendor_name)) BETWEEN 1 AND 200),
  balance NUMERIC(14, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_aging_vendor_items_report_id_idx
  ON public.cutmeat_daily_aging_vendor_items (report_id);

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_aging_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL UNIQUE REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  raw_total NUMERIC(14, 2) NOT NULL,
  source_pdf_path TEXT,
  extracted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS cutmeat_daily_aging_customers_updated_at ON public.cutmeat_daily_aging_customers;
CREATE TRIGGER cutmeat_daily_aging_customers_updated_at BEFORE UPDATE ON public.cutmeat_daily_aging_customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_aging_customer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL CHECK (char_length(trim(customer_name)) BETWEEN 1 AND 200),
  balance NUMERIC(14, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_aging_customer_items_report_id_idx
  ON public.cutmeat_daily_aging_customer_items (report_id);

-- ---------------------------------------------------------------------------
-- Configuración de empresa: proveedores incluidos/excluidos, Prime Meats,
-- feriados. Editable desde la pantalla, no en el código.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_vendor_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  vendor_name TEXT NOT NULL CHECK (char_length(trim(vendor_name)) BETWEEN 1 AND 200),
  inclusion TEXT NOT NULL CHECK (inclusion IN ('included', 'excluded')),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, vendor_name)
);
DROP TRIGGER IF EXISTS cutmeat_daily_vendor_config_updated_at ON public.cutmeat_daily_vendor_config;
CREATE TRIGGER cutmeat_daily_vendor_config_updated_at BEFORE UPDATE ON public.cutmeat_daily_vendor_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cutmeat_daily_vendor_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_vendor_config" ON public.cutmeat_daily_vendor_config;
CREATE POLICY "Admins manage cutmeat_daily_vendor_config" ON public.cutmeat_daily_vendor_config FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  holiday_date DATE NOT NULL,
  label TEXT CHECK (label IS NULL OR char_length(label) <= 120),
  UNIQUE (company_id, holiday_date)
);

ALTER TABLE public.cutmeat_daily_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_holidays" ON public.cutmeat_daily_holidays;
CREATE POLICY "Admins manage cutmeat_daily_holidays" ON public.cutmeat_daily_holidays FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

-- Saldo de Prime Meats y recurrentes, y el placeholder de fuente de datos
-- para la Fase 2 (conector de QuickBooks Online). data_source hoy solo
-- admite 'manual'; 'quickbooks_api' queda reservado sin implementar.
CREATE TABLE IF NOT EXISTS public.cutmeat_daily_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  prime_meats_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  prime_meats_recurring NUMERIC(14, 2) NOT NULL DEFAULT 0,
  default_daily_income NUMERIC(14, 2) NOT NULL DEFAULT 1500,
  flat_weekly_income NUMERIC(14, 2) NOT NULL DEFAULT 9000,
  data_source TEXT NOT NULL DEFAULT 'manual' CHECK (data_source IN ('manual', 'quickbooks_api')),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS cutmeat_daily_settings_updated_at ON public.cutmeat_daily_settings;
CREATE TRIGGER cutmeat_daily_settings_updated_at BEFORE UPDATE ON public.cutmeat_daily_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cutmeat_daily_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_settings" ON public.cutmeat_daily_settings;
CREATE POLICY "Admins manage cutmeat_daily_settings" ON public.cutmeat_daily_settings FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

-- ---------------------------------------------------------------------------
-- PDF generados: cada regeneración crea una versión nueva, nunca pisa.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_generated_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL
    CHECK (doc_type IN ('reconciliation', 'bank', 'consolidated', 'vendors', 'customers')),
  version INTEGER NOT NULL CHECK (version > 0),
  storage_path TEXT NOT NULL,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, doc_type, version)
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_generated_pdfs_report_id_idx
  ON public.cutmeat_daily_generated_pdfs (report_id);

-- ---------------------------------------------------------------------------
-- RLS de las tablas colgadas de report_id (reconciliación, export, aging,
-- PDF generados): se valida la empresa a través de cutmeat_daily_reports.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cutmeat_daily_reconciliation',
    'cutmeat_daily_reconciliation_items',
    'cutmeat_daily_bank_export',
    'cutmeat_daily_bank_movements',
    'cutmeat_daily_aging_vendors',
    'cutmeat_daily_aging_vendor_items',
    'cutmeat_daily_aging_customers',
    'cutmeat_daily_aging_customer_items',
    'cutmeat_daily_generated_pdfs'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins manage ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (public.is_admin() AND EXISTS (
         SELECT 1 FROM public.cutmeat_daily_reports r
         WHERE r.id = %I.report_id AND public.is_cut_meat_company(r.company_id)
       ))
       WITH CHECK (public.is_admin() AND EXISTS (
         SELECT 1 FROM public.cutmeat_daily_reports r
         WHERE r.id = %I.report_id AND public.is_cut_meat_company(r.company_id)
       ))',
      'Admins manage ' || t, t, t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para los 5 PDF, solo admin.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets(id, name, public)
VALUES ('cutmeat-daily', 'cutmeat-daily', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admins manage cutmeat daily files" ON storage.objects;
CREATE POLICY "Admins manage cutmeat daily files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'cutmeat-daily' AND public.is_admin())
WITH CHECK (bucket_id = 'cutmeat-daily' AND public.is_admin());
