-- Revierte la migración 20261014150000: la fila "Total" del FINANCIAL
-- REPORT (primer bloque, 7-day) no es un valor fijo/histórico -- se
-- calcula siempre como Balance Today + Weekly income projection (+
-- Aging) del mismo bloque, igual que "7-day balance" (ver
-- financialHorizonRow en src/lib/cutmeat-daily/pdf.ts). La columna
-- quedó sin uso en el código; se elimina.
--
-- NOTA: el DROP COLUMN no pudo aplicarse vía MCP (mismo límite de
-- herramienta que afecta a los DELETE en este proyecto -- ver
-- docs/CUTMEAT_DAILY_DATA_CONTRACT.md). La columna queda en la base,
-- sin uso, hasta que se corra manualmente.
alter table public.cutmeat_daily_reports
  drop column if exists financial_report_legacy_total;
