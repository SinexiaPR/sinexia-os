-- Fila "Total" propia del documento ORIGINAL de Hernan en el primer
-- bloque (7-day) del FINANCIAL REPORT, antes de "7-day balance" -- un
-- valor histórico de su planilla (no se deriva de nuestro motor
-- corregido, que ya no reproduce el bug de rango K10:K15 que este
-- número refleja). Nullable: solo se carga cuando el informe tiene ese
-- valor de referencia (hoy, el 10/12/2026 = 37,974.46).
alter table public.cutmeat_daily_reports
  add column if not exists financial_report_legacy_total numeric(14, 2);
