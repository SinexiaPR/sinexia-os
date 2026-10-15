-- Un egreso del Export banco puede ser la misma transacción real que ya
-- aparece conciliada como "cleared check" en el Reconciliation Report
-- (p.ej. un ACH/Expense ya liquidado) -- no es un recurrente ni un
-- depósito, así que no necesita "linked_recurring_id" ni
-- "is_not_entered_deposit" para no quedar como "movimiento sin
-- clasificar" en checkDailyReportCompleteness (ver classifyBankMovements
-- en src/lib/cutmeat-daily/calculations.ts).
alter table public.cutmeat_daily_bank_movements
  add column if not exists is_reconciled_cleared boolean not null default false;
