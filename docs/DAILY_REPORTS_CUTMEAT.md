# Informes diarios — Cut Meat Distributors (Wagyu Food Service LLC)

Módulo interno (solo admin) que reemplaza el Google Sheet diario con el que se
armaban a mano los 5 PDF de cierre del día: Reconciliation Report (FIRST
BANK), Export del banco, Consolidated, Aging Vendors y Aging Customers.

Ruta: `/dashboard/admin/companies/{companyId}/daily-reports?date=YYYY-MM-DD`.
PDF: `/api/cutmeat-daily/{companyId}/pdf?date=YYYY-MM-DD&doc=reconciliation|bank|consolidated|vendors|customers[&version=N]`.
ZIP de los 5: `/api/cutmeat-daily/{companyId}/pdf/zip?date=YYYY-MM-DD`.

Scope: solo la empresa con slug `cut-meat-distributors`. El botón "Informes
diarios" en la página de la empresa (`.../companies/[companyId]/page.tsx`)
solo aparece para ese slug, igual que el botón "Presupuesto" de Tresbe. El
portal cliente no referencia este módulo en ningún lugar (nav, dashboard,
componentes) — verificado por `scripts/test-cutmeat-daily-reports.ts`.

## Fecha del informe

El informe de un día lleva la fecha del **último día hábil cerrado**, no la
de hoy: el consolidado armado el lunes 10/12 lleva fecha 10/09 (viernes
anterior). `suggestReportDate()` (`src/services/cutmeat-daily.ts`) salta
fines de semana y los feriados configurados en **Configuración**; la fecha
siempre se puede cambiar a mano desde el selector de la pantalla.

## Modelo de datos

Todas las tablas usan el prefijo `cutmeat_daily_` y RLS
`is_admin() AND is_cut_meat_company(...)` (directo por `company_id`, o vía
`EXISTS (... cutmeat_daily_reports ...)` para las que cuelgan de
`report_id`). Migración: `supabase/migrations/20261012120000_cutmeat_daily_reports.sql`
(+ seed de proveedores/Prime Meats en `20261012121000_cutmeat_daily_seed_config.sql`).

| Tabla                                     | Rol                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `cutmeat_daily_reports`                   | Un informe por fecha; estado `draft` / `closed` / `reopened`; congela `balance_after_weekly`/`balance_gabriel` al cerrar |
| `cutmeat_daily_report_events`             | Audit log: creado, cerrado, reabierto, PDF generado, dato actualizado     |
| `cutmeat_daily_reconciliation`            | Statement ending + Register del día; `source`/`loaded_by`/`loaded_at`      |
| `cutmeat_daily_reconciliation_items`      | Uncleared checks / deposits                                               |
| `cutmeat_daily_bank_export`               | Closing balance del Deposit Accounts Activity Summary; `source`/`loaded_by`/`loaded_at` |
| `cutmeat_daily_bank_movements`            | Movimientos del banco: vínculo a un recurrente (FK a `cutmeat_recurrentes`), o marca "Not entered" |
| `cutmeat_daily_income_projection`         | THIS WEEK: ingreso proyectado por día (ya no alimenta el Financial Report, ver abajo) |
| `cutmeat_daily_aging_vendors` / `_vendor_items`   | TOTAL del Vendor Balance Detail Report + detalle por factura (opcional) |
| `cutmeat_daily_aging_customers` / `_customer_items` | TOTAL del Customer Balance Detail Report + detalle por factura (opcional) |
| `cutmeat_daily_vendor_config`             | Proveedores incluidos/excluidos del consolidado, y Prime Meats aparte     |
| `cutmeat_daily_holidays`                  | Feriados para la fecha sugerida del informe                              |
| `cutmeat_daily_settings`                  | Prime Meats, `gabriel_starting_balance`, `current_week_income`, `flat_weekly_income`, `data_source` |
| `cutmeat_daily_generated_pdfs`            | Un `storage_path` por versión; `UNIQUE(report_id, doc_type, version)`    |
| `cutmeat_daily_variance_lines`            | Variación Diaria: líneas libres (concepto + monto)                        |

`cutmeat_daily_settings.data_source` solo admite `'manual'` hoy;
`'quickbooks_api'` queda reservado sin implementar.

Esquema completo (columnas, claves únicas, enums, RLS, el trigger de
bloqueo de días cerrados y la función `cutmeat_daily_controls`) en
`docs/CUTMEAT_DAILY_DATA_CONTRACT.md`.

### Fuente de recurrentes: `cutmeat_recurrentes` (Fase 1)

"Informes diarios" lee y vincula los recurrentes de `cutmeat_recurrentes`
(la misma tabla de la pantalla Recurrentes, `docs/CUTMEAT_RECURRENTES.md`)
— la tabla vieja `cutmeat_daily_recurring_payments` (y su historial) se
retiraron por migración; `cutmeat_daily_bank_movements.linked_recurring_id`
también apunta por FK a `cutmeat_recurrentes`.
`getRecurringPayments(companyId, reportDate)` en
`src/services/cutmeat-daily.ts` trae los recurrentes del mes del
informe y del mes siguiente (la cubeta "semana después" puede caer ahí).
La pestaña **Recurrentes** de "Informes diarios" usa las mismas acciones
que la pantalla de Fase 1 (`saveRecurrente`/`deleteRecurrente`/
`markRecurrentePaid` en `actions/cutmeat-recurrentes.ts`); el detalle
completo del mes se sigue editando en
`/dashboard/admin/companies/{companyId}/recurrentes`.

## Reglas de cálculo (`src/lib/cutmeat-daily/calculations.ts`)

Semana operativa **domingo a sábado** (no lunes a domingo como Tresbe), por
fecha de vencimiento de cada recurrente.

- **Control de conciliación**: `Statement ending + uncleared checks +
  uncleared deposits − Register` debe dar $0.00; si no, alerta en pantalla y
  en el PDF ("NO CUADRA").
- **Recurrentes prior to this week**: pendientes (no pagados) con
  vencimiento antes del domingo de la semana en curso. **For this week**:
  pendientes dentro de esa semana. Un recurrente pagado nunca suma en
  ninguna de las dos (no es deuda pendiente).
- **Balance after Weekly Payments (B)** = `Register − recurrentes prior −
  recurrentes this week`. Se congela en `cutmeat_daily_reports.balance_after_weekly`
  al cerrar el día (`closeDailyReport`) — el día siguiente lo lee tal cual
  en vez de recalcularlo sobre datos que puedan cambiar después.
- **Financial Report**: Balance Today = B. Las etiquetas 7/14/21 días son
  el **sábado de la semana** (domingo-sábado) que contiene la fecha del
  informe, **+2 / +9 / +16 días** (no fecha del informe +3/+10/+17 —
  ej.: informe 10/06 → sábado 10/10 → 10/12, 10/19, 10/26).
  7-day = B + ingreso de la semana en curso (`cutmeat_daily_settings.current_week_income`,
  **fijo toda la semana**, sin prorratear por día ni excluir el lunes) +
  ajuste de aging (hoy 0). 14-day = 7-day + ingreso plano semanal
  (`flat_weekly_income`, $9,000 por defecto) − recurrentes de la semana
  siguiente + ajuste. 21-day = 14-day + ingreso plano − recurrentes de la
  semana después + ajuste.
- **Variación Diaria**: líneas **libres** (concepto + monto), sin tipos
  fijos ni clasificación automática — las carga el admin a mano en la
  pestaña Resumen (`cutmeat_daily_variance_lines`), igual que hoy las
  pone Hernan en la planilla: "Diferencia Pago Recurrentes (vendor)",
  "First Bank - Service Charges", "Recurrentes de la Semana", "Aging",
  cheques/depósitos sin cobrar puntuales. Ya **no** se calcula
  automáticamente comparando recurrentes pagados contra su monto real.
  Un movimiento de banco sin recurrente vinculado ni marca de "Not
  entered Sales" sigue quedando **POR CLASIFICAR** (alerta en pantalla),
  sin relación con Variación Diaria.
- **Balance GABRIEL** = Balance after Weekly Payments (B) del **último
  informe CERRADO anterior** (de `cutmeat_daily_history` o de un día
  cerrado en vivo, lo que sea más reciente) — **no** "B de hoy menos
  variación". Para el primer día sin ningún anterior, usa el valor de
  arranque configurable `cutmeat_daily_settings.gabriel_starting_balance`.
  Se congela en `cutmeat_daily_reports.balance_gabriel` al cerrar.
- **Balance + Not entered Sales** = Balance after Weekly Payments + los
  depósitos todavía no entrados en QuickBooks (p. ej. Costco) + depósitos
  del día.
- **Aging Vendors consolidado** = TOTAL general del Vendor Balance Detail
  Report − subtotal de los proveedores marcados como excluidos − saldo de
  Prime Meats y sus recurrentes (Prime Meats no sale en ese PDF). Un
  proveedor del aging que no está ni incluido ni excluido dispara una
  alerta ("proveedor nuevo") para que se lo configure. La comparación de
  nombres se normaliza (minúsculas, sin comas ni puntos) con
  `normalizeVendorName()`, así "Service Zone, Inc." del PDF coincide con
  "Service Zone Inc." de Configuración.
- **Aging Customers consolidado**: hoy es un passthrough del TOTAL general
  (no hay ajuste de Prime Meats del lado de clientes todavía); queda como
  función propia (`consolidateCustomerAging`) para no tocar los llamadores
  si eso cambia.
- **Detalle por factura del aging** (opcional, aditivo): además de
  nombre + balance, cada fila puede llevar `txn_date`/`txn_type`/`num`/
  `due_date`/`amount`/`open_balance` — un nombre puede repetirse en
  varias filas (una por factura). `groupAgingItems()` las agrupa por
  nombre con subtotal; el PDF de Aging Vendors/Customers reproduce
  entonces el formato original (Vendor/Customer Balance Detail Report)
  agrupado, con "Total for `<nombre>`" y el total general. Sin detalle
  cargado, el PDF sigue siendo el formato simple de siempre.

Cada número que aparece en pantalla y en los PDF indica de dónde sale
(Register, Statement ending, aging raw total, etc.) para poder auditarlo.

## Entrada de datos: manual o carga programática (sin subida de PDF)

Las pestañas de Conciliación, Banco y Aging **ya no tienen** el botón
"Subir PDF" — solo los formularios manuales. Los extractores
(`extractReconciliationReport()` / `extractBankExport()` /
`extractAgingBalanceDetail()` en `src/lib/cutmeat-daily/extractors.ts`)
y las acciones que los sirven (`extractReconciliationPdf` /
`extractBankExportPdf` / `extractAgingPdf`) siguen existiendo —
**no se borraron** — pero están marcados `@deprecated`.

Cada tabla (`reconciliation`, `bank_export`, `aging_vendors`,
`aging_customers`) guarda de dónde salió el dato: `source` (`'manual'` |
`'claude-controlado'`), `loaded_by`, `loaded_at`. Un día cargado por la
vía programática (ver abajo) **queda siempre en borrador** — solo un
admin lo cierra desde la pantalla.

### Carga programática (para una skill de Claude)

`loadDailyReportData()` (`src/actions/cutmeat-daily.ts`) es un endpoint de
servidor autenticado (admin) que carga de una sola vez la conciliación, el
export del banco, los dos aging y las líneas de Variación Diaria de un
día, sin pasar por la pantalla y sin cerrarlo. Pensado para que una
skill de Sinexia OS corra el proceso diario de punta a punta, dejando
el cierre final en manos de un admin.

## Protección de días cerrados y controles de solo lectura

Reabrir/cerrar sigue siendo a nivel de pantalla
(`requireEditableReport()`), pero además hay un **trigger de base**
(`cutmeat_daily_block_closed_write()`) que rechaza cualquier
`INSERT`/`UPDATE`/`DELETE` sobre las 9 tablas de datos del día si el
informe está cerrado — no se puede saltear ni desde un script o un
cliente admin directo. Solo se revierte reabriendo el día.

`cutmeat_daily_controls(company_id, report_date)` (función SQL de solo
lectura) recomputa 4 controles desde los datos ya guardados y devuelve
`ok boolean` + cuál falla — detalle completo en
`docs/CUTMEAT_DAILY_DATA_CONTRACT.md`.

## Estados del día y versionado de PDF

- Un informe nace en `draft`. **Cerrar día** lo pasa a `closed`: a partir de
  ahí, `requireEditableReport()` bloquea `saveReconciliation`,
  `saveBankExport` y `saveAging*` hasta que se **reabre** (`reopened`).
- Cada generación de PDF (`generateDailyPdf`) sube un archivo nuevo a Storage
  (bucket privado `cutmeat-daily`, `upsert: false`) e inserta una fila nueva
  en `cutmeat_daily_generated_pdfs` con la próxima versión — nunca pisa un
  `storage_path` existente. Queda quién y cuándo en
  `cutmeat_daily_report_events` (`pdf_generated`).
- Nombres de archivo: `CUTD-Reconciliation_Report_MM-DD-YYYY`,
  `CUTD-Export-MMDDYYYY`, `CUTD-Consolidated-MM-DD-YYYY`,
  `AGING-VENDORS-WAGYU_FOOD_SERVICES`, `AGING-CUSTOMERS-WAGYU_FOOD_SERVICES`.

## Verificación

```bash
npm run test:cutmeat-daily
```

Reproduce al centavo el caso real del 09/10/2026 (recurrentes prior
−$2,829.00, this week −$1,180.00; Balance after Weekly Payments $35,126.77;
7-day $42,626.77; 14-day $51,046.77; 21-day $60,046.77; Balance GABRIEL
$35,249.49 = B del 08/10; con Costco $35,473.05; Aging Vendors consolidado
$20,905.79; Aging Customers $16,658.08), más los 7 días de
`cutmeat_daily_history` (01/10-09/10) encadenando Balance GABRIEL = B del
día anterior (arranque $27,224.20 el 10/01) y las etiquetas 7/14/21 días,
alertas de completitud, fecha sugerida del informe, aislamiento entre
empresas (RLS, `requireAdmin()`, sin referencias desde el portal
cliente), fuente única de recurrentes, sin input de subida de PDF,
bloqueo de días cerrados a nivel de base, claves únicas para upsert
idempotente, el aging con detalle por factura, y `cutmeat_daily_controls`.

Antes de cualquier cambio: `npm run typecheck`, `npm run lint`, `npm run
build`, y toda la batería de tests (sin romper los existentes).

## Pendiente

- `gabriel_starting_balance` quedó en el default genérico ($0) para Cut
  Meat Distributors -- no se cargó el valor real (27,224.20) porque esta
  tarea no carga datos reales. Hay que setearlo desde Configuración
  antes de cerrar el primer día en vivo del módulo.
- Conector de QuickBooks Online: hoy los documentos de entrada son
  manuales o programáticos (`claude-controlado`); `data_source =
  'quickbooks_api'` queda reservado en el esquema pero sin implementar.
- Clasificación automática de movimientos del banco contra recurrentes
  (hoy el vínculo se elige a mano en la pestaña Banco).
- Ajuste de aging por Prime Meats del lado de clientes (hoy
  `consolidateCustomerAging` es un passthrough del TOTAL general).
- Confirmar con María la interpretación exacta de "control de no
  ingresados" en `cutmeat_daily_controls` (hoy: sin movimientos del
  banco sin clasificar) -- ver `docs/CUTMEAT_DAILY_DATA_CONTRACT.md`.
