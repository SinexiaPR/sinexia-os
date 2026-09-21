-- TRESBE budget: load real bank movements for 2026-09-18. 09-15 through
-- 09-17 from this same statement are already loaded (PRs #74/#75) and
-- verified to match exactly -- nothing new to insert for those dates.
--
-- Deliberately NOT loaded this batch (flagged for Maria/Mario, see PR
-- description): DoorDash $56.23 (no confirmed category yet), Google
-- YouTubePremium $15.99 and Google G1SK003M $10.88 (could be personal,
-- not confirmed as business), "IN PROCESS OTHER TRANSACTIONS" $2,249.75
-- (no breakdown), Cheque #13101 $375.30 and #16087 $265.27 (unknown
-- series/payee), Cheque #20718 $366.74 and #20683 $600.00 (20xxx series,
-- payee/category unconfirmed -- #20683's same-day reversal pair is not
-- loaded either, pending that confirmation), and the two 09-21 "IN
-- PROCESS" retries of #15096/#20683 (no confirmed settlement date yet).
--
-- Cheque #15096 bounced and reversed same-day (CHEQUE DEVUELTO SF): both
-- legs loaded as a pair, same convention as PR #70/#72 -- Total Egresos
-- already nets these correctly per the PR #73 fix, so no adjustment
-- needed. Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_util uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_ajustes uuid := '94dce0da-c032-4fa8-bf22-630181232590';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, x.week_start, x.direction, x.category_id, x.concept, x.counterparty, x.amount, x.account, null, x.note
  from (
    values
      ('2026-09-18'::date, '2026-09-14'::date, 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 792.96, 'Banco Popular', null::text),
      ('2026-09-18'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Cheque #15095', 126.03, 'Banco Popular', null),
      ('2026-09-18'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Cheque #15091', 82.75, 'Banco Popular', null),
      ('2026-09-18'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 7.59, 'Banco Popular', null),
      ('2026-09-18'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Cheque #15096', 304.52, 'Banco Popular', null),
      ('2026-09-18'::date, '2026-09-14'::date, 'ingreso', v_ajustes, 'Cheque Devuelto SF', 'Cheque #15096', 304.52, 'Banco Popular', 'Cheque devuelto el mismo dia')
  ) as x(entry_date, week_start, direction, category_id, concept, counterparty, amount, account, note)
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
