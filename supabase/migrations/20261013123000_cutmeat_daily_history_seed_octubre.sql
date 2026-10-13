-- Backfill de los 7 días de octubre 2026 (10/01 al 10/09) de Cut Meat
-- Distributors, desde los PDF originales en Drive (carpeta "Octubre",
-- id 1z2y7paYg8K-fSNYkO80Tr74mnbaCDbu- -- se guarda la referencia, no se
-- copian los archivos). balance_gabriel de cada día = balance_after_weekly
-- del día anterior (regla confirmada); el 10/01 no tiene día anterior en
-- esta tabla, así que se usa el valor del PDF (27,224.20) como excepción.
-- uncleared_deposits_after no está en los PDF de ningún día de esta
-- semana -- se completa en 0 porque la ecuación de control ya cierra sin
-- necesitarlo (ver cutmeat_daily_controls más adelante).

INSERT INTO public.cutmeat_daily_history (
  company_id, report_date, statement_balance, uncleared_checks_as_of,
  uncleared_checks_after, uncleared_deposits_as_of, uncleared_deposits_after,
  register_balance, recurrentes_prior, recurrentes_week, balance_after_weekly,
  balance_gabriel, aging_vendors_total, aging_customers_total, source, pdf_source_id
)
SELECT c.id, v.report_date, v.statement_balance, v.uncleared_checks_as_of,
       v.uncleared_checks_after, v.uncleared_deposits_as_of, 0,
       v.register_balance, v.recurrentes_prior, v.recurrentes_week,
       v.balance_after_weekly, v.balance_gabriel, v.aging_vendors_total,
       v.aging_customers_total, 'backfill-drive', '1z2y7paYg8K-fSNYkO80Tr74mnbaCDbu-'
FROM public.companies c
JOIN (
  VALUES
    ('2026-10-01'::date, 32189.26, -125.00, -794.01, 172.76, 31443.01, -692.00, -3571.39, 27179.62, 27224.20, 28547.78, 28518.29),
    ('2026-10-02'::date, 31740.77, -297.76, 0.00, 0.00, 31443.01, -692.00, -3571.39, 27179.62, 27179.62, 28547.78, 28518.29),
    ('2026-10-05'::date, 31740.77, -297.76, -11847.73, 20477.60, 40072.88, -3463.39, -1360.00, 35249.49, 27179.62, 20905.79, 16658.08),
    ('2026-10-06'::date, 31740.77, -12145.49, 0.00, 20477.60, 40072.88, -3463.39, -1360.00, 35249.49, 35249.49, 20905.79, 16658.08),
    ('2026-10-07'::date, 40197.88, -125.00, 0.00, 0.00, 40072.88, -3463.39, -1360.00, 35249.49, 35249.49, 20905.79, 16658.08),
    ('2026-10-08'::date, 40197.88, -125.00, -526.28, 346.28, 39892.88, -3463.39, -1180.00, 35249.49, 35249.49, 20905.79, 16658.08),
    ('2026-10-09'::date, 40107.05, -471.28, 0.00, -500.00, 39135.77, -2829.00, -1180.00, 35126.77, 35249.49, 20905.79, 16658.08)
) AS v(
  report_date, statement_balance, uncleared_checks_as_of, uncleared_checks_after,
  uncleared_deposits_as_of, register_balance, recurrentes_prior, recurrentes_week,
  balance_after_weekly, balance_gabriel, aging_vendors_total, aging_customers_total
) ON true
WHERE c.slug = 'cut-meat-distributors'
ON CONFLICT (company_id, report_date) DO NOTHING;
