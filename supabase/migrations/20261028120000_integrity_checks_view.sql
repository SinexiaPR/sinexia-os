-- Vista de solo lectura con los controles de integridad de datos por cliente.
-- Una fila por control: status = 'ok' | 'revisar' | 'alerta'. La consulta es
-- security_invoker (respeta RLS de las tablas de origen) y además solo devuelve
-- filas a administradores.
--
-- Decisiones de negocio confirmadas el 2026-10-27 (ver comentarios por control):
--   · Sibarita paga la nómina con una semana de atraso.
--   · Sibarita no tiene nómina en las semanas 2026-06-08 y 2026-06-29.
--   · Un día cerrado de TRESBE se marca en tresbe_budget_closed_days.

CREATE OR REPLACE VIEW public.integrity_checks
WITH (security_invoker = true) AS
WITH today AS (
  SELECT (now() AT TIME ZONE 'America/Puerto_Rico')::date AS hoy
),
checks AS (
  -- Sibarita: la última semana cargada en el histórico no puede ir más de 2 semanas atrás
  SELECT 'Grupo Sibarita'::text AS client,
         'sibarita_historico_al_dia'::text AS check_code,
         CASE WHEN max(h.week_start) >= date_trunc('week', t.hoy)::date - 14
              THEN 'ok' ELSE 'alerta' END AS status,
         'Última semana en el histórico: ' || coalesce(max(h.week_start)::text, 'ninguna') AS detail
    FROM today t
    LEFT JOIN public.sibarita_payroll_history h ON true
   GROUP BY t.hoy

  UNION ALL
  -- Sibarita: huecos en la secuencia semanal desde 2026-07-06
  -- (6/8 y 6/29 son semanas sin nómina confirmadas; no se reportan)
  SELECT 'Grupo Sibarita',
         'sibarita_historico_sin_huecos',
         CASE WHEN count(g.d) = 0 THEN 'ok' ELSE 'alerta' END,
         CASE WHEN count(g.d) = 0 THEN 'Sin semanas faltantes'
              ELSE 'Faltan: ' || string_agg(g.d::date::text, ', ' ORDER BY g.d) END
    FROM (
      SELECT d
        FROM generate_series(
               DATE '2026-07-06',
               (SELECT max(week_start) FROM public.sibarita_payroll_history),
               interval '7 days') d
       WHERE NOT EXISTS (
         SELECT 1 FROM public.sibarita_payroll_history h WHERE h.week_start = d::date)
    ) g

  UNION ALL
  -- Sibarita: filas duplicadas en el histórico
  SELECT 'Grupo Sibarita',
         'sibarita_historico_duplicados',
         CASE WHEN count(*) = 0 THEN 'ok' ELSE 'alerta' END,
         CASE WHEN count(*) = 0 THEN 'Sin duplicados'
              ELSE count(*) || ' empleado(s) repetido(s) en la misma semana' END
    FROM (
      SELECT 1
        FROM public.sibarita_payroll_history
       GROUP BY week_start, section, employee_name
      HAVING count(*) > 1
    ) d

  UNION ALL
  -- Sibarita: semanas enviadas hace más de 14 días y todavía sin aprobar
  SELECT 'Grupo Sibarita',
         'sibarita_semanas_sin_aprobar',
         CASE WHEN count(*) = 0 THEN 'ok' ELSE 'revisar' END,
         CASE WHEN count(*) = 0 THEN 'Todas las semanas enviadas están aprobadas'
              ELSE count(*) || ' semana(s) en "submitted": ' ||
                   string_agg(w.week_start::text, ', ' ORDER BY w.week_start) END
    FROM public.weekly_payrolls w
   WHERE w.status = 'submitted' AND w.submitted_at < now() - interval '14 days'

  UNION ALL
  -- TRESBE: días de los últimos 30 sin movimiento ni cierre en el presupuesto
  SELECT 'TRESBE',
         'tresbe_presupuesto_dias_sin_dato',
         CASE WHEN count(*) = 0 THEN 'ok' ELSE 'alerta' END,
         CASE WHEN count(*) = 0 THEN 'Todos los días tienen movimiento o cierre'
              ELSE count(*) || ' día(s) sin dato ni cierre: ' ||
                   string_agg(x.dt::text, ', ' ORDER BY x.dt) END
    FROM (
      SELECT d::date AS dt
        FROM today t, generate_series(t.hoy - 30, t.hoy - 1, interval '1 day') d
       WHERE NOT EXISTS (SELECT 1 FROM public.tresbe_budget_movements m WHERE m.entry_date = d::date)
         AND NOT EXISTS (SELECT 1 FROM public.tresbe_budget_closed_days c WHERE c.entry_date = d::date)
    ) x

  UNION ALL
  -- TRESBE: nómina desactualizada mientras el local sigue operando.
  -- Solo se marca si hubo movimientos en los últimos 7 días; con el local cerrado no aplica.
  SELECT 'TRESBE',
         'tresbe_nomina_al_dia',
         CASE WHEN m.activo AND p.ultima < date_trunc('week', t.hoy)::date - 14
              THEN 'revisar' ELSE 'ok' END,
         'Última semana cargada: ' || coalesce(p.ultima::text, 'ninguna') ||
         CASE WHEN m.activo THEN '' ELSE ' (sin movimientos en los últimos 7 días)' END
    FROM today t,
         (SELECT max(week_start) AS ultima FROM public.tresbe_payrolls) p,
         (SELECT coalesce(max(entry_date), DATE '1900-01-01') >= (SELECT hoy FROM today) - 7 AS activo
            FROM public.tresbe_budget_movements) m

  UNION ALL
  -- Cut Meat: días hábiles sin informe, descontando feriados. El informe de un día
  -- se carga al día siguiente, así que se evalúa hasta anteayer.
  SELECT 'Wagyu Food Service (Cut Meat)',
         'cutmeat_informes_dias_habiles',
         CASE WHEN count(*) = 0 THEN 'ok' ELSE 'alerta' END,
         CASE WHEN count(*) = 0 THEN 'Todos los días hábiles tienen informe'
              ELSE count(*) || ' día(s) hábil(es) sin informe: ' ||
                   string_agg(x.dt::text, ', ' ORDER BY x.dt) END
    FROM (
      SELECT d::date AS dt
        FROM today t,
             generate_series(
               greatest(t.hoy - 30, (SELECT min(report_date) FROM public.cutmeat_daily_reports)),
               t.hoy - 2, interval '1 day') d
       WHERE extract(isodow FROM d) < 6
         AND NOT EXISTS (SELECT 1 FROM public.cutmeat_daily_reports r WHERE r.report_date = d::date)
         AND NOT EXISTS (SELECT 1 FROM public.cutmeat_daily_holidays h WHERE h.holiday_date = d::date)
    ) x

  UNION ALL
  -- Cut Meat: informes de días pasados que siguen sin cerrar
  SELECT 'Wagyu Food Service (Cut Meat)',
         'cutmeat_informes_sin_cerrar',
         CASE WHEN count(*) = 0 THEN 'ok' ELSE 'alerta' END,
         CASE WHEN count(*) = 0 THEN 'Todos los informes pasados están cerrados'
              ELSE count(*) || ' informe(s) sin cerrar: ' ||
                   string_agg(r.report_date::text, ', ' ORDER BY r.report_date) END
    FROM today t, public.cutmeat_daily_reports r
   WHERE r.status <> 'closed' AND r.report_date < t.hoy

  UNION ALL
  -- Cut Meat: balance idéntico al del día anterior en los últimos 7 días (puede ser legítimo)
  SELECT 'Wagyu Food Service (Cut Meat)',
         'cutmeat_balance_repetido',
         CASE WHEN count(*) = 0 THEN 'ok' ELSE 'revisar' END,
         CASE WHEN count(*) = 0 THEN 'Sin balances repetidos en los últimos 7 días'
              ELSE 'Balance igual al día anterior: ' ||
                   string_agg(x.report_date::text, ', ' ORDER BY x.report_date) END
    FROM today t,
         (SELECT report_date, balance_gabriel,
                 lag(balance_gabriel) OVER (ORDER BY report_date) AS prev
            FROM public.cutmeat_daily_reports) x
   WHERE x.balance_gabriel = x.prev AND x.report_date >= t.hoy - 7
)
SELECT client, check_code, status, detail, (SELECT hoy FROM today) AS as_of
  FROM checks
 WHERE public.is_admin();

COMMENT ON VIEW public.integrity_checks IS
  'Controles de integridad de datos por cliente (solo lectura, solo administradores).';

REVOKE ALL ON public.integrity_checks FROM anon;
GRANT SELECT ON public.integrity_checks TO authenticated;
