# Presupuesto / Forecast — Tresbe

Módulo interno (solo admin) que reemplaza las dos Google Sheets que se cruzaban
a mano: `TRESBE_Seguimiento_Diario` (movimientos reales) y
`TRESBE-CASHFLOW OPERATIVO-SEMANAL` (forecast a 13 semanas).

Ruta: `/dashboard/admin/companies/{companyId}/budget`
(vista imprimible en `.../budget/print?week=YYYY-MM-DD`).

## Qué corrige respecto de la planilla

| Problema original                                               | Cómo se resuelve                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los depósitos Clover se cargaban en "Cash Disponible"           | `Credit Card Disponible` es su propia categoría; al escribir "Clover" la carga la sugiere automáticamente                                               |
| Los barridos de la línea de reserva inflaban ingresos y egresos | Categoría `Movimiento Línea de Reserva` marcada `is_financing`: queda fuera de los totales operativos y solo entra en el saldo real del control de caja |
| El presupuesto se pegaba a mano entre archivos                  | Se genera desde supuestos configurables (`Generar presupuesto de la semana`)                                                                            |
| El "Resumen Semanal" nunca se conectó                           | Se calcula sobre los mismos movimientos y presupuesto, semana por semana                                                                                |
| Los campos manuales del control de caja nunca se completaban    | Viven en `tresbe_budget_cash_control`, uno por semana, visibles arriba del bloque                                                                       |

El payroll tax se calcula sobre la nómina de la semana y cae `payroll_tax_offset_days`
después del pago (por defecto, el jueves siguiente al miércoles de nómina). La
planilla lo pegaba el mismo miércoles.

## Modelo de datos

| Tabla                            | Rol                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `tresbe_budget_categories`       | Las 9 categorías fijas (8 originales + financiamiento)                                |
| `tresbe_budget_movements`        | Libro diario de movimientos reales                                                    |
| `tresbe_budget_entries`          | Presupuesto por día y categoría, con `origin` `calculado`/`manual`                    |
| `tresbe_budget_entry_revisions`  | Historial automático de cada cambio de importe u origen                               |
| `tresbe_budget_cash_control`     | Saldo inicial, saldo bancario real y caja mínima por semana                           |
| `tresbe_budget_settings`         | Comisión, retención, lag de tarjeta, nómina, payroll tax, ancla y largo del horizonte |
| `tresbe_budget_sales_pattern`    | Venta bruta y % tarjeta por día de la semana                                          |
| `tresbe_budget_recurring_debits` | Débitos fijos (frecuencia, día, confianza, activo)                                    |
| `tresbe_budget_vendor_schedule`  | Qué proveedor se paga cada día de la semana                                           |

La semana operativa va de lunes a domingo; `week_start` se deriva por trigger de
la fecha, nunca se escribe a mano. El número de semana se cuenta desde
`tresbe_budget_settings.week_one_start`.

Todas las tablas tienen RLS: solo `is_admin()` sobre la empresa con slug
`tresbe`. El módulo no es visible para el portal del cliente.

## Reglas de cálculo

- **Real**: suma de `tresbe_budget_movements` por categoría y fecha.
- **Presupuesto**: `tresbe_budget_entries` por categoría y fecha.
- **Desvío** (positivo = favorable): en ingresos `Real − Presupuesto`; en egresos
  `Presupuesto − Real`.
- **Total Ingresos** = Credit Card + Cash. **Total Egresos** = Proveedores +
  Recurrentes + Reembolsos + Nómina + Payroll Taxes + Débitos Bancarios.
  **Flujo Neto** = Ingresos − Egresos. El financiamiento no entra en ninguno.
- **Saldo Final Teórico (Real)** = Saldo inicial + Flujo Neto real + neto de la
  línea de reserva. **Diferencia a Conciliar** = Saldo Banco Real − ese teórico.
  **Excedente / Necesidad** = teórico − Caja Mínima Objetivo.

## Generación del presupuesto

`buildForecastForWeek()` (`src/lib/tresbe-budget/forecast.ts`) arma las celdas:

- Efectivo del día = venta bruta × (1 − % tarjeta).
- Tarjeta disponible el día D = venta con tarjeta de D − `lag` días, neta de
  comisión del procesador y retención de préstamo.
- Nómina el día configurado (+ el cash out de la entidad relacionada si está
  habilitado); payroll tax `offset` días después, sobre la nómina de Tresbe.
- Débitos recurrentes y calendario de proveedores según su día, con corrimiento
  opcional si cae fin de semana.

Las celdas con `origin = 'manual'` no se pisan al regenerar; hay un botón
aparte, con confirmación, para forzarlo.

## Verificación

```bash
npm run test:tresbe-budget
```

Lee los movimientos reales de la migración de semilla
(`20260901010000_tresbe_budget_seed_week_20260824.sql`) y comprueba los
criterios de aceptación: los ingresos de la semana del 24–30 de agosto de 2026
pasan de $34,185.38 (con Clover y los barridos mezclados) a $21,468.84
operativos, la reserva queda afuera pero suma en el saldo real, y el payroll tax
generado cae el jueves.

## Pendiente (fuera de v1)

- Conciliación automática contra un feed bancario: `Saldo Banco Real` sigue
  siendo manual.
- LADO CE / Calle Cerra como entidad propia: hoy solo se registra su cash out
  dentro del forecast de nómina de Tresbe, igual que en la planilla.
- Forecast de ventas basado en histórico real en vez del patrón fijo por día.
- El calendario de proveedores llegó sin importes por día en la especificación:
  hay que cargarlos desde la pestaña **Supuestos** para que el presupuesto
  generado incluya compras y recurrentes.
