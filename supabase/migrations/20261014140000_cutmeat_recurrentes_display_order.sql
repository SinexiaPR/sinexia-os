-- El orden de filas de "A/P Aging Detail Recurrentes" en la planilla de
-- Hernan no se puede derivar de due_date/fecha (varias filas comparten
-- la misma fecha en un orden específico, p.ej. "Juan Diaz" antes de
-- "Deposito - Jose Manzanares" antes de "Caparra", todas con
-- due_date=10/01) -- display_order fija ese orden explícitamente, en
-- vez de depender de un tie-break implícito e indocumentado.
alter table public.cutmeat_recurrentes
  add column if not exists display_order integer;
