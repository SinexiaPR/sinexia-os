-- Retira cutmeat_daily_recurring_payments y su historial
-- (cutmeat_daily_recurring_payment_history): quedaron duplicadas desde
-- que "Informes diarios" pasó a leer y escribir recurrentes solo en
-- cutmeat_recurrentes (Fase 1). Confirmado antes de esta migración que
-- nada más las referencia:
--   - Ningún componente ni servicio las lee (RecurringTab y BankTab usan
--     cutmeat_recurrentes vía getRecurringPayments()).
--   - Las únicas escrituras que quedaban eran las acciones @deprecated
--     saveRecurringPayment/deleteRecurringPayment, sin ningún caller en
--     la UI; se eliminaron en el mismo cambio que esta migración.
--   - cutmeat_daily_controls() (la versión vigente, redefinida en
--     20261013131000_cutmeat_daily_calc_fixes.sql) ya no las consulta.
--   - cutmeat_daily_bank_movements.linked_recurring_id ya no depende de
--     ellas: su FK se repuntó a cutmeat_recurrentes en
--     20261013114120_cutmeat_daily_bank_movements_relink_recurring.sql.
--   - Ninguna vista, policy de otra tabla ni objeto de storage las
--     referencia.
-- Ambas tablas tienen 0 filas, así que no hay datos que perder.
--
-- Nota: esto renombra las tablas en vez de hacer DROP TABLE. El DROP
-- directo contra el proyecto real se probó repetidas veces (con y sin
-- CASCADE, con y sin DO block, sobre estas tablas y sobre una tabla de
-- prueba descartable) y siempre se quedó colgado hasta el timeout del
-- conector, sin ningún lock ni actividad bloqueante del lado de
-- Postgres (confirmado con pg_stat_activity/pg_locks) -- mientras que
-- ALTER TABLE ... RENAME funciona con normalidad. El resultado práctico
-- es el mismo que pedía la tarea: las tablas viejas quedan fuera del
-- camino, bajo un nombre que deja claro que están retiradas, sin romper
-- sus FK ni sus policies (Postgres las seguye por OID, no por nombre).
-- Si en algún momento el DROP deja de colgarse, se puede borrar esta
-- tabla con un DROP TABLE normal -- están vacías.

ALTER TABLE public.cutmeat_daily_recurring_payment_history
  RENAME TO cutmeat_daily_recurring_payment_history_retired_20261013;

ALTER TABLE public.cutmeat_daily_recurring_payments
  RENAME TO cutmeat_daily_recurring_payments_retired_20261013;
