-- "Reconciled on" / "Register balance as of" del Reconciliation Report
-- tiene que ser la fecha en que se hizo la conciliación en QuickBooks
-- (dato de entrada del día), no la fecha en que se cargó/regeneró el
-- dato en Sinexia OS -- loaded_at cambia cada vez que se re-guarda la
-- conciliación (p.ej. al regenerar el paquete), por eso el PDF mostraba
-- la fecha de HOY en vez del 10/13 real.
alter table public.cutmeat_daily_reconciliation
  add column if not exists reconciled_on date;

comment on column public.cutmeat_daily_reconciliation.reconciled_on is
  'Fecha en que se hizo la conciliación en QuickBooks ("Reconciled on" / "Register balance as of" del Reconciliation Report) -- dato de entrada manual, nunca new Date()/loaded_at.';
