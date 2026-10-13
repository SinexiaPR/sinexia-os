# Recurrentes e Historial diario — Cut Meat Distributors

Fase 1 del paquete de conciliación de Cut Meat Distributors (Wagyu Food
Service LLC): reemplaza la columna "Pagado" del Google Sheet mensual
(recurrentes) y deja cargado el backfill de la primera semana de octubre
2026 (historial diario). **No** es el módulo unificado de 5 informes; eso
es Fase 2 y depende de que esto corra con los tests en verde.

Distinto del módulo "Informes diarios" (`docs/DAILY_REPORTS_CUTMEAT.md`,
tablas `cutmeat_daily_*`): esa es la operación del día en curso (borrador/
cerrado/reabierto); esto es la lista de recurrentes del mes y el archivo
histórico de días ya cerrados. Comparten la empresa y reutilizan
`is_cut_meat_company()`, pero son dos conjuntos de tablas separados.

## Rutas

- `/dashboard/admin/companies/{companyId}/recurrentes?period=YYYY-MM-01` —
  editable (admin), solo lectura (Gabriel).
- `/dashboard/admin/companies/{companyId}/historial-diario` — solo
  lectura para todos (backfill, sin edición).

Ambas viven bajo `/dashboard/admin/...` pero **no** usan `requireAdmin()`:
usan `requireCutMeatAccess()` (`src/services/cutmeat-recurrentes.ts`), que
deja entrar a cualquier admin o al cliente de Cut Meat Distributors
(Gabriel, el dueño del negocio) y redirige a cualquier otro usuario. Hoy
no hay un botón en la navegación del portal cliente hacia estas rutas —
Gabriel entra por URL directa. Agregar esa entrada queda pendiente (no es
parte de esta fase).

## Modelo de datos

| Tabla                          | Rol                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `cutmeat_recurrentes`          | Un recurrente por fila: fecha, tipo, número, proveedor, vencimiento, monto, pagado, fecha/monto real de pago, notas |
| `cutmeat_recurrentes_history`  | Auditoría de cambios (`previous_value`/`new_value`, quién, cuándo)  |
| `cutmeat_daily_history`        | Un resumen por día cerrado (backfill): statement, cheques/depósitos sin cobrar, register, recurrentes, Balance after Weekly (B), Balance GABRIEL, aging |

RLS en ambos grupos de tablas:
- **Admin**: `is_admin() AND is_cut_meat_company(company_id)`, lectura y
  escritura (`FOR ALL`).
- **Gabriel**: `current_company_id() = company_id`, **solo lectura**
  (`FOR SELECT`). `current_company_id()` devuelve `NULL` para admins y
  para clientes de otra empresa, así que la política queda acotada sola
  sin necesidad de chequear el rol aparte.

Ambas funciones (`is_cut_meat_company`, `current_company_id`) ya existían
de migraciones previas (Informes diarios / facturación) — no se
duplicaron.

Migraciones: `20261013120000_cutmeat_recurrentes.sql` (+ seed en
`20261013121000_...`) y `20261013122000_cutmeat_daily_history.sql` (+ seed
en `20261013123000_...`).

## Reglas de cálculo (`src/lib/cutmeat-recurrentes/calculations.ts`)

Puras, sin acceso a Supabase. Semana domingo a sábado, igual convención
que "Informes diarios".

- `weekBucket(dueDate, referenceDate)`: `"antes"` si el vencimiento es de
  una semana ya pasada respecto de `referenceDate`, `"sin_fecha"` si no
  tiene vencimiento, o el domingo de su propia semana.
- `totalsByWeek(recurrentes, referenceDate, weeksAhead)`: suma solo los
  **pendientes** (`pagado = false`) -- uno pagado nunca suma, sale del
  pendiente apenas se marca.
- `markPaid(recurrente, { paid, paidDate, paidAmount })`: desmarcar limpia
  fecha y monto real. Marcar sin un monto real distinto informado asume
  que se pagó el monto recurrente completo (sin variación) -- nunca deja
  el pago "sin monto".
- `pendingToConfirm(recurrentes, asOfDate)`: pendientes con vencimiento
  `<= asOfDate` -- la pantalla la usa con la fecha de hoy.
- `paidVariance(recurrente)`: `monto recurrente − monto real pagado`
  (positivo = favorable), para la futura Variación Diaria del paquete
  unificado.
- `shiftPeriod(date, monthsForward)`: la misma fecha un mes después --
  usada por "Copiar recurrentes del mes anterior".

## Caso de validación: octubre 2026 al cierre del 09/10

Con los 16 recurrentes cargados (ver migración de seed para el detalle
fila por fila):

| Total                          | Valor      |
| ------------------------------- | ---------- |
| Antes de la semana 04/10-10/10 | 2,829.00   |
| Semana 04/10-10/10             | 1,180.00   |
| Semana 11/10-17/10             | 580.00     |
| Semana 18/10-24/10             | 0.00       |
| **Total recurrentes a pagar**  | **4,589.00** |

Historial diario 01/10-09/10 (backfill desde Drive, carpeta
`1z2y7paYg8K-fSNYkO80Tr74mnbaCDbu-`): cada día cumple
`statement + cheques sin cobrar + depósitos sin cobrar = register` y
`register + recurrentes prior + recurrentes de la semana = Balance after
Weekly Payments (B)`, y `Gabriel[día] = B[día anterior]` (el 10/01 es la
única excepción -- no hay día anterior en esta tabla, se usa el valor del
PDF, 27,224.20).

## Interpretaciones hechas al cargar los datos (revisar contra el Sheet)

- `"ACH-<num> <banco/contraparte>"` se separó en `tr_type = 'ACH'` y
  `num = '<num> <banco/contraparte>'` (Depósito Oriental Bank, PenFed,
  Depósito Jose Manzanares/Plaza las Cumbres).
- PenFed (ítem 6) y SINERGIA LLC del 10/09 (ítem 13) estaban marcados
  PAGADO sin un monto real distinto informado -- se cargó
  `paid_amount = amount` (sin variación) en vez de dejarlo vacío.
- SINERGIA LLC del 10/09 no tenía fecha de pago bancario informada --
  `paid_date` quedó en `NULL` con una nota, en vez de inventar una fecha.
  **Pendiente de confirmar.**
- "Departameno de Hacienda" se cargó como "Departamento de Hacienda"
  (typo evidente en el nombre de la agencia).
- `uncleared_deposits_after` del historial diario se cargó en 0 para los
  7 días de esta semana: la ecuación de control cierra exacta sin
  necesitarlo, y el Reconciliation Report no distingue ese valor para
  estos días.
- `pdf_source_id` del historial diario guarda el ID de la **carpeta** de
  Drive de octubre (no hay un ID de archivo por día en los datos
  recibidos).

## Cómo probar

```bash
npm run test:cutmeat-recurrentes
```

Verifica los 5 totales, `pendingToConfirm` al 10/12, `markPaid`,
`shiftPeriod`, la Variación Diaria de los recurrentes pagados, el balance
aritmético de los 7 días del historial, y el aislamiento entre empresas
(RLS admin+empresa, Gabriel solo `SELECT`, acciones de escritura exigen
`requireAdmin()`).

## Pendiente / por confirmar

- Revisar con María las interpretaciones de la sección anterior (split de
  `tr_type`/`num`, `paid_amount` asumido para PenFed y SINERGIA LLC,
  `paid_date` faltante de SINERGIA LLC).
- Entrada de navegación para Gabriel hacia estas rutas desde el portal
  cliente (hoy solo por URL directa).
- Variación Diaria como pantalla propia (líneas libres: concepto + monto,
  sin tipos fijos) -- queda para cuando se construya, no en esta fase.
- Fase 2: el "Paquete para el dueño" (un solo PDF con los 5 informes,
  portada resaltada) se construye después de validar esta fase.
