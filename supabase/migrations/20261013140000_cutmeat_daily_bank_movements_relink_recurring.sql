-- cutmeat_daily_bank_movements.linked_recurring_id apuntaba por FK a
-- cutmeat_daily_recurring_payments, la tabla vieja de recurrentes que
-- "Informes diarios" dejó de usar desde la Fase 1 (ver
-- docs/CUTMEAT_DAILY_DATA_CONTRACT.md). La fuente única de recurrentes
-- es cutmeat_recurrentes: BankTab ya ofrece para vincular los
-- recurrentes que trae getRecurringPayments() (que lee
-- cutmeat_recurrentes), así que cualquier intento real de vincular un
-- movimiento a un recurrente fallaba contra este FK viejo.
--
-- Repunta el FK a cutmeat_recurrentes(id) ON DELETE SET NULL, sin tocar
-- datos: cutmeat_daily_recurring_payments tiene 0 filas, así que no hay
-- nada que migrar. Por las dudas -- si algún vínculo quedó apuntando a
-- un id que ya no existe en cutmeat_recurrentes -- se desvincula (se
-- pone en NULL) antes de agregar el nuevo FK; eso nunca borra el
-- movimiento del banco, solo el vínculo roto.

UPDATE public.cutmeat_daily_bank_movements m
SET linked_recurring_id = NULL
WHERE m.linked_recurring_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cutmeat_recurrentes r WHERE r.id = m.linked_recurring_id
  );

ALTER TABLE public.cutmeat_daily_bank_movements
  DROP CONSTRAINT IF EXISTS cutmeat_daily_bank_movements_linked_recurring_fkey;

ALTER TABLE public.cutmeat_daily_bank_movements
  ADD CONSTRAINT cutmeat_daily_bank_movements_linked_recurring_fkey
  FOREIGN KEY (linked_recurring_id)
  REFERENCES public.cutmeat_recurrentes(id) ON DELETE SET NULL;
