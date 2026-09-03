-- Agrega Financiamiento Externo (Aporte/Préstamo/Repago de Dueño) y
-- Transferencia Interna (Depósito Cash a Banco / Retiro Banco a Cash), y el
-- saldo de Cash/Caja en paralelo al de banco -- siguiendo la pestaña nueva
-- "Control Banco y Cash" de TRESBE_Seguimiento_Diario_v4.xlsm.
--
-- Financiamiento Externo se suma a la cuadrícula principal (como Línea de
-- Crédito) y, filtrado a cuenta = Banco Popular, entra al puente de caja.
-- Transferencia Interna no es venta ni gasto -- no aparece en la cuadrícula
-- principal -- pero mueve el saldo de banco y de cash en sentidos opuestos.

ALTER TABLE public.tresbe_budget_categories
  DROP CONSTRAINT tresbe_budget_categories_kind_check,
  ADD CONSTRAINT tresbe_budget_categories_kind_check
    CHECK (kind = ANY (ARRAY[
      'ingreso', 'egreso', 'financiamiento', 'intercompany',
      'financiamiento_externo', 'transferencia_interna'
    ]));

ALTER TABLE public.tresbe_budget_categories
  DROP CONSTRAINT tresbe_budget_categories_group_check,
  ADD CONSTRAINT tresbe_budget_categories_group_check
    CHECK (total_group = ANY (ARRAY[
      'ingresos', 'proveedores_compras', 'nomina', 'payroll_taxes',
      'debitos_bancarios', 'intercompany', 'financiamiento',
      'financiamiento_externo', 'transferencia_interna'
    ]));

ALTER TABLE public.tresbe_budget_categories
  DROP CONSTRAINT tresbe_budget_categories_group_kind_check,
  ADD CONSTRAINT tresbe_budget_categories_group_kind_check
    CHECK (
      ((kind = 'financiamiento') AND (total_group = 'financiamiento'))
      OR ((kind = 'intercompany') AND (total_group = 'intercompany'))
      OR ((kind = 'ingreso') AND (total_group = 'ingresos'))
      OR ((kind = 'egreso') AND (total_group = ANY (ARRAY[
            'proveedores_compras', 'nomina', 'payroll_taxes', 'debitos_bancarios'
          ])))
      OR ((kind = 'financiamiento_externo') AND (total_group = 'financiamiento_externo'))
      OR ((kind = 'transferencia_interna') AND (total_group = 'transferencia_interna'))
    );

ALTER TABLE public.tresbe_budget_categories
  DROP CONSTRAINT tresbe_budget_categories_flow_required_check,
  ADD CONSTRAINT tresbe_budget_categories_flow_required_check
    CHECK (
      ((kind = ANY (ARRAY['financiamiento', 'intercompany', 'financiamiento_externo', 'transferencia_interna'])) AND (flow IS NOT NULL))
      OR ((kind = ANY (ARRAY['ingreso', 'egreso'])) AND (flow IS NULL))
    );

DO $$
DECLARE
  v_company UUID;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE slug = 'tresbe';
  IF v_company IS NULL THEN RETURN; END IF;

  INSERT INTO public.tresbe_budget_categories (
    company_id, code, name, kind, total_group, is_financing, flow, sort_order
  )
  VALUES
    (v_company, 'aporte_dueno', 'Aporte de Dueño', 'financiamiento_externo', 'financiamiento_externo', false, 'entrada', 95),
    (v_company, 'prestamo_dueno', 'Préstamo de Dueño', 'financiamiento_externo', 'financiamiento_externo', false, 'entrada', 96),
    (v_company, 'repago_dueno', 'Repago a Dueño', 'financiamiento_externo', 'financiamiento_externo', false, 'salida', 97),
    (v_company, 'deposito_cash_banco', 'Depósito Cash a Banco', 'transferencia_interna', 'transferencia_interna', false, 'entrada', 98),
    (v_company, 'retiro_banco_cash', 'Retiro Banco a Cash', 'transferencia_interna', 'transferencia_interna', false, 'salida', 99)
  ON CONFLICT (company_id, code) DO NOTHING;
END $$;

ALTER TABLE public.tresbe_budget_cash_control
  ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cash_balance NUMERIC(12,2);
