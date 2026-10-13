-- Retira cutmeat_daily_recurring_payments y su historial
-- (cutmeat_daily_recurring_payment_history): quedaron duplicadas desde
-- que "Informes diarios" pasó a leer y escribir recurrentes solo en
-- cutmeat_recurrentes (Fase 1). Confirmado antes de esta migración que
-- nada más las referencia:
--   - Ningún componente ni servicio las lee (RecurringTab y BankTab usan
--     cutmeat_recurrentes vía getRecurringPayments()).
--   - Las únicas escrituras que quedaban eran las acciones @deprecated
--     saveRecurringPayment/deleteRecurringPayment, sin ningún caller en
--     la UI; se eliminan en el mismo cambio que esta migración.
--   - cutmeat_daily_controls() (la versión vigente, redefinida en
--     20261013131000_cutmeat_daily_calc_fixes.sql) ya no las consulta.
--   - cutmeat_daily_bank_movements.linked_recurring_id ya no depende de
--     ellas: su FK se repuntó a cutmeat_recurrentes en la migración
--     anterior (20261013140000).
--   - Ninguna vista, policy de otra tabla ni objeto de storage las
--     referencia.
-- Ambas tablas tienen 0 filas, así que no hay datos que perder.

DROP TABLE IF EXISTS public.cutmeat_daily_recurring_payment_history;
DROP TABLE IF EXISTS public.cutmeat_daily_recurring_payments;
