# Contrato de datos — Informes diarios (Cut Meat Distributors)

Generado a partir de las migraciones reales del módulo "Informes diarios"
(Cut Meat Distributors / Wagyu Food Service LLC):
`20261012120000_cutmeat_daily_reports.sql`,
`20261012121000_cutmeat_daily_seed_config.sql`,
`20261013130000_cutmeat_daily_data_contract.sql`,
`20261013131000_cutmeat_daily_calc_fixes.sql`,
`20261013114120_cutmeat_daily_bank_movements_relink_recurring.sql` y
`20261013141000_cutmeat_daily_drop_old_recurring_payments.sql`.
Documenta el esquema tal como quedó aplicado, no de memoria — si una
migración nueva cambia una tabla, actualizar este archivo junto con
ella.

La tarea que generó la segunda mitad de este contrato (quitar la subida
de PDF, origen de los datos, bloqueo de días cerrados, controles de solo
lectura) explícitamente **no cargó datos reales de octubre** y **no
cambió** los cálculos ni los datos ya aprobados de `cutmeat_recurrentes`
o `cutmeat_daily_history` (Fase 1). Las filas de ejemplo de este
documento son los mismos valores ya validados y publicados en
`docs/CUTMEAT_RECURRENTES.md` y en los scripts de test — ilustran el
formato, no datos cargados en la base por esta tarea.

## Origen de los datos (`source` / `loaded_by` / `loaded_at`)

Las 4 tablas que antes se llenaban al subir un PDF (`cutmeat_daily_reconciliation`,
`cutmeat_daily_bank_export`, `cutmeat_daily_aging_vendors`,
`cutmeat_daily_aging_customers`) tienen:

- `source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'claude-controlado'))`
- `loaded_by UUID REFERENCES profiles(id)`
- `loaded_at TIMESTAMPTZ`

`manual` = cargado a mano en la pantalla; `claude-controlado` = cargado
por `loadDailyReportData` (el endpoint programático pensado para una
skill de Claude). Un día cargado así **queda siempre en borrador** —
`loadDailyReportData` nunca llama a `closeDailyReport`; solo un admin
cierra el día desde la pantalla.

Los extractores de PDF (`extractReconciliationReport`, `extractBankExport`,
`extractAgingBalanceDetail` en `lib/cutmeat-daily/extractors.ts`, y las
acciones `extractReconciliationPdf`/`extractBankExportPdf`/`extractAgingPdf`
en `actions/cutmeat-daily.ts`) siguen existiendo — **no se borraron** —
pero están marcados `@deprecated`: la pantalla ya no tiene el botón
"Subir PDF" en Conciliación, Banco ni Aging (solo los formularios
manuales).

## Bloqueo de escritura en días cerrados (a nivel de base)

Función `cutmeat_daily_block_closed_write()` (trigger `BEFORE INSERT OR
UPDATE OR DELETE`): si el `cutmeat_daily_reports` del que depende la fila
tiene `status = 'closed'`, lanza una excepción. Se aplica a las 9 tablas
de datos del día:

`cutmeat_daily_reconciliation`, `cutmeat_daily_reconciliation_items`,
`cutmeat_daily_bank_export`, `cutmeat_daily_bank_movements`,
`cutmeat_daily_aging_vendors`, `cutmeat_daily_aging_vendor_items`,
`cutmeat_daily_aging_customers`, `cutmeat_daily_aging_customer_items`,
`cutmeat_daily_variance_lines`.

`cutmeat_daily_generated_pdfs` queda **deliberadamente afuera**: generar
el PDF final es precisamente lo que se hace con el día ya cerrado.

Es un bloqueo de base, no solo de pantalla — rechaza cualquier escritura
directa (admin client, otro script, otra skill), no solo la de la UI
(que además ya chequea `requireEditableReport()` en
`actions/cutmeat-daily.ts` para dar un mensaje más claro antes de llegar
a la base). Solo se revierte reabriendo el día (`reopenDailyReport`
cambia `status` a `'reopened'`).

## Balance after Weekly Payments y Balance GABRIEL congelados

Al cerrar un día (`closeDailyReport`), se calculan y se guardan
`cutmeat_daily_reports.balance_after_weekly` y `.balance_gabriel` — el
día siguiente los lee como "el último día cerrado anterior"
(`buildBalanceGabriel` en `lib/cutmeat-daily/calculations.ts`) en vez de
recalcularlos sobre datos que puedan cambiar después. Al reabrir
(`reopenDailyReport`), ambos vuelven a `NULL` hasta el próximo cierre.

## Tablas

### `cutmeat_daily_reports`

El día del informe: borrador / cerrado / reabierto.

| Columna | Tipo | Obligatoria | Notas |
| --- | --- | --- | --- |
| `id` | UUID | sí (PK) | |
| `company_id` | UUID | sí | FK `companies(id)` |
| `report_date` | DATE | sí | |
| `status` | TEXT | sí | `CHECK IN ('draft','closed','reopened')`, default `'draft'` |
| `closed_at` / `closed_by` | TIMESTAMPTZ / UUID | no | |
| `reopened_at` / `reopened_by` | TIMESTAMPTZ / UUID | no | |
| `balance_after_weekly` | NUMERIC(14,2) | no | Congelado al cerrar (ver arriba) |
| `balance_gabriel` | NUMERIC(14,2) | no | Congelado al cerrar |
| `created_by` / `updated_by` | UUID | no | |
| `created_at` / `updated_at` | TIMESTAMPTZ | sí | |

**Única:** `(company_id, report_date)`.
**RLS:** admin + `is_cut_meat_company(company_id)`, `FOR ALL`. Sin
excepción de lectura para el cliente (a diferencia de Recurrentes/Paquete).

Ejemplo (09/10/2026, cerrado):

```
report_date: 2026-10-09
status: closed
balance_after_weekly: 35126.77
balance_gabriel: 35249.49   -- = balance_after_weekly del 10/08
```

### `cutmeat_daily_report_events`

Auditoría de eventos del día (`created`, `closed`, `reopened`,
`pdf_generated`, `data_updated`), con `detail JSONB` y `created_by`.
**RLS:** admin + empresa (vía `cutmeat_daily_reports`).

### `cutmeat_daily_reconciliation`

Un registro por informe — el control del Reconciliation Report.

| Columna | Tipo | Obligatoria | Notas |
| --- | --- | --- | --- |
| `report_id` | UUID | sí (UNIQUE) | FK `cutmeat_daily_reports`, `ON DELETE CASCADE` |
| `statement_ending` | NUMERIC(14,2) | sí | |
| `register` | NUMERIC(14,2) | sí | |
| `source_pdf_path` | TEXT | no | Histórico (de cuando se subía PDF); hoy casi siempre `NULL` |
| `extracted_at` | TIMESTAMPTZ | no | |
| `source` | TEXT | sí | `'manual'` \| `'claude-controlado'`, default `'manual'` |
| `loaded_by` | UUID | no | |
| `loaded_at` | TIMESTAMPTZ | no | |
| `updated_by` / `updated_at` | UUID / TIMESTAMPTZ | no / sí | |

**Trigger:** bloquea INSERT/UPDATE/DELETE si el día está cerrado.
**RLS:** admin + empresa (vía `report_id`).

Ejemplo (09/10/2026): `statement_ending: 40107.05`, `register: 39135.77`,
`source: 'manual'`. Control = 40107.05 + (-471.28) + (-500.00) − 39135.77
= $0.00.

### `cutmeat_daily_reconciliation_items`

Cheques/depósitos sin cobrar (con signo negativo). `report_id` (FK, sin
UNIQUE — muchas filas por informe), `item_type CHECK IN
('uncleared_check','uncleared_deposit')`, `reference`, `amount`. Mismo
trigger de bloqueo y RLS que la tabla anterior.

### `cutmeat_daily_bank_export`

Un registro por informe — el export del banco. `report_id` (UNIQUE, FK
CASCADE), `closing_balance`, `source_pdf_path`, `extracted_at`,
`source`/`loaded_by`/`loaded_at` (igual que reconciliación), `updated_by`/`updated_at`.

### `cutmeat_daily_bank_movements`

Movimientos del banco. `report_id` (FK, sin UNIQUE), `description`,
`amount CHECK (> 0)`, `direction CHECK IN ('ingreso','egreso')`,
`linked_recurring_id` (FK **nullable** a `cutmeat_recurrentes(id) ON
DELETE SET NULL`), `is_not_entered_deposit BOOLEAN`, `note`,
`updated_by`/`updated_at`.

`linked_recurring_id` se repuntó de la tabla vieja
`cutmeat_daily_recurring_payments` a `cutmeat_recurrentes` en
`20261013114120_cutmeat_daily_bank_movements_relink_recurring.sql` — el
desplegable de BankTab ya ofrecía recurrentes de `cutmeat_recurrentes`
(vía `getRecurringPayments`), así que vincular un movimiento a un
recurrente real fallaba contra el FK viejo hasta ese cambio.

### `cutmeat_daily_recurring_payments` / `cutmeat_daily_recurring_payment_history` — **retiradas**

Eran la tabla vieja de recurrentes, duplicada desde que "Informes
diarios" pasó a leer/escribir recurrentes solo en `cutmeat_recurrentes`
(Fase 1, ver `docs/CUTMEAT_RECURRENTES.md`). Tenían **0 filas** y
ninguna UI las usaba (`RecurringTab` ya usaba `saveRecurrente`/
`deleteRecurrente`/`markRecurrentePaid` de `actions/cutmeat-recurrentes.ts`).

Se retiraron en
`20261013141000_cutmeat_daily_drop_old_recurring_payments.sql`, después
de repuntar `cutmeat_daily_bank_movements.linked_recurring_id` (ver
arriba) y de eliminar las acciones `saveRecurringPayment`/
`deleteRecurringPayment` (que escribían en estas tablas, marcadas
`@deprecated`, sin ningún caller en la UI).

### `cutmeat_daily_income_projection`

Proyección de ingresos por día (pestaña "THIS WEEK"). `company_id`,
`projection_date`, `amount` (default 1500), **única** `(company_id, projection_date)`.
Ya no alimenta el Financial Report (ver `current_week_income` en
Settings más abajo) — queda como herramienta de planificación día por
día, sin cambios en esta tarea.

### `cutmeat_daily_aging_vendors` / `cutmeat_daily_aging_customers`

Un registro por informe — el total general (del PDF de QuickBooks).
`report_id` (UNIQUE, FK CASCADE), `raw_total`, `source_pdf_path`,
`extracted_at`, `source`/`loaded_by`/`loaded_at`, `updated_by`/`updated_at`.

### `cutmeat_daily_aging_vendor_items` / `cutmeat_daily_aging_customer_items`

Detalle del aging. `report_id` (FK, sin UNIQUE — muchas filas),
`vendor_name` / `customer_name`, `balance` (el total de ese nombre,
como siempre). Columnas nuevas, **todas opcionales** (aditivas, sin
romper el modo "solo total" de hoy):

| Columna | Tipo |
| --- | --- |
| `txn_date` | DATE |
| `txn_type` | TEXT |
| `num` | TEXT |
| `due_date` | DATE |
| `amount` | NUMERIC(14,2) |
| `open_balance` | NUMERIC(14,2) |

Un **nombre puede repetirse en varias filas** (una por factura) cuando
se carga el detalle — `groupAgingItems` (`lib/cutmeat-daily/calculations.ts`)
las agrupa por nombre con un subtotal (`sum(open_balance ?? balance)`)
para reproducir el PDF original (Vendor/Customer Balance Detail Report)
agrupado, con "Total for `<nombre>`" y el total general. Sin detalle
cargado (todas las columnas nuevas `NULL`), el PDF sigue siendo el
formato simple de siempre (nombre + balance) — no cambia.

Ejemplo de fila con detalle (ilustrativo, no cargado en la base):

```
vendor_name: "Acme Corp"
txn_date: 2026-09-01   txn_type: "Invoice"   num: "INV-001"
due_date: 2026-09-15   amount: 60.00         open_balance: 60.00
```

### `cutmeat_daily_vendor_config` / `cutmeat_daily_holidays`

Proveedores incluidos/excluidos del aging (`UNIQUE (company_id,
vendor_name)`) y feriados para la fecha sugerida del informe (`UNIQUE
(company_id, holiday_date)`).

La comparación entre el nombre del aging (PDF de QuickBooks) y el
nombre configurado se normaliza con `normalizeVendorName()`
(`lib/cutmeat-daily/calculations.ts`): minúsculas, sin comas ni puntos,
sin espacios de sobra. Así "Service Zone, Inc." (como viene del PDF) y
"Service Zone Inc." (como se escribe en Configuración) se consideran el
mismo proveedor, sin disparar la alerta "proveedor nuevo, sin
configurar" de `findUnconfiguredVendors`/`checkDailyReportCompleteness`
por una coma o un punto de diferencia. Se usa en
`findUnconfiguredVendors` y en `consolidateVendorAging` (el subtotal
excluido).

### `cutmeat_daily_settings`

Un registro por empresa. Columnas nuevas en **negrita**.

| Columna | Tipo | Default | Notas |
| --- | --- | --- | --- |
| `company_id` | UUID | — | UNIQUE, FK |
| `prime_meats_balance` | NUMERIC(14,2) | 0 | |
| `prime_meats_recurring` | NUMERIC(14,2) | 0 | |
| `default_daily_income` | NUMERIC(14,2) | 1500 | Ya no alimenta el Financial Report (ver abajo); queda para la pestaña "THIS WEEK" |
| `flat_weekly_income` | NUMERIC(14,2) | 9000 | Ingreso plano de las semanas **siguientes** (14/21-day) |
| **`gabriel_starting_balance`** | NUMERIC(14,2) | **0** | Balance GABRIEL del primer día **sin** ningún día cerrado anterior (ni en vivo ni en `cutmeat_daily_history`) |
| **`current_week_income`** | NUMERIC(14,2) | **7500** | Ingreso de la semana **en curso**, fijo toda la semana (ya no se prorratea por día ni se excluye el lunes) |
| `data_source` | TEXT | `'manual'` | `CHECK IN ('manual','quickbooks_api')` |

**Pendiente de confirmar:** `gabriel_starting_balance` quedó en el
default genérico (`0`) para Cut Meat Distributors — esta tarea no carga
datos reales, así que no se seteó al valor real conocido (27,224.20,
el arranque del 10/01 según `cutmeat_daily_history`). Hay que setearlo
desde Configuración (o decirle a Claude que lo cargue) antes de cerrar
el primer día en vivo del módulo, para que Balance GABRIEL no arranque
en $0.00 por error.

### `cutmeat_daily_generated_pdfs`

Sin cambios. `report_id` + `doc_type CHECK IN
('reconciliation','bank','consolidated','vendors','customers')` +
`version`, **única** `(report_id, doc_type, version)` — cada
regeneración crea una versión nueva, nunca pisa. Sin trigger de
bloqueo (ver "Bloqueo de escritura" arriba).

### `cutmeat_daily_variance_lines` (nueva)

Variación Diaria: líneas libres (concepto + monto), sin tipos fijos ni
clasificación automática — las carga el admin a mano, igual que hoy las
pone Hernan en la planilla ("Diferencia Pago Recurrentes (vendor)",
"First Bank - Service Charges", "Recurrentes de la Semana", "Aging",
cheques/depósitos sin cobrar puntuales).

| Columna | Tipo | Obligatoria |
| --- | --- | --- |
| `id` | UUID | sí (PK) |
| `report_id` | UUID | sí, FK `cutmeat_daily_reports` CASCADE |
| `concept` | TEXT | sí, 1-200 caracteres |
| `amount` | NUMERIC(14,2) | sí |
| `created_by` / `updated_by` | UUID | no |
| `created_at` / `updated_at` | TIMESTAMPTZ | sí |

**RLS:** admin + empresa (vía `report_id`), `FOR ALL` — sin excepción
para el cliente (igual que el resto de "Informes diarios"). **Trigger:**
bloquea escritura en días cerrados.

## Claves únicas para upsert idempotente

Auditadas contra cada `onConflict` usado en `actions/cutmeat-daily.ts` —
**ya existían todas**, no se agregó ninguna constraint nueva en esta
tarea:

| Acción | `onConflict` | UNIQUE declarada |
| --- | --- | --- |
| `saveReconciliation` | `report_id` | `cutmeat_daily_reconciliation.report_id UNIQUE` |
| `saveBankExport` | `report_id` | `cutmeat_daily_bank_export.report_id UNIQUE` |
| `saveAgingVendors` / `saveAgingCustomers` | `report_id` | `cutmeat_daily_aging_vendors/customers.report_id UNIQUE` |
| `saveIncomeProjection` | `company_id,projection_date` | `UNIQUE (company_id, projection_date)` |
| `saveVendorConfig` | `company_id,vendor_name` | `UNIQUE (company_id, vendor_name)` |
| `saveHoliday` | `company_id,holiday_date` | `UNIQUE (company_id, holiday_date)` |
| `saveCutMeatSettings` | `company_id` | `cutmeat_daily_settings.company_id UNIQUE` |
| `ensureDailyReport` (select-then-insert) | — | `UNIQUE (company_id, report_date)` protege la concurrencia |
| `generateDailyPdf` (versión nueva, nunca upsert) | — | `UNIQUE (report_id, doc_type, version)` |

## Función de solo lectura: `cutmeat_daily_controls(company_id, report_date)`

`SECURITY INVOKER` (no `DEFINER`): corre con los permisos de quien la
llama, respeta la RLS de admin+empresa sin necesitar su propio chequeo.
Ningún `INSERT`/`UPDATE`/`DELETE` — solo recomputa, desde los datos ya
guardados, 4 controles y devuelve `ok BOOLEAN` + cuál falla:

1. **`statement_balanced`** — Statement ending + uncleared checks +
   uncleared deposits − Register ≈ $0.00.
2. **`weekly_balanced`** — Register − recurrentes prior − recurrentes
   de la semana (de `cutmeat_recurrentes`, Fase 1 — no de la tabla
   vieja) ≈ Balance after Weekly Payments **congelado** de ese informe.
3. **`gabriel_balanced`** — Balance GABRIEL congelado de ese informe vs.
   el B del último día **cerrado** anterior (de `cutmeat_daily_history`
   o de un `cutmeat_daily_reports` cerrado en vivo, lo que sea más
   reciente).
4. **`not_entered_balanced`** — sin movimientos del banco "no
   ingresados" (ni vinculados a un recurrente ni marcados "Not entered
   Sales" todavía).

Cualquier control que no se pueda calcular (p. ej. el día no tiene
conciliación cargada, o no está cerrado — controles 2 y 3 solo tienen
sentido con el día ya cerrado) devuelve `NULL`/`false`, nunca un error.

```sql
select * from cutmeat_daily_controls(
  (select id from companies where slug = 'cut-meat-distributors'),
  '2026-10-09'
);
```

**Pendiente de confirmar:** la definición exacta de los 4 controles
("statement + sin cobrar = register; register + prior + semana = B;
Gabriel vs. B anterior; control de no ingresados") se interpretó como
arriba — en particular, "control de no ingresados" se tomó como
"ningún movimiento del banco sin clasificar" (ni vinculado a un
recurrente ni marcado explícitamente como depósito todavía no
ingresado a QuickBooks), que es el mismo concepto que ya usa
`checkDailyReportCompleteness` en pantalla. Si la intención era otra
(por ejemplo, una verificación distinta de "Balance + Not entered
Sales"), avisar para ajustarlo.

## Funciones SQL reutilizadas (no duplicadas)

- `is_admin()` / `is_cut_meat_company(uuid)` / `current_company_id()` —
  ya existían de migraciones anteriores del módulo y de Recurrentes/Paquete.
- `cutmeat_daily_block_closed_write()` — nueva en esta tarea, trigger de
  bloqueo (ver arriba).

## Storage

Bucket privado `cutmeat-daily` (`public: false`), política `FOR ALL`
solo `is_admin()` sobre `storage.objects`. Sin cambios en esta tarea —
sigue siendo el mismo bucket que usan los 5 PDF individuales y el
Paquete para el dueño (Fase 2), cada uno bajo su propio prefijo de ruta.
