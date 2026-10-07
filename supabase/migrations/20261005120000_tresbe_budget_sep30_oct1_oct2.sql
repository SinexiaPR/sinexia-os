-- TRESBE budget: complete the pending Sep 30 close-out (Clover cash,
-- cash-free day, and the 5 end-of-month bank charges) and load Oct 1-2
-- bank movements (week 6, week_start = 2026-09-28). Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_utilizacion uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
  v_ajustes uuid := '94dce0da-c032-4fa8-bf22-630181232590';
  v_recurrentes uuid := '01739a70-5fba-4001-81d4-17b1d0bc7cab';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date::date, '2026-09-28'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      -- Paso 1: cash del 28-sep (Clover)
      ('2026-09-28', 'ingreso', v_cash, 'Ventas', 'Ventas Cash', 10.68, null::text),

      -- Paso 3: cargos bancarios de fin de mes, 30-sep (cada cargo + su
      -- contrapartida en Utilizacion de Linea de Credito)
      ('2026-09-30', 'egreso', v_debitos, 'Intereses Fondo Reserva', 'Intereses Fondo Reserva', 292.80, null),
      ('2026-09-30', 'ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 292.80, null),
      ('2026-09-30', 'egreso', v_debitos, 'Cargos por servicio', 'Cargo por servicio', 10.00, null),
      ('2026-09-30', 'ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 10.00, null),
      ('2026-09-30', 'egreso', v_debitos, 'Cargo por exceso de 030', 'Banco Popular', 31.00, null),
      ('2026-09-30', 'ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 31.00, null),
      ('2026-09-30', 'egreso', v_debitos, 'Cargo Ivu estatal', 'Cargo Ivu estatal', 4.31, null),
      ('2026-09-30', 'ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 4.31, null),
      ('2026-09-30', 'egreso', v_debitos, 'Cargo Ivu Municipal', 'Cargo Ivu Municipal', 0.41, null),
      ('2026-09-30', 'ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 0.41, null),

      -- Paso 4a: ingreso por tarjeta 01-oct
      ('2026-10-01', 'ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 61.46, null),

      -- Paso 4b: Planet Home, intentado y devuelto por fondos insuficientes
      ('2026-10-01', 'egreso', v_debitos, 'Planet Home ACH -4609', 'Planet Home ACH -4609', 2149.11, null),
      ('2026-10-01', 'ingreso', v_ajustes, 'EFT PAYMENT DEVUELTO SF', 'Planet Home ACH -4609', 2149.11, 'Reverso/devolucion del pago a Planet Home del 10/01 por fondos insuficientes (mismo monto que el ACH mensual que si proceso el 09/01)'),

      -- Paso 4c: Internet (Speed Fiber), dos cargos cubiertos por la linea
      ('2026-10-01', 'egreso', v_recurrentes, 'Internet', 'Speed Fiber', 169.97, null),
      ('2026-10-01', 'ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 108.51, null),
      ('2026-10-01', 'egreso', v_recurrentes, 'Internet', 'Speed Fiber', 569.91, null),
      ('2026-10-01', 'ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 569.91, null),

      -- Paso 4d: cargo de tarjeta (Bankcard), intentado y devuelto el mismo dia
      ('2026-10-01', 'egreso', v_debitos, 'EFT PMT BANKCARD-1572 MTOT DISC XXXXXXXXXXXX1761', 'EFT PMT BANKCARD-1572 MTOT DISC XXXXXXXXXXXX1761', 54.95, null),
      ('2026-10-01', 'ingreso', v_ajustes, 'EFT PAYMENT DEVUELTO SF', 'EFT PMT BANKCARD-1572 MTOT DISC XXXXXXXXXXXX1761', 54.95, 'Reverso/devolucion del cargo de Bankcard del 10/01; se reintento y proceso el 10/02 (ver Debitos Bancarios 54.95 del 10/02)'),

      -- Paso 5: 02-oct
      ('2026-10-02', 'egreso', v_debitos, 'EFT PMT BANKCARD-1572 XXXXXXXXXXXX1761', 'EFT PMT BANKCARD-1572 XXXXXXXXXXXX1761', 54.95, null),
      ('2026-10-02', 'ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 97.07, null),
      ('2026-10-02', 'egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 42.12, null)
  ) as x(entry_date, direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = x.entry_date::date
      and m.category_id = x.category_id
      and m.direction = x.direction
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );

  -- Paso 2: cash del 30-sep es $0 real (negocio abierto, solo tarjeta ese
  -- dia). movements.amount exige > 0, asi que sigue el mismo patron que
  -- el cierre del 29-sep: va a tresbe_budget_closed_days, no como
  -- movimiento de $0.
  insert into tresbe_budget_closed_days (company_id, entry_date, category_id, note)
  values (
    v_company_id,
    '2026-09-30',
    v_cash,
    'Negocio abierto, ventas solo con tarjeta ese dia (cash $0)'
  )
  on conflict (company_id, entry_date, category_id) do nothing;
end $$;
