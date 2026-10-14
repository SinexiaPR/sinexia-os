-- Campos propios del Export banco real (Deposit Accounts Activity
-- Summary) que no cambian con la conciliación: el rango de fechas que
-- cubre el archivo (puede ser anterior a report_date, igual que el
-- Reconciliation Report), el nombre de la cuenta y el "Available"
-- balance del banco (distinto del Closing/closing_balance -- el banco
-- puede tener holds/pendientes que closing_balance no refleja).
alter table public.cutmeat_daily_bank_export
  add column if not exists date_range date,
  add column if not exists account_label text,
  add column if not exists available_balance numeric(14, 2);
