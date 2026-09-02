-- Alinea el módulo con la planilla v3 (TRESBE_Seguimiento_Diario_v3), que
-- distingue cuatro tipos de movimiento y no tres conceptos:
--
--   Ingreso / Egreso  -> operativo, entra en Flujo Neto Operativo.
--   Intercompany      -> transferencias entre las LLC, con contraparte y saldo
--                        propio por empresa relacionada. No es venta ni gasto.
--   Financiamiento    -> línea de crédito, separada en Utilización y Repago,
--                        con saldo de la línea que se arrastra semana a semana.
--
-- El puente de caja queda como en v3:
--   Saldo inicial + Flujo Neto Operativo + Neto Intercompany
--     = Saldo antes de Financiamiento
--     + Utilización - Repago = Saldo Final Banco Teórico.

-- Los enums quedaban cortos y ALTER TYPE ... ADD VALUE no permite usar el valor
-- nuevo en la misma transacción: se pasan a TEXT con CHECK, como el resto del
-- esquema (frequency, confidence, vendor_type).
-- Las viejas CHECK comparan contra los enums: se sacan antes de convertir.
ALTER TABLE public.tresbe_budget_categories
  DROP CONSTRAINT IF EXISTS tresbe_budget_categories_check,
  DROP CONSTRAINT IF EXISTS tresbe_budget_categories_check1;

ALTER TABLE public.tresbe_budget_categories
  ALTER COLUMN kind TYPE TEXT,
  ALTER COLUMN total_group TYPE TEXT;

ALTER TABLE public.tresbe_budget_categories
  ADD COLUMN IF NOT EXISTS flow TEXT
    CHECK (flow IS NULL OR flow IN ('entrada', 'salida'));

-- La categoría única de reserva que existía hoy queda como entrada hasta que
-- más abajo se reemplaza por Utilización / Repago.
UPDATE public.tresbe_budget_categories
   SET flow = 'entrada'
 WHERE kind IN ('financiamiento', 'intercompany') AND flow IS NULL;

ALTER TABLE public.tresbe_budget_categories
  ADD CONSTRAINT tresbe_budget_categories_kind_check
    CHECK (kind IN ('ingreso', 'egreso', 'financiamiento', 'intercompany')),
  ADD CONSTRAINT tresbe_budget_categories_group_check
    CHECK (total_group IN (
      'ingresos', 'proveedores_compras', 'nomina', 'payroll_taxes',
      'debitos_bancarios', 'intercompany', 'financiamiento'
    )),
  ADD CONSTRAINT tresbe_budget_categories_financing_check
    CHECK (is_financing = (kind = 'financiamiento')),
  ADD CONSTRAINT tresbe_budget_categories_group_kind_check
    CHECK (
      (kind = 'financiamiento' AND total_group = 'financiamiento')
      OR (kind = 'intercompany' AND total_group = 'intercompany')
      OR (kind = 'ingreso' AND total_group = 'ingresos')
      OR (kind = 'egreso' AND total_group IN (
            'proveedores_compras', 'nomina', 'payroll_taxes', 'debitos_bancarios'
          ))
    ),
  -- Fuera de lo operativo el sentido lo fija la categoría, no quien carga.
  ADD CONSTRAINT tresbe_budget_categories_flow_required_check
    CHECK (
      (kind IN ('financiamiento', 'intercompany') AND flow IS NOT NULL)
      OR (kind IN ('ingreso', 'egreso') AND flow IS NULL)
    );

-- ---------------------------------------------------------------------------
-- Contrapartes intercompany (las otras LLC del grupo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tresbe_budget_counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  -- Saldo al inicio de la semana 1 del horizonte; positivo = la contraparte
  -- le debe a Tresbe. Las semanas siguientes se calculan encadenando.
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.tresbe_budget_movements
  ADD COLUMN IF NOT EXISTS counterparty_id UUID
    REFERENCES public.tresbe_budget_counterparties(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS tresbe_budget_movements_counterparty_idx
  ON public.tresbe_budget_movements(counterparty_id, entry_date);
CREATE INDEX IF NOT EXISTS tresbe_budget_counterparties_company_idx
  ON public.tresbe_budget_counterparties(company_id, is_active);

-- Saldo de la línea de crédito al inicio del horizonte (negativo = deuda).
ALTER TABLE public.tresbe_budget_settings
  ADD COLUMN IF NOT EXISTS credit_line_opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.tresbe_budget_counterparties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage tresbe_budget_counterparties"
  ON public.tresbe_budget_counterparties;
CREATE POLICY "Admins manage tresbe_budget_counterparties"
  ON public.tresbe_budget_counterparties
  FOR ALL TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id))
  WITH CHECK (public.is_admin() AND public.is_tresbe_company(company_id));

DROP TRIGGER IF EXISTS tresbe_budget_counterparties_company_integrity
  ON public.tresbe_budget_counterparties;
CREATE TRIGGER tresbe_budget_counterparties_company_integrity
  BEFORE INSERT OR UPDATE OF company_id ON public.tresbe_budget_counterparties
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_budget_company();
DROP TRIGGER IF EXISTS tresbe_budget_counterparties_updated_at
  ON public.tresbe_budget_counterparties;
CREATE TRIGGER tresbe_budget_counterparties_updated_at
  BEFORE UPDATE ON public.tresbe_budget_counterparties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categorías nuevas y migración de las que había
-- ---------------------------------------------------------------------------
INSERT INTO public.tresbe_budget_categories
  (company_id, code, name, kind, total_group, is_financing, flow, sort_order)
SELECT c.id, v.code, v.name, v.kind, v.total_group, v.is_financing, v.flow, v.sort_order
  FROM public.companies c
 CROSS JOIN (VALUES
   ('intercompany_recibido', 'Intercompany Recibido', 'intercompany', 'intercompany', false, 'entrada', 85),
   ('intercompany_entregado', 'Intercompany Entregado', 'intercompany', 'intercompany', false, 'salida', 86),
   ('linea_credito_utilizacion', 'Utilización Línea de Crédito', 'financiamiento', 'financiamiento', true, 'entrada', 90),
   ('linea_credito_repago', 'Repago Línea de Crédito', 'financiamiento', 'financiamiento', true, 'salida', 91)
 ) AS v(code, name, kind, total_group, is_financing, flow, sort_order)
 WHERE c.slug = 'tresbe'
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO public.tresbe_budget_counterparties (company_id, name, opening_balance)
SELECT c.id, v.name, v.opening_balance
  FROM public.companies c
 CROSS JOIN (VALUES
   ('GRUPO SIBARITA LLC', 0),
   ('LADO CE LLC', 0)
 ) AS v(name, opening_balance)
 WHERE c.slug = 'tresbe'
ON CONFLICT (company_id, name) DO NOTHING;

-- El sentido de un movimiento no operativo lo fija su categoría.
CREATE OR REPLACE FUNCTION public.validate_tresbe_budget_movement_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
  v_flow TEXT;
  v_company UUID;
  v_expected TEXT;
BEGIN
  SELECT kind, flow, company_id INTO v_kind, v_flow, v_company
    FROM public.tresbe_budget_categories WHERE id = NEW.category_id;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Categoría de presupuesto inexistente';
  END IF;
  IF v_company <> NEW.company_id THEN
    RAISE EXCEPTION 'La categoría pertenece a otra empresa';
  END IF;
  IF v_kind IN ('ingreso', 'egreso') AND v_kind <> NEW.direction THEN
    RAISE EXCEPTION 'La categoría no admite movimientos de tipo %', NEW.direction;
  END IF;
  IF v_flow IS NOT NULL THEN
    v_expected := CASE WHEN v_flow = 'entrada' THEN 'ingreso' ELSE 'egreso' END;
    IF NEW.direction <> v_expected THEN
      RAISE EXCEPTION 'La categoría exige un movimiento de %', v_flow;
    END IF;
  END IF;
  IF v_kind = 'intercompany' THEN
    IF NEW.counterparty_id IS NULL THEN
      RAISE EXCEPTION 'Un movimiento intercompany necesita contraparte';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.tresbe_budget_counterparties p
       WHERE p.id = NEW.counterparty_id AND p.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'La contraparte pertenece a otra empresa';
    END IF;
  ELSIF NEW.counterparty_id IS NOT NULL THEN
    RAISE EXCEPTION 'Solo los movimientos intercompany llevan contraparte';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_budget_movement_category ON public.tresbe_budget_movements;
CREATE TRIGGER tresbe_budget_movement_category
  BEFORE INSERT OR UPDATE OF category_id, direction, company_id, counterparty_id
  ON public.tresbe_budget_movements
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_budget_movement_category();

DO $$
DECLARE
  v_company UUID;
  v_reserva UUID;
  v_utilizacion UUID;
  v_repago UUID;
  v_recibido UUID;
  v_tarjeta UUID;
  v_cash UUID;
  v_sibarita UUID;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE slug = 'tresbe';
  IF v_company IS NULL THEN RETURN; END IF;

  SELECT id INTO v_reserva FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'linea_reserva';
  SELECT id INTO v_utilizacion FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'linea_credito_utilizacion';
  SELECT id INTO v_repago FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'linea_credito_repago';
  SELECT id INTO v_recibido FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'intercompany_recibido';
  SELECT id INTO v_tarjeta FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'credit_card_disponible';
  SELECT id INTO v_cash FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'cash_disponible';
  SELECT id INTO v_sibarita FROM public.tresbe_budget_counterparties
   WHERE company_id = v_company AND name = 'GRUPO SIBARITA LLC';

  -- La categoría única de reserva se parte según el sentido del movimiento.
  IF v_reserva IS NOT NULL THEN
    UPDATE public.tresbe_budget_movements
       SET category_id = v_utilizacion
     WHERE company_id = v_company AND category_id = v_reserva AND direction = 'ingreso';
    UPDATE public.tresbe_budget_movements
       SET category_id = v_repago
     WHERE company_id = v_company AND category_id = v_reserva AND direction = 'egreso';
    UPDATE public.tresbe_budget_entries
       SET category_id = v_utilizacion
     WHERE company_id = v_company AND category_id = v_reserva;
    UPDATE public.tresbe_budget_categories
       SET is_active = false
     WHERE id = v_reserva;
  END IF;

  -- El cheque de GRUPO SIBARITA no es venta: en v3 es Intercompany Recibido.
  UPDATE public.tresbe_budget_movements
     SET category_id = v_recibido,
         counterparty_id = v_sibarita,
         concept = 'Deposito Cheque',
         counterparty = 'GRUPO SIBARITA LLC'
   WHERE company_id = v_company
     AND category_id = v_cash
     AND entry_date = DATE '2026-08-26'
     AND amount = 9000.00;

  -- DoorDash entra por tarjeta, no por efectivo.
  UPDATE public.tresbe_budget_movements
     SET category_id = v_tarjeta
   WHERE company_id = v_company
     AND category_id = v_cash
     AND entry_date = DATE '2026-08-28'
     AND amount = 26.88;
END $$;

-- Saldo de la línea de crédito al inicio de la semana 1, tomado de v3.
UPDATE public.tresbe_budget_settings s
   SET credit_line_opening_balance = -23015.78
  FROM public.companies c
 WHERE c.id = s.company_id AND c.slug = 'tresbe'
   AND s.credit_line_opening_balance = 0;
