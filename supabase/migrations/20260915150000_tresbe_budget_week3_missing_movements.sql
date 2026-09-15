-- TRESBE budget: add 6 real movements for Semana 3 (09/07-09/13) that were
-- missing from tresbe_budget_movements versus the Modelo Maestro, found by
-- comparing week 3 totals 1:1 against the sheet. Purely additive -- no
-- existing row, category, or formula is touched. Idempotent per row (not
-- per day), since 09-08 and 09-11 already carry other, unrelated
-- movements loaded in prior migrations.
--
-- Five are Cash / Caja sales (cash_disponible) across 09-08, 09-11, 09-12
-- and 09-13 -- a different account than Banco Popular, so these cannot
-- affect the reserve credit line balance at all.
--
-- The sixth is a Recurrentes (Speed Fiber) expense on 09-08, Banco
-- Popular account, $569.91. tresbe_budget_credit_line_status computes
-- saldo_linea_credito purely from the explicit Utilizacion/Repago Linea
-- de Credito movements (the bank's own recorded sweeps), not from netting
-- operating ingreso/egreso rows -- so this addition, having no paired
-- Utilizacion/Repago entry in the Modelo Maestro for that date, does not
-- change the already-validated credit line balances either. Confirmed
-- after applying: week 3 and week 4 tresbe_budget_credit_line_status are
-- byte-for-byte unchanged from before this migration.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
  v_recurrentes uuid := '01739a70-5fba-4001-81d4-17b1d0bc7cab';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, x.week_start, x.direction, x.category_id, x.concept, x.counterparty, x.amount, x.account, null, null
  from (
    values
      ('2026-09-08'::date, '2026-09-07'::date, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', 131.45, 'Cash / Caja'),
      ('2026-09-08'::date, '2026-09-07'::date, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', 67.38, 'Cash / Caja'),
      ('2026-09-08'::date, '2026-09-07'::date, 'egreso', v_recurrentes, 'Internet', 'Speed Fiber', 569.91, 'Banco Popular'),
      ('2026-09-11'::date, '2026-09-07'::date, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', 96.03, 'Cash / Caja'),
      ('2026-09-12'::date, '2026-09-07'::date, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', 272.80, 'Cash / Caja'),
      ('2026-09-13'::date, '2026-09-07'::date, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', 84.64, 'Cash / Caja')
  ) as x(entry_date, week_start, direction, category_id, concept, counterparty, amount, account)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = x.entry_date
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = x.account
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
