-- Contrato de datos de "Informes diarios" (Cut Meat Distributors): la
-- pantalla deja de subir PDF para extraer datos (ver docs/
-- CUTMEAT_DAILY_DATA_CONTRACT.md); esta migración deja la base lista
-- para que los datos lleguen a mano o por una carga programática
-- (loadDailyReportData, pensada para una skill de Claude), con su
-- origen visible y un bloqueo a nivel de base -- no solo de pantalla --
-- para los días ya cerrados.
--
-- No cambia ningún cálculo existente ni carga datos reales.

-- ---------------------------------------------------------------------------
-- 1. Origen del dato: manual (a mano en la pantalla) o claude_import (vía
--    loadDailyReportData). Se agrega a las 4 tablas que hoy tienen
--    source_pdf_path/extracted_at -- las que antes se llenaban al subir
--    un PDF.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cutmeat_daily_reconciliation',
    'cutmeat_daily_bank_export',
    'cutmeat_daily_aging_vendors',
    'cutmeat_daily_aging_customers'
  ])
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT ''manual''
           CHECK (source IN (''manual'', ''claude_import'')),
         ADD COLUMN IF NOT EXISTS loaded_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
         ADD COLUMN IF NOT EXISTS loaded_at TIMESTAMPTZ',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Bloqueo de escritura en días cerrados, a nivel de base -- la
--    pantalla ya lo chequea (requireEditableReport en actions/
--    cutmeat-daily.ts), pero esto lo exige también para cualquier
--    escritura directa (admin client, otra skill, un script). Solo
--    reversible reabriendo el día (reopenDailyReport cambia status a
--    'reopened'); cutmeat_daily_generated_pdfs queda afuera a propósito
--    -- generar el PDF final es precisamente lo que se hace con el día
--    ya cerrado.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cutmeat_daily_block_closed_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_report_id UUID;
  report_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_report_id := OLD.report_id;
  ELSE
    target_report_id := NEW.report_id;
  END IF;

  SELECT status INTO report_status
  FROM public.cutmeat_daily_reports
  WHERE id = target_report_id;

  IF report_status = 'closed' THEN
    RAISE EXCEPTION
      'El día está cerrado. Reabrilo (reopenDailyReport) antes de modificar sus datos.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

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
    'cutmeat_daily_aging_customer_items'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_block_closed_write', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write()',
      t || '_block_closed_write', t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. cutmeat_daily_controls(company_id, report_date): recomputa, desde
--    los datos ya guardados (no desde la pantalla), los 4 controles que
--    hoy ya se muestran como alertas en "Informes diarios"
--    (checkDailyReportCompleteness en lib/cutmeat-daily/completeness.ts):
--      1. conciliación balanceada (statement + items - register ≈ 0)
--      2. sin movimientos del banco sin clasificar
--      3. sin proveedores del aging sin configurar
--      4. sin recurrentes vencidos sin pago
--    Función de solo lectura (ningún INSERT/UPDATE/DELETE), SECURITY
--    INVOKER (no DEFINER): corre con los permisos de quien la llama, así
--    que respeta la RLS de admin+empresa ya existente sin necesitar su
--    propio chequeo de acceso.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cutmeat_daily_controls(p_company_id UUID, p_report_date DATE)
RETURNS TABLE (
  report_id UUID,
  reconciliation_control NUMERIC,
  reconciliation_balanced BOOLEAN,
  unclassified_movement_count INTEGER,
  bank_movements_classified BOOLEAN,
  unconfigured_vendor_count INTEGER,
  vendor_aging_configured BOOLEAN,
  overdue_unpaid_count INTEGER,
  recurring_no_overdue_unpaid BOOLEAN,
  ok BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_report_id UUID;
  v_statement_ending NUMERIC;
  v_register NUMERIC;
  v_items_total NUMERIC;
  v_control NUMERIC;
  v_balanced BOOLEAN;
  v_unclassified INTEGER;
  v_unconfigured INTEGER;
  v_overdue INTEGER;
BEGIN
  SELECT id INTO v_report_id
  FROM public.cutmeat_daily_reports
  WHERE company_id = p_company_id AND report_date = p_report_date;

  SELECT r.statement_ending, r.register INTO v_statement_ending, v_register
  FROM public.cutmeat_daily_reconciliation r
  WHERE r.report_id = v_report_id;

  SELECT COALESCE(sum(i.amount), 0) INTO v_items_total
  FROM public.cutmeat_daily_reconciliation_items i
  WHERE i.report_id = v_report_id;

  v_control := CASE
    WHEN v_statement_ending IS NULL THEN NULL
    ELSE round(v_statement_ending + v_items_total - v_register, 2)
  END;
  v_balanced := v_control IS NOT NULL AND abs(v_control) < 0.01;

  SELECT count(*) INTO v_unclassified
  FROM public.cutmeat_daily_bank_movements m
  WHERE m.report_id = v_report_id
    AND m.linked_recurring_id IS NULL
    AND m.is_not_entered_deposit = false;

  SELECT count(*) INTO v_unconfigured
  FROM public.cutmeat_daily_aging_vendor_items vi
  WHERE vi.report_id = v_report_id
    AND NOT EXISTS (
      SELECT 1 FROM public.cutmeat_daily_vendor_config vc
      WHERE vc.company_id = p_company_id
        AND lower(vc.vendor_name) = lower(vi.vendor_name)
    );

  SELECT count(*) INTO v_overdue
  FROM public.cutmeat_daily_recurring_payments rp
  WHERE rp.company_id = p_company_id
    AND rp.is_paid = false
    AND rp.due_date <= p_report_date;

  RETURN QUERY SELECT
    v_report_id,
    v_control,
    v_balanced,
    v_unclassified,
    v_unclassified = 0,
    v_unconfigured,
    v_unconfigured = 0,
    v_overdue,
    v_overdue = 0,
    COALESCE(v_balanced, false) AND v_unclassified = 0 AND v_unconfigured = 0 AND v_overdue = 0;
END;
$$;
