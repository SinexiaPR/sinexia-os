-- Carga de los recurrentes de octubre 2026 de Cut Meat Distributors, tal
-- como estaban al cierre del 10/09 (último día cerrado a esa fecha). No se
-- marca nada como pagado más allá de lo que ya constaba en el Sheet a esa
-- fecha -- los pagos del 10/09 al 10/12 se confirman aparte con el estado
-- bancario y QuickBooks del 12/10 (ver "pendingToConfirm" en
-- src/lib/cutmeat-recurrentes/calculations.ts).
--
-- Notas de interpretación (para revisar contra el Sheet original):
--   - "ACH-<num> <banco/contraparte>" se separó en tr_type='ACH' y
--     num='<num> <banco/contraparte>' (ítems 4, 6 y 7).
--   - Los ítems 6 (PenFed) y 13 (SINERGIA LLC) estaban marcados PAGADO sin
--     un monto real distinto informado -- se cargó paid_amount = amount
--     (sin variación) en vez de dejarlo null.
--   - El ítem 13 (SINERGIA LLC) no tenía fecha de pago informada -- se dejó
--     paid_date en NULL con una nota, en vez de inventar una fecha.
--   - "Departameno de Hacienda" se corrigió a "Departamento de Hacienda"
--     (typo evidente en el nombre de la agencia).
-- Todo esto es editable desde la pantalla si algo no coincide con el Sheet.

INSERT INTO public.cutmeat_recurrentes (
  company_id, period, fecha, tr_type, num, vendor, due_date, amount,
  pagado, paid_date, paid_amount, notes
)
SELECT c.id, '2026-10-01'::date, v.fecha, v.tr_type, v.num, v.vendor, v.due_date,
       v.amount, v.pagado, v.paid_date, v.paid_amount, v.notes
FROM public.companies c
JOIN (
  VALUES
    ('2026-09-03'::date, 'Bill', NULL::text, 'Caparra Country - Gabriel Manzanares', '2026-09-03'::date, 692.00, false, NULL::date, NULL::numeric, NULL::text),
    (NULL, NULL, NULL, 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL),
    (NULL, NULL, NULL, 'Liberty Movil', NULL, 284.39, true, '2026-10-08'::date, 257.11, 'Pagado confirmado por banco el 10/08; diferencia +27.28 vs. monto recurrente.'),
    ('2026-10-01', 'ACH', '1755670185 Scotiabank', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', 500.00, 'Pagado por ACH el 10/09; diferencia -150.00 vs. monto recurrente.'),
    ('2026-10-01', 'Bill', NULL, 'Juan Diaz', '2026-10-01', 150.00, false, NULL, NULL, NULL),
    ('2026-10-01', 'ACH', '724492-5025 PenFed', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', 800.00, 'Marcado pagado desde el 10/05 sin monto real distinto informado.'),
    ('2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, false, NULL, NULL, NULL),
    ('2026-10-01', 'Bill', NULL, 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, NULL, NULL),
    ('2026-10-02', 'Bill', NULL, 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, NULL, NULL),
    ('2026-10-08', 'Bill', NULL, 'NOMINA', '2026-10-08', 400.00, false, NULL, NULL, NULL),
    ('2026-09-30', 'Bill', '"SS Med Jul-26"', 'Internal Revenue Service', '2026-10-09', 600.00, false, NULL, NULL, NULL),
    ('2026-09-30', 'Bill', '"Ret Jul-2026"', 'Departamento de Hacienda', '2026-10-09', 180.00, false, NULL, NULL, NULL),
    ('2026-10-09', 'Bill', NULL, 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, 180.00, 'PAGADO sin fecha de pago bancario informada en el Sheet -- confirmar paid_date.'),
    (NULL, NULL, NULL, 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL),
    ('2026-10-15', 'Bill', NULL, 'NOMINA', '2026-10-15', 400.00, false, NULL, NULL, NULL),
    ('2026-10-16', 'Bill', NULL, 'SINERGIA LLC', '2026-10-16', 180.00, false, NULL, NULL, NULL)
) AS v(fecha, tr_type, num, vendor, due_date, amount, pagado, paid_date, paid_amount, notes) ON true
WHERE c.slug = 'cut-meat-distributors'
  AND NOT EXISTS (
    SELECT 1 FROM public.cutmeat_recurrentes existing
    WHERE existing.company_id = c.id AND existing.period = '2026-10-01'::date
  );
