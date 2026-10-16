-- El Export banco (Deposit Accounts Activity Summary) ya tenía columnas
-- Reference y Additional Reference dibujadas en el PDF, pero siempre
-- quedaban en blanco porque el dato nunca se guardaba -- y la
-- descripción se reescribía con un texto simplificado (p.ej. "CHECK
-- PAID 1054") en vez del texto original del banco (p.ej. "CHECK PAID
-- DDA CHECK", con "1054" en Reference). Se agregan las dos columnas
-- para que el parser/la carga manual pueda conservarlas tal cual.
alter table public.cutmeat_daily_bank_movements
  add column if not exists reference text,
  add column if not exists additional_reference text;
