-- Covering indexes for foreign keys flagged by the Supabase performance
-- advisor after the leave accrual tables were created.

CREATE INDEX IF NOT EXISTS employee_leave_balances_company_id_idx
  ON public.employee_leave_balances(company_id);
CREATE INDEX IF NOT EXISTS employee_leave_history_company_id_idx
  ON public.employee_leave_history(company_id);
CREATE INDEX IF NOT EXISTS employee_leave_ledger_entries_company_id_idx
  ON public.employee_leave_ledger_entries(company_id);
CREATE INDEX IF NOT EXISTS employee_leave_ledger_entries_sibarita_employee_id_idx
  ON public.employee_leave_ledger_entries(sibarita_employee_id);
CREATE INDEX IF NOT EXISTS employee_leave_ledger_entries_tresbe_employee_id_idx
  ON public.employee_leave_ledger_entries(tresbe_employee_id);
