-- El Reconciliation Report real de QuickBooks no es un solo corte: tiene
-- un "Beginning balance", transacciones "Cleared" que lo llevan al
-- "Statement ending balance", una lista de "Uncleared ... as of
-- [fecha de la última conciliación bancaria]" que lleva al "Register
-- balance as of [esa fecha]", y -- cuando el informe diario es de un día
-- POSTERIOR a esa conciliación (p.ej. el 10/12, con la última
-- conciliación de FIRST BANK todavía fechada 10/09) -- una lista
-- adicional de "Uncleared ... after [esa fecha]" que lleva al Register
-- balance de HOY. as_of_date es esa fecha de conciliación -- NO
-- necesariamente report_date (que puede ser varios días después, como
-- el 10/12 reconciliando contra el statement del 10/09). tranche marca a
-- qué tramo pertenece cada línea de cutmeat_daily_reconciliation_items.
-- No se backfillea ningún informe cerrado -- as_of_date/tranche quedan
-- NULL en filas ya cargadas (p.ej. el 09/10 cerrado), que no se tocan.
alter table public.cutmeat_daily_reconciliation
  add column if not exists as_of_date date,
  add column if not exists beginning_balance numeric(14, 2);

alter table public.cutmeat_daily_reconciliation_items
  drop constraint if exists cutmeat_daily_reconciliation_items_item_type_check;

alter table public.cutmeat_daily_reconciliation_items
  add constraint cutmeat_daily_reconciliation_items_item_type_check
    check (item_type in ('uncleared_check', 'uncleared_deposit', 'cleared_check', 'cleared_deposit'));

alter table public.cutmeat_daily_reconciliation_items
  add column if not exists tranche text check (tranche in ('as_of', 'after')),
  add column if not exists txn_date date;
