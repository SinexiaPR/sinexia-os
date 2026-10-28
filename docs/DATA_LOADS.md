# Cargas operativas de datos

Desde octubre de 2026 las cargas de datos operativos (nóminas, movimientos de banco, aging, presupuestos, etc.) **no se hacen como migraciones**. Las migraciones (`supabase/migrations/`) son solo para cambios de esquema, políticas y funciones. Las cargas se ejecutan como SQL puntual y **cada una se registra** en `public.data_load_log`.

> No se migró el historial anterior: las migraciones `*_seed_*` / `*_data.sql` existentes se quedan como están y no tienen fila en el registro.

## Por qué

- Una migración que carga datos de producción no corre en una base vacía (por eso no hay validación de migraciones en CI), y mezcla "cambio de esquema" con "dato".
- Una migración no deja claro quién cargó, de qué fuente ni cuántas filas.

## Tabla `public.data_load_log`

| Columna           | Contenido                                                                      |
| ----------------- | ------------------------------------------------------------------------------ |
| `id`              | UUID de la carga                                                               |
| `company_id`      | Empresa dueña de los datos (obligatorio)                                       |
| `modulo`          | Módulo afectado, p. ej. `cutmeat_daily`, `tresbe_budget`, `sibarita_payroll`   |
| `fuente`          | De dónde salieron los datos, p. ej. `Export banco 2026-10-27`, `QuickBooks AR` |
| `descripcion`     | Qué se cargó y por qué (rango de fechas, tablas, aclaraciones)                 |
| `filas_afectadas` | Filas insertadas/actualizadas; si fueron varias tablas, el total               |
| `cargado_por`     | `auth.uid()` de quien cargó; `NULL` si corrió con service role / SQL editor    |
| `cargado_en`      | Fecha y hora (UTC)                                                             |

Es **append-only** para la aplicación: los administradores leen e insertan, y no tienen permiso de actualizar ni borrar (solo mantenimiento con service role podría). Los clientes no ven nada. Si una carga se hizo mal, se corrige con una carga nueva y su propia fila; no se edita el registro anterior.

## Procedimiento

1. Prepara el SQL de la carga (idempotente si es posible: `ON CONFLICT ... DO UPDATE/NOTHING`).
2. Ejecútalo **en una sola sentencia/transacción** junto con `public.log_data_load(...)`, de modo que la carga y su registro se confirmen juntos o no se confirme ninguno.
3. Verifica el resultado con el control de `integrity_checks` del módulo, si existe.

Plantilla (un solo `INSERT`; `filas_afectadas` sale del propio `RETURNING`):

```sql
WITH cargadas AS (
  INSERT INTO public.cutmeat_daily_bank_movements (company_id, report_date, /* ... */)
  SELECT c.id, v.report_date /* , ... */
    FROM public.companies c
    CROSS JOIN (VALUES (DATE '2026-10-27' /* , ... */)) AS v(report_date /* , ... */)
   WHERE c.slug = 'cut-meat-distributors'
  ON CONFLICT DO NOTHING
  RETURNING 1
)
SELECT public.log_data_load(
  (SELECT id FROM public.companies WHERE slug = 'cut-meat-distributors'),
  'cutmeat_daily',
  'Export banco 2026-10-27',
  'Movimientos bancarios del 2026-10-27',
  (SELECT count(*)::int FROM cargadas)
);
```

Para cargas de varias tablas, usa un bloque `DO $$ ... $$` o varias CTE y suma las filas de todas en `filas_afectadas`.

Reglas:

- Resuelve `company_id` por `slug` (`SELECT id FROM public.companies WHERE slug = ...`); no pegues UUID a mano ni los generados.
- Una fila de registro por carga. No reutilices una fila para cargas distintas.
- Ejecútala con la sesión de un administrador (queda `cargado_por`) o con service role (queda `NULL`).
- Un cliente que intente llamar `log_data_load` recibe un error de RLS; la función es `SECURITY INVOKER`.

## Consultar el registro

```sql
SELECT cargado_en, c.name AS empresa, modulo, fuente, filas_afectadas, descripcion
  FROM public.data_load_log l
  JOIN public.companies c ON c.id = l.company_id
 ORDER BY cargado_en DESC
 LIMIT 50;
```
