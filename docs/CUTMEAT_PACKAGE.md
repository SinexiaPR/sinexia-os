# Paquete para el dueño — Cut Meat Distributors

Fase 2 del paquete de conciliación de Cut Meat Distributors (Wagyu Food
Service LLC): un solo PDF que une los 5 informes diarios ya existentes
("Informes diarios", `docs/DAILY_REPORTS_CUTMEAT.md`) con portada
resaltada, más una imagen de la portada para compartir por WhatsApp
(nunca enviada automáticamente — solo generar y descargar).

Depende de que la Fase 1 (`docs/CUTMEAT_RECURRENTES.md`) corra con los
tests en verde; no cambia nada de esa fase ni de "Informes diarios" — los
reutiliza tal cual están.

## Ruta y acceso

`/dashboard/admin/companies/{companyId}/paquete-dueno?date=YYYY-MM-DD`

Usa `requirePackageAccess()` (`src/services/cutmeat-report-packages.ts`),
la misma regla de acceso que Recurrentes (Fase 1): admin lee y escribe,
Gabriel (el cliente de esta empresa) solo lee/descarga. A diferencia de
"Informes diarios" (admin-only sin excepción), por eso vive en su propia
ruta.

- **Generar / regenerar** (`POST /api/cutmeat-reports/{companyId}/{reportDate}/package/pdf`):
  solo admin — **403** si el que llama es Gabriel.
- **Descargar PDF** (`GET` de la misma ruta) y **descargar portada PNG**
  (`GET /api/cutmeat-reports/{companyId}/{reportDate}/package/cover`):
  admin o Gabriel. Un `GET` de admin sin paquete generado todavía lo
  genera al vuelo; un `GET` de Gabriel sin paquete generado devuelve 404
  (nunca genera).
- **Marcar enviado al dueño** (`markSentToOwner`, server action): solo
  admin.

## Orden del paquete

1. **Portada** = última hoja del Consolidado (Financial Report / Daily
   Variation), con 3 cifras resaltadas en amarillo semitransparente.
2. Reconciliation Report
3. Export (Bank)
4. Consolidado, **sin** su última hoja (ya es la portada — no se repite)
5. Aging Vendors
6. Aging Customers

El total de páginas del paquete es siempre la suma de páginas de los 5
PDF individuales — la portada se reutiliza, nunca se duplica. El conteo
de páginas nunca se hardcodea (`src/lib/cutmeat-reports/package/plan.ts`,
función pura `buildPackagePlan`): Aging Customers varía según facturas
abiertas, así que el plan se calcula a partir de `pageCounts` reales de
cada PDF ya generado.

## Resaltado de la portada

`src/lib/cutmeat-reports/package/highlights.ts` (función pura
`applyHighlights`) dibuja un rectángulo amarillo semitransparente
(`rgb(1, 0.92, 0.23)`, opacidad 0.45) **encima** del texto ya copiado —
nunca lo reescribe ni lo borra, así que el texto extraíble de la página
no cambia (verificado en el test comparando antes/después con
`pdf-parse`).

Lista por defecto (`DEFAULT_PACKAGE_HIGHLIGHTS`), configurable en un solo
lugar:

- Total First Bank Accounts
- Aging Vendors – Consolidated Total
- Aging Customers – Consolidated Total

**Pendiente de confirmar con María**: esta es la lista que pide la tarea,
pero el propio código la deja marcada como "todavía falta confirmar con
María cuáles resalta el dueño" — no se asumió que sea definitiva.

Las coordenadas (`xEnd`, `y`, `fontSize`) están fijas al layout actual de
la página 2 de `buildConsolidatedPdf` (`src/lib/cutmeat-daily/pdf.ts`). Si
ese layout cambia, estas constantes se tienen que actualizar junto con
él — quedan documentadas en el propio archivo.

## Bugfix necesario en el Consolidado (flaggeado)

El caso de validación de esta fase (día 09/10/2026) exige que "Total First
Bank Accounts" aparezca resaltado en la portada con un valor real. Al
implementar el resaltado se encontró que `buildConsolidatedPdf`
(`src/lib/cutmeat-daily/pdf.ts`) dibujaba esa fila con el valor vacío
(`""`) en vez de `money(financial.balanceToday)` — un bug preexistente,
no introducido por esta fase. Se corrigió esa única línea (y se exportó
`money` para reutilizarla desde `highlights`/el servicio) porque sin eso
el caso de validación es imposible de cumplir. No se tocó ningún otro
cálculo ni ninguna otra línea de los 5 PDF individuales.

## Portada como imagen (PNG)

`src/lib/cutmeat-reports/package/render.ts` (`renderPdfPageToPng`) renderiza
la página 1 del PDF del paquete **ya generado** — nunca recalcula nada por
separado — a PNG con `pdfjs-dist` + `@napi-rs/canvas`, ancho mínimo
1600px, fondo blanco, sin recortar márgenes. Se genera y guarda junto con
el PDF en cada llamada a `buildAndStorePackage`; se descarga desde
`GET .../package/cover`.

**Nunca se envía a nadie automáticamente** — ni por WhatsApp ni por
email. Solo se genera y queda disponible para que el admin o Gabriel la
descarguen manualmente.

## Bloqueo de generación

El botón "Generar"/"Regenerar" (y el `POST` que dispara) solo están
habilitados si, para ese día:

1. El informe de "Informes diarios" está **cerrado** (`status = "closed"`).
2. No hay **alertas abiertas** — reutiliza exactamente las mismas alertas
   que ya se muestran en "Informes diarios"
   (`checkDailyReportCompleteness`, vía `getDailyReportWorkspace`), no se
   inventa un segundo criterio de completitud.

`checkPackageEligibility` (`src/services/cutmeat-report-packages.ts`)
centraliza esta regla; `buildAndStorePackage` la vuelve a chequear antes
de generar (defensa en profundidad si alguien llama al servicio
directamente) y lanza `PackageNotEligibleError` si no se cumple.

## Modelo de datos

| Tabla                     | Rol                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `cutmeat_report_packages` | Una fila por versión generada: `storage_path` (PDF), `cover_image_path` (PNG), `content_hash` (SHA-256), `generated_by`/`generated_at`, `sent_to_owner`/`sent_marked_by`/`sent_marked_at` |

RLS (igual patrón que Recurrentes — reutiliza `is_admin()`,
`is_cut_meat_company()`, `current_company_id()`, ya existentes, no
duplicadas):

- **Admin**: `is_admin() AND is_cut_meat_company(company_id)`, lectura y
  escritura (`FOR ALL`).
- **Gabriel**: `current_company_id() = company_id`, **solo lectura**
  (`FOR SELECT`).

`UNIQUE (company_id, report_date, version)` — cada generación crea una
versión nueva (`version = última + 1`), nunca pisa ni sobrescribe una
anterior.

El PDF y el PNG se suben al mismo bucket privado que los 5 PDF
individuales (`cutmeat-daily`), bajo su propio prefijo de ruta
(`{companyId}/{reportDate}/package/vN-...`). La descarga pasa siempre por
las rutas de API (URL firmada de corta duración, 120s), nunca por acceso
directo al bucket desde el cliente.

Migración: `20261013124000_cutmeat_report_packages.sql`.

## Caso de validación: 09/10/2026

Con el día 09/10/2026 cerrado en "Informes diarios":

| Cifra                                   | Valor      |
| ----------------------------------------- | ---------- |
| Total First Bank Accounts (Balance hoy)  | 35,126.77  |
| Aging Vendors – Consolidated Total       | 20,905.79  |
| Aging Customers – Consolidated Total     | 16,658.08  |

Las 3 deben aparecer resaltadas en amarillo en la portada del paquete de
ese día.

**No se generó un paquete real end-to-end contra datos reales de
"Informes diarios"**: ese módulo todavía no tiene ningún día de octubre
cargado y cerrado en producción (la carga real de datos es tarea
separada). El caso de validación se verificó con un PDF de prueba
construido en el test (mismo texto/formato que dibuja
`buildConsolidatedPdf`), no contra el pipeline completo con datos reales
— queda pendiente de verificar en cuanto haya al menos un día cerrado de
verdad.

## Cómo probar

```bash
npm run test:cutmeat-package
```

Verifica: orden del plan (portada = última hoja del Consolidado, sin
duplicarla), que el total de páginas sea siempre la suma de los 5 PDF
(con Aging Customers de 1 a 3 páginas), que `applyHighlights` no altere
el texto extraíble de la página, el formato de las 3 cifras del caso de
validación, que la portada renderizada sea un PNG válido de >= 1600px de
ancho, y el control de acceso/bloqueo estático (403 a Gabriel al generar,
admin y Gabriel pueden descargar, el bloqueo está enchufado a las mismas
alertas de "Informes diarios", los 5 builders de PDF individuales no se
tocan para armar el paquete).

## Pendiente / por confirmar

- Confirmar con María la lista definitiva de cifras a resaltar en la
  portada (hoy: First Bank Accounts, Aging Vendors y Aging Customers
  consolidados — es la lectura de la tarea, no una decisión cerrada).
- Verificar el caso de validación del 09/10/2026 contra el pipeline
  completo en cuanto "Informes diarios" tenga ese día realmente cargado y
  cerrado en producción (hoy no lo tiene).
- Las coordenadas de resaltado están atadas al layout actual de la página
  2 del Consolidado; si ese PDF cambia de diseño, hay que actualizarlas.
- Entrada de navegación para Gabriel hacia esta ruta desde el portal
  cliente (hoy, igual que Recurrentes, solo por URL directa).
