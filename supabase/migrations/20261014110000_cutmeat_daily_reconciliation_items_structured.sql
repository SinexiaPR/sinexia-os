-- El Reconciliation Report real de QuickBooks lista cada partida con
-- DATE | TYPE | REF NO. | PAYEE | AMOUNT (USD) -- 4 columnas, no solo
-- una "reference" de texto libre. txn_date ya existía (migración
-- 20261014100000); se agregan las 3 que faltan para la réplica exacta.
alter table public.cutmeat_daily_reconciliation_items
  add column if not exists txn_type text,
  add column if not exists ref_no text,
  add column if not exists payee text;
