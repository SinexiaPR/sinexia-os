-- Corrige el contrato de datos de "Informes diarios" (Cut Meat
-- Distributors) para que coincida con la especificación final:
--   - source usa 'manual' | 'claude-controlado' (no 'claude_import').
--   - Balance after Weekly Payments y Balance GABRIEL se congelan al
--     cerrar el día, para que el día siguiente pueda leerlos sin
--     recalcular sobre datos que puedan haber cambiado después.
--   - cutmeat_daily_settings gana el valor de arranque de Balance
--     GABRIEL y los dos valores planos de ingresos.
--   - Detalle por factura en el aging (para reproducir el PDF original
--     agrupado por proveedor/cliente).
--   - cutmeat_daily_variance_lines: líneas libres de Variación Diaria.
--   - El bloqueo de escritura en días cerrados (creado en la migración
--     anterior, 20261013130000) no había llegado a aplicarse por un
--     timeout -- se reintenta aquí, ya con cutmeat_daily_variance_lines
--     incluida.
--   - cutmeat_daily_controls(company_id, report_date) se reemplaza por
--     los 4 controles pedidos (conciliación, B, Gabriel vs. B anterior,
--     no ingresados), leyendo recurrentes de cutmeat_recurrentes (Fase
--     1), no de cutmeat_daily_recurring_payments.
--
-- No carga datos reales ni cambia los ya cargados (cutmeat_daily_history,
-- cutmeat_recurrentes).

-- ---------------------------------------------------------------------------
-- 1. source: 'manual' | 'claude-controlado' (no hay filas todavía, así
--    que no hace falta migrar valores existentes).
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
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_source_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (source IN (''manual'', ''claude-controlado''))',
      t, t || '_source_check'
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Balance after Weekly Payments y Balance GABRIEL congelados al
--    cerrar (closeDailyReport los calcula y los guarda; reopenDailyReport
--    los limpia). El día siguiente los lee como "el último día cerrado
--    anterior" (buildBalanceGabriel) en vez de recalcularlos sobre datos
--    que puedan cambiar después.
-- ---------------------------------------------------------------------------

ALTER TABLE public.cutmeat_daily_reports
  ADD COLUMN IF NOT EXISTS balance_after_weekly NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS balance_gabriel NUMERIC(14, 2);

-- ---------------------------------------------------------------------------
-- 3. cutmeat_daily_settings: valor de arranque de Balance GABRIEL (para
--    el primer día sin ninguno anterior) y el ingreso plano de la
--    semana en curso (ya no se prorratea por día ni se excluye el
--    lunes -- flat_weekly_income, ya existente, sigue siendo el valor
--    plano de las semanas siguientes, 14/21-day).
-- ---------------------------------------------------------------------------

ALTER TABLE public.cutmeat_daily_settings
  ADD COLUMN IF NOT EXISTS gabriel_starting_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_week_income NUMERIC(14, 2) NOT NULL DEFAULT 7500;

-- ---------------------------------------------------------------------------
-- 4. Detalle por factura del aging (Vendor/Customer Balance Detail
--    Report original): un nombre puede repetirse en varias filas (una
--    por factura). Aditivo -- sin detalle cargado, una sola fila con
--    nombre + balance sigue funcionando exactamente igual que hoy.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cutmeat_daily_aging_vendor_items',
    'cutmeat_daily_aging_customer_items'
  ])
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS txn_date DATE,
         ADD COLUMN IF NOT EXISTS txn_type TEXT,
         ADD COLUMN IF NOT EXISTS num TEXT,
         ADD COLUMN IF NOT EXISTS due_date DATE,
         ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 2),
         ADD COLUMN IF NOT EXISTS open_balance NUMERIC(14, 2)',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Variación Diaria: líneas libres (concepto + monto), sin tipos
--    fijos ni clasificación automática -- reemplaza el cálculo
--    automático anterior (recurrentes pagados vs. monto real).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_variance_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cutmeat_daily_reports(id) ON DELETE CASCADE,
  concept TEXT NOT NULL CHECK (char_length(trim(concept)) BETWEEN 1 AND 200),
  amount NUMERIC(14, 2) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_variance_lines_report_id_idx
  ON public.cutmeat_daily_variance_lines (report_id);
CREATE TRIGGER cutmeat_daily_variance_lines_updated_at BEFORE UPDATE ON public.cutmeat_daily_variance_lines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cutmeat_daily_variance_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cutmeat_daily_variance_lines" ON public.cutmeat_daily_variance_lines FOR ALL TO authenticated
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
-- 6. Bloqueo de escritura en días cerrados: cutmeat_daily_block_closed_write()
--    quedó definida en 20261013130000_cutmeat_daily_data_contract.sql,
--    pero los triggers que la enganchan a cada tabla no habían llegado a
--    aplicarse (timeout) -- se reintentan aquí, ya con
--    cutmeat_daily_variance_lines incluida en la lista.
-- ---------------------------------------------------------------------------

CREATE TRIGGER cutmeat_daily_reconciliation_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_reconciliation
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_reconciliation_items_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_reconciliation_items
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_bank_export_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_bank_export
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_bank_movements_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_bank_movements
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_aging_vendors_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_aging_vendors
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_aging_vendor_items_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_aging_vendor_items
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_aging_customers_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_aging_customers
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_aging_customer_items_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_aging_customer_items
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();
CREATE TRIGGER cutmeat_daily_variance_lines_block_closed_write BEFORE INSERT OR UPDATE OR DELETE ON public.cutmeat_daily_variance_lines
FOR EACH ROW EXECUTE FUNCTION public.cutmeat_daily_block_closed_write();

-- cutmeat_daily_generated_pdfs queda deliberadamente afuera: generar el
-- PDF final es precisamente lo que se hace con el día ya cerrado.

-- ---------------------------------------------------------------------------
-- 7. cutmeat_daily_controls(company_id, report_date): recomputa, desde
--    los datos ya guardados, los 4 controles pedidos:
--      1. statement_control: statement + uncleared checks/deposits = register.
--      2. weekly_control: register - recurrentes prior - recurrentes de
--         la semana (de cutmeat_recurrentes, Fase 1) = B congelado.
--      3. gabriel_control: Balance GABRIEL congelado de este día vs. el
--         B del último día cerrado anterior (en vivo o de
--         cutmeat_daily_history).
--      4. not_entered_pending: sin movimientos del banco sin clasificar
--         (ni vinculados a un recurrente ni marcados "Not entered
--         Sales") -- "no ingresados".
--    Función de solo lectura (ningún INSERT/UPDATE/DELETE), SECURITY
--    INVOKER (no DEFINER): corre con los permisos de quien la llama, así
--    que respeta la RLS de admin+empresa ya existente sin necesitar su
--    propio chequeo de acceso.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cutmeat_daily_controls(p_company_id UUID, p_report_date DATE)
RETURNS TABLE (
  report_id UUID,
  statement_control NUMERIC,
  statement_balanced BOOLEAN,
  weekly_control NUMERIC,
  weekly_balanced BOOLEAN,
  gabriel_control NUMERIC,
  gabriel_balanced BOOLEAN,
  not_entered_pending_count INTEGER,
  not_entered_balanced BOOLEAN,
  ok BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_report_id UUID;
  v_status TEXT;
  v_week_start DATE;
  v_statement_ending NUMERIC;
  v_register NUMERIC;
  v_items_total NUMERIC;
  v_statement_control NUMERIC;
  v_balance_after_weekly NUMERIC;
  v_balance_gabriel NUMERIC;
  v_recurrentes_prior NUMERIC;
  v_recurrentes_week NUMERIC;
  v_weekly_control NUMERIC;
  v_previous_balance NUMERIC;
  v_gabriel_control NUMERIC;
  v_not_entered_pending INTEGER;
BEGIN
  v_week_start := p_report_date - EXTRACT(DOW FROM p_report_date)::int;

  SELECT id, status, balance_after_weekly, balance_gabriel
    INTO v_report_id, v_status, v_balance_after_weekly, v_balance_gabriel
  FROM public.cutmeat_daily_reports
  WHERE company_id = p_company_id AND report_date = p_report_date;

  SELECT r.statement_ending, r.register INTO v_statement_ending, v_register
  FROM public.cutmeat_daily_reconciliation r
  WHERE r.report_id = v_report_id;

  SELECT COALESCE(sum(i.amount), 0) INTO v_items_total
  FROM public.cutmeat_daily_reconciliation_items i
  WHERE i.report_id = v_report_id;

  v_statement_control := CASE
    WHEN v_statement_ending IS NULL THEN NULL
    ELSE round(v_statement_ending + v_items_total - v_register, 2)
  END;

  SELECT COALESCE(sum(amount), 0) INTO v_recurrentes_prior
  FROM public.cutmeat_recurrentes
  WHERE company_id = p_company_id AND pagado = false AND due_date IS NOT NULL AND due_date < v_week_start;

  SELECT COALESCE(sum(amount), 0) INTO v_recurrentes_week
  FROM public.cutmeat_recurrentes
  WHERE company_id = p_company_id AND pagado = false AND due_date IS NOT NULL
    AND due_date >= v_week_start AND due_date <= v_week_start + 6;

  v_weekly_control := CASE
    WHEN v_register IS NULL OR v_balance_after_weekly IS NULL THEN NULL
    ELSE round(v_register - v_recurrentes_prior - v_recurrentes_week - v_balance_after_weekly, 2)
  END;

  SELECT balance FROM (
    SELECT balance_after_weekly AS balance, report_date FROM public.cutmeat_daily_history
    WHERE company_id = p_company_id AND report_date < p_report_date
    UNION ALL
    SELECT balance_after_weekly AS balance, report_date FROM public.cutmeat_daily_reports
    WHERE company_id = p_company_id AND report_date < p_report_date
      AND status = 'closed' AND balance_after_weekly IS NOT NULL
  ) AS prior
  ORDER BY report_date DESC
  LIMIT 1
  INTO v_previous_balance;

  v_gabriel_control := CASE
    WHEN v_balance_gabriel IS NULL THEN NULL
    ELSE round(v_balance_gabriel - COALESCE(v_previous_balance, v_balance_gabriel), 2)
  END;

  SELECT count(*) INTO v_not_entered_pending
  FROM public.cutmeat_daily_bank_movements m
  WHERE m.report_id = v_report_id
    AND m.linked_recurring_id IS NULL
    AND m.is_not_entered_deposit = false;

  RETURN QUERY SELECT
    v_report_id,
    v_statement_control,
    v_statement_control IS NOT NULL AND abs(v_statement_control) < 0.01,
    v_weekly_control,
    v_weekly_control IS NOT NULL AND abs(v_weekly_control) < 0.01,
    v_gabriel_control,
    v_gabriel_control IS NOT NULL AND abs(v_gabriel_control) < 0.01,
    v_not_entered_pending,
    v_not_entered_pending = 0,
    COALESCE(v_statement_control IS NOT NULL AND abs(v_statement_control) < 0.01, false)
      AND COALESCE(v_weekly_control IS NOT NULL AND abs(v_weekly_control) < 0.01, false)
      AND COALESCE(v_gabriel_control IS NOT NULL AND abs(v_gabriel_control) < 0.01, false)
      AND v_not_entered_pending = 0;
END;
$$;
