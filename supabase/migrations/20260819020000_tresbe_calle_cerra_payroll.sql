-- Café con Ce Calle Cerra is a related but separate business (own Clover,
-- hours by WhatsApp) that does not go through tresbe_payroll_entries. Maria
-- enters its weekly payroll cost by hand, same as the existing manual sales
-- columns on this table. Already applied directly to production; this file
-- tracks it in the repo.
ALTER TABLE public.tresbe_payrolls
  ADD COLUMN IF NOT EXISTS calle_cerra_nomina_sin_propina NUMERIC,
  ADD COLUMN IF NOT EXISTS calle_cerra_tips NUMERIC;
