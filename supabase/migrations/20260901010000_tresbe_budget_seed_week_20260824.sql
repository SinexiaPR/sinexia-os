-- Semilla de prueba: semana del 24 al 30 de agosto de 2026.
--
-- Sirve para comprobar que el módulo reproduce la planilla original una vez
-- corregidos los dos errores de categorización:
--   · los depósitos Clover pasan de "Cash Disponible" a "Credit Card Disponible";
--   · los barridos "Fondo Transf. Reserva" pasan de "Cash Disponible" /
--     "Débitos Bancarios" a "Movimiento Línea de Reserva" (financiamiento).
--
-- El presupuesto de esta semana se carga tal como estaba pegado en la planilla,
-- marcado como manual para que no se pise al regenerar, con una excepción ya
-- corregida: Payroll Taxes queda en jueves, no en miércoles.

DO $$
DECLARE
  v_company UUID;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE slug = 'tresbe';
  IF v_company IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.tresbe_budget_movements
     WHERE company_id = v_company AND week_start = DATE '2026-08-24'
  ) THEN RETURN; END IF;

  CREATE TEMP TABLE tmp_seed_movements (
    entry_date DATE,
    direction TEXT,
    code TEXT,
    concept TEXT,
    counterparty TEXT,
    amount NUMERIC(12,2)
  ) ON COMMIT DROP;

  INSERT INTO tmp_seed_movements VALUES
    -- lunes 24
    ('2026-08-24', 'ingreso', 'credit_card_disponible', 'Ventas', 'Depósito Clover', 5440.92),
    ('2026-08-24', 'egreso', 'reembolsos_mercaderia', 'Mercadería', 'Cash', 1200.00),
    ('2026-08-24', 'egreso', 'debitos_bancarios', 'Préstamo Banco Popular', 'Préstamo Banco Popular', 553.44),
    ('2026-08-24', 'egreso', 'nomina', 'Nómina', 'Lee de Jesús Sánchez - 15019', 229.35),
    ('2026-08-24', 'egreso', 'proveedores', 'Mercadería', 'Dockside', 702.19),
    ('2026-08-24', 'egreso', 'proveedores', 'Desinfección', 'PHP Pest Control', 275.00),
    ('2026-08-24', 'egreso', 'proveedores', 'Mercadería', 'Taco Bakery Grill', 232.00),
    ('2026-08-24', 'ingreso', 'linea_reserva', 'Reserva', 'Transferencia Reserva', 2248.94),
    -- martes 25
    ('2026-08-25', 'ingreso', 'credit_card_disponible', 'Ventas', 'Depósito Clover', 1910.26),
    ('2026-08-25', 'egreso', 'nomina', 'Nómina', 'Alberto Chaves - 15017', 544.88),
    ('2026-08-25', 'egreso', 'nomina', 'Nómina', 'Valerie Vicente - 20648', 57.75),
    ('2026-08-25', 'egreso', 'reembolsos_mercaderia', 'Mercadería', 'Cash (cheque 20669)', 800.00),
    ('2026-08-25', 'egreso', 'debitos_bancarios', 'Préstamo Banco Popular', 'Préstamo Banco Popular', 344.01),
    ('2026-08-25', 'egreso', 'proveedores', 'Mercadería', 'Ballester', 2037.42),
    ('2026-08-25', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1873.80),
    ('2026-08-25', 'egreso', 'proveedores', 'Mercadería', 'Cosera', 450.00),
    ('2026-08-25', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 450.00),
    ('2026-08-25', 'egreso', 'reembolsos_mercaderia', 'Mercadería', 'Juan C. Berríos Santini', 132.25),
    ('2026-08-25', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 132.25),
    ('2026-08-25', 'egreso', 'proveedores', 'Mercadería', 'Seaworld', 969.47),
    ('2026-08-25', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 969.47),
    -- miércoles 26
    ('2026-08-26', 'ingreso', 'cash_disponible', 'Depósito', 'Depósito Cash', 9000.00),
    ('2026-08-26', 'ingreso', 'credit_card_disponible', 'Ventas', 'Depósito Clover', 1606.42),
    ('2026-08-26', 'egreso', 'nomina', 'Nómina', 'Candelaria Vélez - 15033', 339.79),
    ('2026-08-26', 'egreso', 'nomina', 'Nómina', 'Joel Brauer Cardín - 15034', 853.50),
    ('2026-08-26', 'egreso', 'nomina', 'Nómina', 'Lee Pierre - 15039', 427.02),
    ('2026-08-26', 'egreso', 'nomina', 'Nómina', 'Jesús Alejandro Aguiar - 20675', 465.00),
    ('2026-08-26', 'egreso', 'recurrentes', 'Servicios', 'Sinexia', 250.00),
    ('2026-08-26', 'egreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 8271.11),
    -- jueves 27
    ('2026-08-27', 'ingreso', 'credit_card_disponible', 'Ventas', 'Depósito Clover', 1695.63),
    ('2026-08-27', 'egreso', 'nomina', 'Nómina', 'Fernando Almonte - 15032', 600.28),
    ('2026-08-27', 'egreso', 'nomina', 'Nómina', 'Yohamid Rodríguez - 15046', 317.55),
    ('2026-08-27', 'egreso', 'nomina', 'Nómina', 'Rocío del Mar Sevilla - 15049', 314.43),
    ('2026-08-27', 'egreso', 'nomina', 'Nómina', 'Fernando Almonte - 20674', 280.00),
    ('2026-08-27', 'egreso', 'nomina', 'Nómina', 'Ramón Luis Rivera - 20677', 220.00),
    ('2026-08-27', 'egreso', 'nomina', 'Nómina', 'Yediel - 20678', 396.70),
    ('2026-08-27', 'egreso', 'payroll_taxes', 'Payroll Taxes', 'Payroll taxes', 1149.01),
    ('2026-08-27', 'egreso', 'nomina', 'Payroll Billing', 'Payroll Billing', 179.00),
    ('2026-08-27', 'egreso', 'proveedores', 'Mercadería', 'Samuel Canales Lugo', 71.80),
    ('2026-08-27', 'egreso', 'proveedores', 'Trampa Grasa', 'True Waste', 94.78),
    ('2026-08-27', 'egreso', 'proveedores', 'Mercadería', 'Las Lomas', 265.00),
    ('2026-08-27', 'egreso', 'nomina', 'Nómina', 'Denzel Daniel Hernández', 332.40),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 36.63),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 396.70),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1149.01),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 179.00),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 71.80),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 94.78),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 265.00),
    ('2026-08-27', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 332.40),
    -- viernes 28
    ('2026-08-28', 'ingreso', 'credit_card_disponible', 'Ventas', 'Depósito Clover', 1788.73),
    ('2026-08-28', 'ingreso', 'cash_disponible', 'Ventas', 'DoorDash', 26.88),
    ('2026-08-28', 'egreso', 'nomina', 'Nómina', 'Alberto Chaves - 15036', 544.88),
    ('2026-08-28', 'egreso', 'nomina', 'Nómina', 'Shaddai Sánchez - 15048', 272.53),
    ('2026-08-28', 'egreso', 'nomina', 'Nómina', 'Alfredo Salgado - 20670', 315.00),
    ('2026-08-28', 'egreso', 'nomina', 'Nómina', 'Arnaldo Santiago - 20671', 105.00),
    ('2026-08-28', 'egreso', 'nomina', 'Nómina', 'Carlos Ramos - 20672', 564.64),
    ('2026-08-28', 'egreso', 'nomina', 'Nómina', 'Julián Mateo - 20676', 114.80),
    ('2026-08-28', 'egreso', 'reembolsos_mercaderia', 'Intercompany', 'Intercompany', 4000.00),
    ('2026-08-28', 'egreso', 'nomina', 'Nómina', 'Regino Pizarro - 15044', 415.52),
    ('2026-08-28', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 101.24),
    ('2026-08-28', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 4000.00),
    ('2026-08-28', 'ingreso', 'linea_reserva', 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 415.52);

  INSERT INTO public.tresbe_budget_movements (
    company_id, entry_date, week_start, direction, category_id,
    concept, counterparty, amount, account
  )
  SELECT v_company, s.entry_date, DATE '2026-08-24', s.direction, c.id,
         s.concept, s.counterparty, s.amount, 'Banco Popular'
    FROM tmp_seed_movements s
    JOIN public.tresbe_budget_categories c
      ON c.company_id = v_company AND c.code = s.code;

  -- Presupuesto pegado en la planilla original para esta semana.
  INSERT INTO public.tresbe_budget_entries (
    company_id, entry_date, week_start, category_id, amount, origin, note
  )
  SELECT v_company, b.entry_date, DATE '2026-08-24', c.id, b.amount, 'manual',
         'Importado de la planilla original'
    FROM (VALUES
      (DATE '2026-08-24', 'credit_card_disponible', 2174.57),
      (DATE '2026-08-25', 'credit_card_disponible', 1640.71),
      (DATE '2026-08-27', 'credit_card_disponible', 2249.24),
      (DATE '2026-08-28', 'credit_card_disponible', 1776.88),
      (DATE '2026-08-29', 'credit_card_disponible', 2009.86),
      (DATE '2026-08-30', 'credit_card_disponible', 1050.49),
      (DATE '2026-08-24', 'cash_disponible', 212.65),
      (DATE '2026-08-25', 'cash_disponible', 167.99),
      (DATE '2026-08-26', 'cash_disponible', 190.02),
      (DATE '2026-08-27', 'cash_disponible', 99.32),
      (DATE '2026-08-28', 'cash_disponible', 154.56),
      (DATE '2026-08-29', 'cash_disponible', 173.89),
      (DATE '2026-08-30', 'cash_disponible', 19.63),
      (DATE '2026-08-26', 'nomina', 7857.25),
      -- corregido: la planilla lo pegaba el miércoles.
      (DATE '2026-08-27', 'payroll_taxes', 1776.27),
      (DATE '2026-08-24', 'debitos_bancarios', 553.44),
      (DATE '2026-08-25', 'debitos_bancarios', 1145.19),
      (DATE '2026-08-27', 'debitos_bancarios', 190.00)
    ) AS b(entry_date, code, amount)
    JOIN public.tresbe_budget_categories c
      ON c.company_id = v_company AND c.code = b.code
  ON CONFLICT (company_id, entry_date, category_id) DO NOTHING;

  INSERT INTO public.tresbe_budget_cash_control (company_id, week_start, opening_bank_balance, notes)
  VALUES (v_company, DATE '2026-08-24', 0,
          'Completar saldo bancario inicial, saldo real y caja mínima objetivo.')
  ON CONFLICT (company_id, week_start) DO NOTHING;
END $$;

-- Patrón de ventas derivado del "Forecast Diario 13W": el presupuesto de tarjeta
-- de cada día es la venta con tarjeta de 3 días antes, neta de 1.5% de comisión
-- y 8% de retención de préstamo.
INSERT INTO public.tresbe_budget_sales_pattern (company_id, weekday, gross_sales, card_share)
SELECT c.id, v.weekday, v.gross_sales, v.card_share
  FROM public.companies c
 CROSS JOIN (VALUES
   (1, 2694.71, 0.9211),
   (2, 2128.79, 0.9211),
   (3, 2407.92, 0.9211),
   (4, 1258.55, 0.9211),
   (5, 2554.22, 0.9395),
   (6, 1984.43, 0.9124),
   (7, 19.63, 0.0000)
 ) AS v(weekday, gross_sales, card_share)
 WHERE c.slug = 'tresbe'
ON CONFLICT (company_id, weekday) DO NOTHING;

-- Débitos fijos de la hoja "Débitos Bancarios Fijos/Recurrentes 13W". Solo se
-- activan los tres cuyo importe está confirmado; el resto queda listado e
-- inactivo para completarlo desde la pantalla de supuestos.
INSERT INTO public.tresbe_budget_recurring_debits (
  company_id, concept, classification, category_id, amount,
  frequency, weekday, confidence, is_active, note
)
SELECT c.id, v.concept, v.classification, cat.id, v.amount,
       'semanal', v.weekday, v.confidence, v.is_active, v.note
  FROM public.companies c
  JOIN public.tresbe_budget_categories cat
    ON cat.company_id = c.id AND cat.code = 'debitos_bancarios'
 CROSS JOIN (VALUES
   ('Préstamo Banco Popular x9001', 'Préstamo', 553.44, 1, 'alta', true, NULL),
   ('AAA', 'Servicio', 1145.19, 2, 'alta', true, NULL),
   ('Payroll Billing', 'Nómina', 190.00, 4, 'alta', true, NULL),
   ('AEE', 'Servicio', 0.00, 3, 'media', false, 'Falta importe proyectado'),
   ('Planet Home ACH', 'Préstamo', 0.00, 1, 'media', false, 'Falta importe proyectado'),
   ('Speed Fiber 1', 'Servicio', 0.00, 2, 'media', false, 'Falta importe proyectado'),
   ('Speed Fiber 2', 'Servicio', 0.00, 2, 'media', false, 'Falta importe proyectado'),
   ('Speed Fiber 3', 'Servicio', 0.00, 2, 'media', false, 'Falta importe proyectado'),
   ('Mi Contable Online', 'Servicio', 0.00, 3, 'media', false, 'Falta importe proyectado'),
   ('Revisar', 'Sin clasificar', 0.00, 5, 'baja', false, 'Ítem marcado "Revisar" en la planilla original')
 ) AS v(concept, classification, amount, weekday, confidence, is_active, note)
 WHERE c.slug = 'tresbe'
   AND NOT EXISTS (
     SELECT 1 FROM public.tresbe_budget_recurring_debits d
      WHERE d.company_id = c.id AND d.concept = v.concept
   );
