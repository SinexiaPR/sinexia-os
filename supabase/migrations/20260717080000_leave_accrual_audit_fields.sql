-- Audit/traceability fields requested for legal-compliance review (Ley
-- 180-1998, según enmendada por Ley 4-2017): every monthly accrual row
-- should record which hiring date and which payroll(s) produced it, and how
-- many times it has been recomputed, without changing the existing
-- full-replay design (still fully derived, still safe to recompute any
-- number of times).

ALTER TABLE public.employee_leave_history
  ADD COLUMN IF NOT EXISTS calculation_version INTEGER NOT NULL DEFAULT 1
    CHECK (calculation_version >= 1),
  ADD COLUMN IF NOT EXISTS hiring_date_used DATE,
  ADD COLUMN IF NOT EXISTS source_payroll_ids UUID[] NOT NULL DEFAULT '{}';

-- Lets a monthly history row point back at the specific payroll(s) whose
-- entries fed it, in addition to the existing per-entry ledger rows
-- (employee_leave_ledger_entries already links to individual entries via
-- sibarita_entry_id/tresbe_entry_id; these new columns let the ledger also
-- carry the parent payroll id directly, so replayAndPersistBalance can
-- group by month without an extra join back through the payroll_entries
-- tables).
ALTER TABLE public.employee_leave_ledger_entries
  ADD COLUMN IF NOT EXISTS sibarita_payroll_id UUID REFERENCES public.weekly_payrolls(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tresbe_payroll_id UUID REFERENCES public.tresbe_payrolls(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS employee_leave_ledger_entries_sibarita_payroll_id_idx
  ON public.employee_leave_ledger_entries(sibarita_payroll_id);
CREATE INDEX IF NOT EXISTS employee_leave_ledger_entries_tresbe_payroll_id_idx
  ON public.employee_leave_ledger_entries(tresbe_payroll_id);
