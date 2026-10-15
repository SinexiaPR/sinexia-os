-- El Export banco (Deposit Accounts Activity Summary) real del banco
-- lista cada movimiento con su Post Date y el Calculated Balance que
-- queda después de esa transacción -- columnas propias del export, no
-- del flujo de "Not entered Sales" (is_not_entered_deposit) que ya
-- tenía esta tabla.
alter table public.cutmeat_daily_bank_movements
  add column if not exists post_date date,
  add column if not exists calculated_balance numeric(14, 2);
