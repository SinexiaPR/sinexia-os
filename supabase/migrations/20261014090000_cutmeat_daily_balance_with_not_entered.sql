-- Balance GABRIEL del día siguiente debe partir del balance final de un
-- día cerrado -- "Balance after Weekly Payments + Not entered Sales" --
-- no solo de "Balance after Weekly Payments" (balance_after_weekly), que
-- no incluye los depósitos del día todavía no ingresados en QuickBooks
-- (p.ej. Costco). Mismo patrón que balance_after_weekly/balance_gabriel:
-- se congela al cerrar el día (closeDailyReport) y se limpia al reabrir
-- (reopenDailyReport); getPreviousClosedBalance lo usa como base de
-- Balance GABRIEL del día siguiente en vez de balance_after_weekly.
alter table public.cutmeat_daily_reports
  add column if not exists balance_with_not_entered numeric(14, 2);
