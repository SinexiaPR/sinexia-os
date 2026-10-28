# Auditoría Fase 0 — Rediseño UX/UI de Sinexia OS

Fecha: 2026-10-28 · Base: `main` @ `445bfcf` · Stack: Next.js 15 (App Router) + React 19 + Tailwind 4 + Supabase + Radix (parcial) + lucide-react.

Línea base antes de tocar nada: `npm run typecheck` y `npm run lint` pasan sin errores.

## 1. Cómo se verificó

- Lectura del código de rutas, layouts, navegación y componentes de cada pantalla señalada.
- Servidor local levantado con variables ficticias: solo se pueden renderizar las pantallas **públicas** (portada y login). Las pantallas autenticadas necesitan credenciales de Supabase que este entorno no tiene (`.env` no existe; solo `.env.example`). No se conectó nada a producción: sería acceso a datos reales de clientes y no estaba autorizado.
- Capturas "antes" disponibles: `docs/redesign/before/portada-{1440,390}.png` y `login-{1440,390}.png`. **Pendiente**: las pantallas autenticadas (ver §5).

## 2. Inventario de rutas

| Ruta | Archivo | Roles |
|---|---|---|
| `/` | `(marketing)/page.tsx` | público |
| `/login` | `(auth)/login/page.tsx` | público |
| `/dashboard` | `(dashboard)/dashboard/page.tsx` → `AdminDashboard` / `ClientDashboard` | ambos |
| `/dashboard/inbox` | `inbox/page.tsx` | ambos |
| `/dashboard/reports` | `reports/page.tsx` | ambos |
| `/dashboard/calendar` | `calendar/page.tsx` | admin |
| `/dashboard/payroll` | `payroll/page.tsx` (Sibarita/Tresbe; admin con `?company=`) | ambos |
| `/dashboard/invoices` | `invoices/page.tsx` | cliente |
| `/dashboard/sia`, `/dashboard/profile` | | cliente / ambos |
| `/dashboard/admin/companies/[id]` | ficha de empresa | admin |
| `…/[id]/{payroll,nomina,budget,invoices,informes,daily-reports,historial-diario,recurrentes,paquete-dueno,[category]}` | módulos por empresa (según `slug`) | admin |
| `/dashboard/admin/invoices` (+ `new`, `batch`, `billing-clients`, `[id]`, `[id]/preview`) | facturación global | admin |
| `/dashboard/admin/settings/billing` | configuración de facturación | admin |
| `/dashboard/admin/leave-accrual` (+ `[system]/[employeeId]`) | Vacaciones y enfermedad (ya fuera del menú desde `7a776d8`) | admin |

Componentes de UI existentes (`src/components/ui`): avatar, badge, button, card, checkbox, collapsible-section, dropdown-menu, input, label, nav-badge, scroll-area, separator, sheet, surface-card, tooltip, underline-tabs. Radix instalado: avatar, checkbox, dialog, dropdown-menu, label, scroll-area, separator, slot, tooltip. **No hay** tabs, accordion, popover, combobox, toast, skeleton, table ni modal propios.

## 3. Hallazgos verificados en el código

| # | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| 1 | Nav admin plana de 6 ítems, sin grupos ni búsqueda | **Confirmado** | `src/config/navigation.ts:52-68` |
| 2 | Idiomas mezclados | **Confirmado** | `navigation.ts` (Dashboard/Inbox/Reports/Profile), `admin-sidebar.tsx:34` ("Admin workspace"), `admin-document-filters.tsx` (All companies, Routine, Urgent, Clear), `document-row-client.tsx:78-82`, `inbox/page.tsx`, `reports/page.tsx` (Publish report…), `admin-report-form.tsx` (Company, Category, Period…), metadata de `login` ("Sign in") |
| 2b | Valores internos crudos (`not_configured`) | **Confirmado** | `invoice-list.tsx` pinta `invoice.email_status` sin mapear; el mapeo existe solo en `companies/[id]/invoices/page.tsx:29` |
| 3a | "Reports" (menú) vs "Subir reporte" (ficha) | **Confirmado** | ficha → `/dashboard/reports?company=` |
| 3b | "Inbox" (menú) vs "Ver documentos" (ficha) | **Confirmado** | ficha → `/dashboard/inbox?company=` |
| 3c | "Vacaciones y enfermedad" como enlace en el Dashboard | **No confirmado en código**: el commit `7a776d8` ya la sacó del menú y no hay enlace en `admin-client-cards`/servicio. Puede ser una versión de producción desfasada. Sí existe como bloque dentro de Nómina (`payroll/page.tsx:62-80`) | |
| 4 | Una tarjeta por cliente, sin KPIs ni jerarquía | **Confirmado** | `admin-dashboard.tsx` + `admin-client-cards.tsx` (grid de `SurfaceCard`, semáforo solo verde/ámbar) |
| 5 | Ficha de empresa pobre | **Confirmado** (más densa de lo descrito para Sibarita/Cut Meat, que ya tienen acordeones). Sin pestañas; botones por `slug` hardcodeados; `▸` del `<details>` | `admin/companies/[companyId]/page.tsx` (395 líneas, tres ramas duplicadas) |
| 6 | Tabla de facturas de 10 columnas, sin paginación | **Confirmado** | `invoice-list.tsx:132-142`; filtra el array completo en cliente |
| 7 | 5 selects + fechas visibles; 4 botones sin jerarquía | **Confirmado** (4 selects + búsqueda + 2 fechas) | `invoice-list.tsx:84-140`, `admin/invoices/page.tsx:20-39` |
| 8 | Vencimiento = emisión | **Confirmado, es regla de negocio** | `src/actions/invoices.ts:131` (`due_date: value.invoiceDate`). **No se toca.** |
| 9 | Filas Legacy mezcladas | **Confirmado** | `invoice.is_legacy_import` solo añade un texto "Legacy" |
| 10 | Inbox: 4 selects + Filter/Clear | **Confirmado** | `admin-document-filters.tsx` (4 `<select>`), mensaje vacío en inglés |
| 11 | Reports: formulario fijo + diagnóstico expuesto + lista al final | **Confirmado** | `reports/page.tsx:50-95` (`AdminReportForm`, `AdminIntegrityCheck` antes de la lista) |
| 12 | Calendario: filtros siempre visibles; agenda sin tope | **Confirmado** | `calendar-board.tsx:322-405` (búsqueda + 5 selects + 2 fechas); vistas Mes/Semana/Agenda con la misma lista |
| 13 | Nómina apilada | **Confirmado** | `payroll/page.tsx` apila `PayrollWorkspace` (867 líneas) + `LeaveAccrualReport` |
| 14 | Alerta "Revisar tarifa" escondida en la lista | **Confirmado**: es una etiqueta inline en la fila del empleado | `payroll-workspace.tsx:272` |

### Hallazgos adicionales del código

- **Menú cliente**: Dashboard · [Nóminas solo Tresbe] · [Facturas si habilitado] · Inbox · Reports · SinexIA · Profile = hasta **7 ítems** (`client-nav.tsx`). Excede el máximo de 5 pedido.
- Fecha del dashboard formateada con zona `America/Argentina/Cordoba` (`admin-client-cards.tsx`) mientras el resto usa `America/Puerto_Rico`. No se cambia en silencio; se reporta.
- Tipografía Geist (`--font-geist-sans`), paleta oklch neutra con primario azul marino; `@custom-variant dark` declarado pero **sin tokens oscuros**.
- Cifras monetarias con `Intl.NumberFormat("en-US")` y sin `tabular-nums` en la tabla de facturas.
- `admin/companies/[companyId]/page.tsx` duplica ~60 líneas de tarjetas de categorías (acordeón / no acordeón).
- Componentes `<select>` nativos con clases repetidas en 4 archivos.

## 4. Decisiones de librería

- Base existente: shadcn/Radix + CVA + `tailwind-merge`. Se mantiene.
- Se propone añadir **solo** primitivas Radix de la misma familia que ya se usa: `@radix-ui/react-tabs`, `@radix-ui/react-accordion`, `@radix-ui/react-popover`. Alternativa sin dependencias: construir tabs/accordion con `<details>`/ARIA a mano (más código propio, más riesgo de a11y). Recomendado: las tres de Radix.
- Paleta de comandos y combobox con búsqueda: se construyen sobre `@radix-ui/react-dialog` (ya instalado), sin `cmdk`.
- Íconos: `lucide-react` (único set, ya en uso). Fuente: Geist (equivalente moderno a Inter; se mantiene).
- Toasts: sin librería; componente propio mínimo.

## 5. Bloqueos y decisiones que requieren a la dueña

1. **Capturas autenticadas y pruebas de aislamiento admin/cliente**: requieren un Supabase de pruebas (o credenciales de lectura) y dos usuarios de prueba (admin y cliente). No se hizo nada contra producción. Opciones: (a) proyecto Supabase de staging/branch con `npm run seed:users`; (b) preview de Vercel con usuarios de prueba. Mientras tanto se usará una página de vista previa local con datos ficticios (no se commitea) para verificar visualmente.
2. **Nombre de rama**: el prompt pide `feature/rediseno-ux`, pero esta sesión está fijada a `claude/beautiful-albattani-pv3zvf` y no puedo empujar a otra sin permiso. Se trabaja en la asignada; renombrarla al fusionar es trivial.
3. **Vencimiento = emisión** (hallazgo 8): se reporta en el resumen final; no se modifica.
