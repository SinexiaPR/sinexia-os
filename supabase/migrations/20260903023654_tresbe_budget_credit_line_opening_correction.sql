-- TRESBE budget: correct the credit line opening balance.
--
-- Seguimiento Diario's "Saldo Inicial Línea de Crédito" for week 2 is a
-- manually typed anchor (-22963.33, confirmed a literal cell, not a
-- formula) -- the same kind of reconciliation anchor as
-- credit_line_opening_balance itself. Week 1's Utilización/Repago
-- movements already match Sinexia OS exactly ($10,467.60 / $10,520.05,
-- verified against "Movimientos Reales"), so the $104.90 gap was entirely
-- in the opening anchor: -23015.78 + (10467.60 - 10520.05) = -23068.23,
-- not the sheet's -22963.33. Solving backwards from her anchor gives the
-- corrected opening balance below.
update tresbe_budget_settings
set credit_line_opening_balance = -22910.88
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
