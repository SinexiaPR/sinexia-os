-- Weekly sales figures shown above each Tresbe payroll: main Tresbe location,
-- Cafe con Ce, and Cafe con Ce's separate Calle Cerra branch (tracked apart
-- since its hours/tips already get folded into the main payroll but its
-- sales are a distinct number Maria wants to see on its own).

ALTER TABLE public.tresbe_payrolls
  ADD COLUMN IF NOT EXISTS sales_tresbe NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sales_tresbe >= 0),
  ADD COLUMN IF NOT EXISTS sales_cafe_con_ce NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sales_cafe_con_ce >= 0),
  ADD COLUMN IF NOT EXISTS sales_cafe_con_ce_calle_cerra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sales_cafe_con_ce_calle_cerra >= 0);
