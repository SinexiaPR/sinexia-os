-- Tresbe "Presupuesto / Forecast": reemplaza las dos Google Sheets que hoy se
-- cruzan copiando y pegando (TRESBE_Seguimiento_Diario y TRESBE-CASHFLOW
-- OPERATIVO-SEMANAL).
--
-- Correcciones estructurales respecto de la planilla original:
--   1. Los depósitos de tarjeta (Clover) dejan de caer en "Cash Disponible":
--      "Credit Card Disponible" es su propia categoría y se usa de verdad.
--   2. Los barridos de la línea de reserva ("Fondo Transf. Reserva") tienen
--      categoría propia marcada como financiamiento, así no inflan ingresos ni
--      egresos operativos, pero siguen visibles en el control de caja.
--   3. El presupuesto se genera desde supuestos configurables en vez de pegarse
--      a mano; cada celda queda editable y marcada como calculada o manual.
--   4. El resumen de 13 semanas se calcula sobre estas tablas (la hoja original
--      quedó siempre vacía).
--   5. Los campos manuales del control de caja viven por semana y persisten.

-- Semana operativa: lunes a domingo, igual que el seguimiento diario.
CREATE OR REPLACE FUNCTION public.tresbe_budget_week_start(value DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT value - ((EXTRACT(ISODOW FROM value)::INT) - 1);
$$;

DO $$ BEGIN
  CREATE TYPE public.tresbe_budget_category_kind AS ENUM (
    'ingreso', 'egreso', 'financiamiento'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tresbe_budget_total_group AS ENUM (
    'ingresos',
    'proveedores_compras',
    'nomina',
    'payroll_taxes',
    'debitos_bancarios',
    'financiamiento'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tresbe_budget_origin AS ENUM ('calculado', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Categorías (lista fija, seedeada más abajo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tresbe_budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK (code ~ '^[a-z0-9_]{2,60}$'),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  kind public.tresbe_budget_category_kind NOT NULL,
  total_group public.tresbe_budget_total_group NOT NULL,
  -- true solo para la línea de reserva: se excluye de los totales operativos
  -- pero se muestra aparte y suma en el saldo real contra el banco.
  is_financing BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code),
  CHECK ((is_financing) = (total_group = 'financiamiento')),
  CHECK ((kind = 'financiamiento') = is_financing)
);

-- ---------------------------------------------------------------------------
-- Movimientos reales (libro diario)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tresbe_budget_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  week_start DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('ingreso', 'egreso')),
  category_id UUID NOT NULL REFERENCES public.tresbe_budget_categories(id) ON DELETE RESTRICT,
  concept TEXT NOT NULL CHECK (char_length(trim(concept)) BETWEEN 1 AND 200),
  counterparty TEXT CHECK (counterparty IS NULL OR char_length(trim(counterparty)) <= 200),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  account TEXT CHECK (account IS NULL OR char_length(trim(account)) <= 100),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Presupuesto semanal (reemplaza las "celdas amarillas" pegadas a mano)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tresbe_budget_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  week_start DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES public.tresbe_budget_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  origin public.tresbe_budget_origin NOT NULL DEFAULT 'calculado',
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  generated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, entry_date, category_id)
);

-- Historial de ediciones manuales sobre el presupuesto (quién, cuándo, por qué).
CREATE TABLE IF NOT EXISTS public.tresbe_budget_entry_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.tresbe_budget_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES public.tresbe_budget_categories(id) ON DELETE RESTRICT,
  previous_amount NUMERIC(12,2),
  new_amount NUMERIC(12,2) NOT NULL,
  previous_origin public.tresbe_budget_origin,
  new_origin public.tresbe_budget_origin NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  changed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Control de caja (los tres campos manuales que la planilla nunca completaba)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tresbe_budget_cash_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  week_start DATE NOT NULL,
  opening_bank_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_bank_balance NUMERIC(14,2),
  minimum_cash_target NUMERIC(14,2),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Supuestos del forecast (reemplazan las 5 hojas del archivo de cash flow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tresbe_budget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  -- ancla del calendario: lunes de la semana 1 del horizonte.
  week_one_start DATE NOT NULL,
  forecast_weeks INTEGER NOT NULL DEFAULT 13 CHECK (forecast_weeks BETWEEN 1 AND 52),
  processor_fee_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0150 CHECK (processor_fee_rate BETWEEN 0 AND 1),
  loan_holdback_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0800 CHECK (loan_holdback_rate BETWEEN 0 AND 1),
  card_settlement_lag_days INTEGER NOT NULL DEFAULT 3 CHECK (card_settlement_lag_days BETWEEN 0 AND 14),
  payroll_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (payroll_amount >= 0),
  payroll_weekday INTEGER NOT NULL DEFAULT 3 CHECK (payroll_weekday BETWEEN 1 AND 7),
  -- "Cash Out LADO CE": otra entidad que hoy viaja dentro del forecast de
  -- nómina de Tresbe. Se guarda aparte y solo suma si está habilitado.
  related_cash_out_label TEXT,
  related_cash_out_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (related_cash_out_amount >= 0),
  related_cash_out_enabled BOOLEAN NOT NULL DEFAULT false,
  payroll_tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.2261 CHECK (payroll_tax_rate BETWEEN 0 AND 1),
  -- días después del pago de nómina; el bug de la planilla era pegarlo el mismo
  -- miércoles cuando el forecast lo calcula para el jueves.
  payroll_tax_offset_days INTEGER NOT NULL DEFAULT 1 CHECK (payroll_tax_offset_days BETWEEN 0 AND 14),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tresbe_budget_sales_pattern (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  gross_sales NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gross_sales >= 0),
  card_share NUMERIC(6,4) NOT NULL DEFAULT 0 CHECK (card_share BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, weekday)
);

CREATE TABLE IF NOT EXISTS public.tresbe_budget_recurring_debits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  concept TEXT NOT NULL CHECK (char_length(trim(concept)) BETWEEN 1 AND 200),
  classification TEXT CHECK (classification IS NULL OR char_length(trim(classification)) <= 120),
  category_id UUID NOT NULL REFERENCES public.tresbe_budget_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('semanal', 'quincenal', 'mensual')),
  weekday INTEGER CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 7),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  weekend_shift TEXT NOT NULL DEFAULT 'ninguno' CHECK (weekend_shift IN ('ninguno', 'viernes_anterior', 'lunes_siguiente')),
  confidence TEXT NOT NULL DEFAULT 'alta' CHECK (confidence IN ('alta', 'media', 'baja')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (frequency IN ('semanal', 'quincenal') AND weekday IS NOT NULL)
    OR (frequency = 'mensual' AND day_of_month IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.tresbe_budget_vendor_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  vendor_name TEXT NOT NULL CHECK (char_length(trim(vendor_name)) BETWEEN 1 AND 200),
  vendor_type TEXT NOT NULL CHECK (vendor_type IN (
    'proveedor_activo', 'recurrente_al_dia', 'compra_mercaderia_cash'
  )),
  category_id UUID NOT NULL REFERENCES public.tresbe_budget_categories(id) ON DELETE RESTRICT,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, vendor_name, weekday)
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS tresbe_budget_categories_company_idx
  ON public.tresbe_budget_categories(company_id, sort_order);
CREATE INDEX IF NOT EXISTS tresbe_budget_movements_week_idx
  ON public.tresbe_budget_movements(company_id, week_start, entry_date);
CREATE INDEX IF NOT EXISTS tresbe_budget_movements_category_idx
  ON public.tresbe_budget_movements(category_id, entry_date);
CREATE INDEX IF NOT EXISTS tresbe_budget_entries_week_idx
  ON public.tresbe_budget_entries(company_id, week_start, entry_date);
CREATE INDEX IF NOT EXISTS tresbe_budget_entries_category_idx
  ON public.tresbe_budget_entries(category_id, entry_date);
CREATE INDEX IF NOT EXISTS tresbe_budget_entry_revisions_entry_idx
  ON public.tresbe_budget_entry_revisions(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tresbe_budget_entry_revisions_category_idx
  ON public.tresbe_budget_entry_revisions(category_id);
CREATE INDEX IF NOT EXISTS tresbe_budget_cash_control_week_idx
  ON public.tresbe_budget_cash_control(company_id, week_start DESC);
CREATE INDEX IF NOT EXISTS tresbe_budget_recurring_debits_company_idx
  ON public.tresbe_budget_recurring_debits(company_id, is_active);
CREATE INDEX IF NOT EXISTS tresbe_budget_recurring_debits_category_idx
  ON public.tresbe_budget_recurring_debits(category_id);
CREATE INDEX IF NOT EXISTS tresbe_budget_vendor_schedule_company_idx
  ON public.tresbe_budget_vendor_schedule(company_id, is_active, weekday);
CREATE INDEX IF NOT EXISTS tresbe_budget_vendor_schedule_category_idx
  ON public.tresbe_budget_vendor_schedule(category_id);
CREATE INDEX IF NOT EXISTS tresbe_budget_entries_updated_by_idx
  ON public.tresbe_budget_entries(updated_by);
CREATE INDEX IF NOT EXISTS tresbe_budget_movements_created_by_idx
  ON public.tresbe_budget_movements(created_by);

-- ---------------------------------------------------------------------------
-- Triggers: integridad de empresa, semana derivada y coherencia de categoría
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_tresbe_budget_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tresbe_company(NEW.company_id) THEN
    RAISE EXCEPTION 'El módulo de presupuesto es exclusivo de Tresbe';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tresbe_budget_categories',
    'tresbe_budget_movements',
    'tresbe_budget_entries',
    'tresbe_budget_cash_control',
    'tresbe_budget_settings',
    'tresbe_budget_sales_pattern',
    'tresbe_budget_recurring_debits',
    'tresbe_budget_vendor_schedule'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I', t || '_company_integrity', t
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF company_id ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_budget_company()',
      t || '_company_integrity', t
    );
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I', t || '_updated_at', t
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t || '_updated_at', t
    );
  END LOOP;
END $$;

-- La semana nunca se escribe a mano: se deriva de la fecha.
CREATE OR REPLACE FUNCTION public.set_tresbe_budget_week_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.week_start := public.tresbe_budget_week_start(NEW.entry_date);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_budget_movements_week ON public.tresbe_budget_movements;
CREATE TRIGGER tresbe_budget_movements_week
  BEFORE INSERT OR UPDATE OF entry_date ON public.tresbe_budget_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_tresbe_budget_week_start();

DROP TRIGGER IF EXISTS tresbe_budget_entries_week ON public.tresbe_budget_entries;
CREATE TRIGGER tresbe_budget_entries_week
  BEFORE INSERT OR UPDATE OF entry_date ON public.tresbe_budget_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_tresbe_budget_week_start();

-- Una categoría de ingreso no puede recibir un egreso (y viceversa). La
-- categoría de financiamiento admite ambos sentidos: el barrido entra y sale.
CREATE OR REPLACE FUNCTION public.validate_tresbe_budget_movement_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_kind public.tresbe_budget_category_kind;
  v_company UUID;
BEGIN
  SELECT kind, company_id INTO v_kind, v_company
    FROM public.tresbe_budget_categories WHERE id = NEW.category_id;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Categoría de presupuesto inexistente';
  END IF;
  IF v_company <> NEW.company_id THEN
    RAISE EXCEPTION 'La categoría pertenece a otra empresa';
  END IF;
  IF v_kind <> 'financiamiento' AND v_kind::TEXT <> NEW.direction THEN
    RAISE EXCEPTION 'La categoría % no admite movimientos de tipo %', NEW.category_id, NEW.direction;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_budget_movement_category ON public.tresbe_budget_movements;
CREATE TRIGGER tresbe_budget_movement_category
  BEFORE INSERT OR UPDATE OF category_id, direction, company_id
  ON public.tresbe_budget_movements
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_budget_movement_category();

CREATE OR REPLACE FUNCTION public.validate_tresbe_budget_entry_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_budget_categories c
     WHERE c.id = NEW.category_id AND c.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'La categoría pertenece a otra empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_budget_entry_category ON public.tresbe_budget_entries;
CREATE TRIGGER tresbe_budget_entry_category
  BEFORE INSERT OR UPDATE OF category_id, company_id ON public.tresbe_budget_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_budget_entry_category();

-- Historial automático de cada cambio de importe u origen del presupuesto.
CREATE OR REPLACE FUNCTION public.record_tresbe_budget_entry_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.origin IS NOT DISTINCT FROM OLD.origin THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.tresbe_budget_entry_revisions (
    entry_id, company_id, entry_date, category_id,
    previous_amount, new_amount, previous_origin, new_origin, note, changed_by
  ) VALUES (
    NEW.id, NEW.company_id, NEW.entry_date, NEW.category_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.amount ELSE NULL END,
    NEW.amount,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.origin ELSE NULL END,
    NEW.origin, NEW.note, NEW.updated_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_budget_entry_revision ON public.tresbe_budget_entries;
CREATE TRIGGER tresbe_budget_entry_revision
  AFTER INSERT OR UPDATE OF amount, origin ON public.tresbe_budget_entries
  FOR EACH ROW EXECUTE FUNCTION public.record_tresbe_budget_entry_revision();

-- ---------------------------------------------------------------------------
-- RLS: módulo interno, solo admins de Sinexia sobre la empresa Tresbe.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tresbe_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_entry_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_cash_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_sales_pattern ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_recurring_debits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_budget_vendor_schedule ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tresbe_budget_categories',
    'tresbe_budget_movements',
    'tresbe_budget_entries',
    'tresbe_budget_cash_control',
    'tresbe_budget_settings',
    'tresbe_budget_sales_pattern',
    'tresbe_budget_recurring_debits',
    'tresbe_budget_vendor_schedule'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Admins manage %s" ON public.%I', t, t
    );
    EXECUTE format(
      'CREATE POLICY "Admins manage %s" ON public.%I
         FOR ALL TO authenticated
         USING (public.is_admin() AND public.is_tresbe_company(company_id))
         WITH CHECK (public.is_admin() AND public.is_tresbe_company(company_id))',
      t, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Admins read budget revisions" ON public.tresbe_budget_entry_revisions;
CREATE POLICY "Admins read budget revisions" ON public.tresbe_budget_entry_revisions
  FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id));

-- ---------------------------------------------------------------------------
-- Semilla: las 9 categorías (8 originales + la nueva de financiamiento)
-- ---------------------------------------------------------------------------
INSERT INTO public.tresbe_budget_categories
  (company_id, code, name, kind, total_group, is_financing, sort_order)
SELECT c.id, v.code, v.name, v.kind::public.tresbe_budget_category_kind,
       v.total_group::public.tresbe_budget_total_group, v.is_financing, v.sort_order
  FROM public.companies c
 CROSS JOIN (VALUES
   ('credit_card_disponible', 'Credit Card Disponible', 'ingreso', 'ingresos', false, 10),
   ('cash_disponible', 'Cash Disponible', 'ingreso', 'ingresos', false, 20),
   ('proveedores', 'Proveedores', 'egreso', 'proveedores_compras', false, 30),
   ('recurrentes', 'Recurrentes', 'egreso', 'proveedores_compras', false, 40),
   ('reembolsos_mercaderia', 'Reembolsos mercadería', 'egreso', 'proveedores_compras', false, 50),
   ('nomina', 'Nómina', 'egreso', 'nomina', false, 60),
   ('payroll_taxes', 'Payroll Taxes', 'egreso', 'payroll_taxes', false, 70),
   ('debitos_bancarios', 'Débitos Bancarios', 'egreso', 'debitos_bancarios', false, 80),
   ('linea_reserva', 'Movimiento Línea de Reserva', 'financiamiento', 'financiamiento', true, 90)
 ) AS v(code, name, kind, total_group, is_financing, sort_order)
 WHERE c.slug = 'tresbe'
ON CONFLICT (company_id, code) DO NOTHING;

-- Supuestos iniciales tomados de "TRESBE-CASHFLOW OPERATIVO-SEMANAL".
INSERT INTO public.tresbe_budget_settings (
  company_id, week_one_start, forecast_weeks,
  processor_fee_rate, loan_holdback_rate, card_settlement_lag_days,
  payroll_amount, payroll_weekday,
  related_cash_out_label, related_cash_out_amount, related_cash_out_enabled,
  payroll_tax_rate, payroll_tax_offset_days
)
SELECT c.id, DATE '2026-08-24', 13,
       0.0150, 0.0800, 3,
       7857.25, 3,
       'Cash Out LADO CE', 1648.22, false,
       0.2261, 1
  FROM public.companies c WHERE c.slug = 'tresbe'
ON CONFLICT (company_id) DO NOTHING;
