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
| `cutmeat_daily_reports`                   | Un informe por fecha; estado `draft` / `closed` / `reopened`              |
| `cutmeat_daily_report_events`             | Audit log: creado, cerrado, reabierto, PDF generado, dato actualizado     |
| `cutmeat_daily_reconciliation`            | Statement ending + Register del día                                       |
| `cutmeat_daily_reconciliation_items`      | Uncleared checks / deposits                                               |
| `cutmeat_daily_bank_export`               | Closing balance del Deposit Accounts Activity Summary                     |
| `cutmeat_daily_bank_movements`            | Movimientos del banco: vínculo a un recurrente, o marca "Not entered"     |
| `cutmeat_daily_recurring_payments`        | Recurrentes del mes (no por día): concepto, vencimiento, pagado, monto real |
| `cutmeat_daily_recurring_payment_history` | Historial de cambios de cada recurrente (`previous_value`/`new_value`)    |
| `cutmeat_daily_income_projection`         | THIS WEEK: ingreso proyectado por día (domingo a sábado)                  |
| `cutmeat_daily_aging_vendors` / `_vendor_items`   | TOTAL del Vendor Balance Detail Report + detalle                   |
| `cutmeat_daily_aging_customers` / `_customer_items` | TOTAL del Customer Balance Detail Report + detalle                 |
| `cutmeat_daily_vendor_config`             | Proveedores incluidos/excluidos del consolidado, y Prime Meats aparte     |
| `cutmeat_daily_holidays`                  | Feriados para la fecha sugerida del informe                              |
| `cutmeat_daily_settings`                  | Saldo y recurrentes de Prime Meats, ingresos por defecto, `data_source`   |
| `cutmeat_daily_generated_pdfs`            | Un `storage_path` por versión; `UNIQUE(report_id, doc_type, version)`    |

`cutmeat_daily_settings.data_source` solo admite `'manual'` hoy;
`'quickbooks_api'` queda reservado para la Fase 2 (ver abajo), sin
implementar.

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
- **Balance after Weekly Payments** = `Register − recurrentes prior −
  recurrentes this week`.
- **Financial Report**: Balance Today = Balance after Weekly Payments.
  7-day = Balance Today + ingreso de la semana en curso (excluye el lunes,
  ya reflejado por otro lado) + ajuste de aging (hoy 0). 14-day = 7-day +
  ingreso plano semanal ($9,000 por defecto) − recurrentes de la semana
  siguiente + ajuste. 21-day = 14-day + ingreso plano − recurrentes de la
  semana después + ajuste. Las fechas de cada paso son fecha del informe
  +3 / +10 / +17 días.
- **Variación Diaria**: por cada recurrente pagado con monto real
  informado, `recurrente − real` (positivo = favorable). Un movimiento de
  banco sin recurrente vinculado ni marca de "Not entered Sales" queda
  **POR CLASIFICAR** y no entra en ningún balance hasta que se clasifique.
- **Balance GABRIEL** = Balance after Weekly Payments − variación total
  (Gabriel Manzanares es el dueño del negocio).
- **Balance + Not entered Sales** = Balance after Weekly Payments + los
  depósitos todavía no entrados en QuickBooks (p. ej. Costco) + depósitos
  del día.
- **Aging Vendors consolidado** = TOTAL general del Vendor Balance Detail
  Report − subtotal de los proveedores marcados como excluidos − saldo de
  Prime Meats y sus recurrentes (Prime Meats no sale en ese PDF). Un
  proveedor del aging que no está ni incluido ni excluido dispara una
  alerta ("proveedor nuevo") para que se lo configure.
- **Aging Customers consolidado**: hoy es un passthrough del TOTAL general
  (no hay ajuste de Prime Meats del lado de clientes todavía); queda como
  función propia (`consolidateCustomerAging`) para no tocar los llamadores
  si eso cambia.

Cada número que aparece en pantalla y en los PDF indica de dónde sale
(Register, Statement ending, aging raw total, etc.) para poder auditarlo.

## Entrada de datos (Fase 1 — sin API de QuickBooks)

Cada pestaña (Conciliación, Banco, Aging Vendors, Aging Customers) tiene un
botón **"Subir PDF"**: sube el PDF original a Storage, lo lee con
`extractPdf()` (pdf-parse) y corre el extractor correspondiente para
precargar el formulario — el admin siempre revisa y corrige antes de
guardar ("mejor esfuerzo", nunca se guarda sin pasar por la pantalla):

- **Reconciliation Report** y **Export del banco**: `extractReconciliationReport()`
  / `extractBankExport()` en `src/lib/cutmeat-daily/extractors.ts`, servidos
  por las acciones `extractReconciliationPdf` / `extractBankExportPdf`.
- **Aging Vendors / Customers**: `extractAgingBalanceDetail()` reutiliza el
  parser de "Balance Detail" de QuickBooks que ya existe para SinexIA
  (`src/lib/intelligence/extractors/quickbooks-ar-pdf.ts`) — Vendor y
  Customer Balance Detail comparten el mismo formato de tabla; servido por
  `extractAgingPdf`.
- Todos los datos también se pueden cargar a mano sin subir ningún PDF.

La interfaz de "fuente de datos" queda lista para un conector de QuickBooks
Online en la Fase 2: `cutmeat_daily_settings.data_source` ya distingue
`manual` de `quickbooks_api`, y cada tabla (`reconciliation`, `bank_export`,
`aging_vendors`, `aging_customers`) ya guarda `source_pdf_path` /
`extracted_at` independientemente de quién cargó el dato.

### Carga programática (para una skill de Claude)

`loadDailyReportData()` (`src/actions/cutmeat-daily.ts`) es un endpoint de
servidor autenticado (admin) que carga de una sola vez la conciliación, el
export del banco y los dos aging de un día, sin pasar por la pantalla. Pensado
para que una skill de Sinexia OS corra el proceso diario de punta a punta.

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
7-day $42,626.77; 14-day $51,046.77; 21-day $60,046.77; Variación −$122.72;
Balance GABRIEL $35,249.49; con Costco $35,473.05; Aging Vendors consolidado
$20,905.79; Aging Customers $16,658.08), más: alertas de completitud, fecha
sugerida del informe, aislamiento entre empresas (RLS, `requireAdmin()`, sin
referencias desde el portal cliente), bloqueo de edición en días cerrados y
versionado de PDF.

Antes de cualquier cambio: `npm run typecheck`, `npm run lint`, `npm run
build`, y toda la batería de tests (sin romper los existentes).

## Pendiente (Fase 2)

- Conector de QuickBooks Online: hoy los 5 documentos de entrada son PDF
  cargados a mano; `data_source = 'quickbooks_api'` queda reservado en el
  esquema pero sin implementar.
- Clasificación automática de movimientos del banco contra recurrentes
  (hoy el vínculo se elige a mano en la pestaña Banco).
- Ajuste de aging por Prime Meats del lado de clientes (hoy
  `consolidateCustomerAging` es un passthrough del TOTAL general).
