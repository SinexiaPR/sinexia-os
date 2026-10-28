-- Índices en claves foráneas (company_id / employee_id / category_id) que el
-- advisor de rendimiento marca como "unindexed_foreign_keys" y que se usan en
-- filtros por empresa (RLS) y por empleado. Alcance acordado (Fase 7):
--   · no se tocan columnas created_by / updated_by
--   · no se borran índices sin uso
-- Las tablas son chicas, por eso CREATE INDEX normal (las migraciones corren en
-- transacción y no admiten CONCURRENTLY).

CREATE INDEX IF NOT EXISTS tresbe_budget_entry_revisions_company_idx
  ON public.tresbe_budget_entry_revisions (company_id);

CREATE INDEX IF NOT EXISTS tresbe_payroll_daily_entries_company_idx
  ON public.tresbe_payroll_daily_entries (company_id);

-- Ya existe tresbe_payroll_daily_entries_employee_idx, pero es (payroll_id, employee_id)
-- y no sirve para filtrar solo por empleado; por eso este lleva otro nombre.
CREATE INDEX IF NOT EXISTS tresbe_payroll_daily_entries_employee_id_idx
  ON public.tresbe_payroll_daily_entries (employee_id);

CREATE INDEX IF NOT EXISTS tresbe_payroll_shift_pools_company_idx
  ON public.tresbe_payroll_shift_pools (company_id);

CREATE INDEX IF NOT EXISTS tresbe_budget_closed_days_category_idx
  ON public.tresbe_budget_closed_days (category_id);
