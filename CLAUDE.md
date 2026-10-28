# Sinexia OS

Portal interno de Sinexia (firma de servicios administrativos, Puerto Rico): clientes suben documentos, reciben reportes y consultan a SinexIA (asistente sobre documentos). Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4 + Supabase (Postgres/Auth/Storage/RLS). OpenAI solo en servidor y opcional.

## Comandos

- `npm run typecheck` y `npm run lint` antes de dar algo por terminado.
- `npm run format:check` (Prettier).
- Tests: scripts `tsx` en `scripts/` (`npm run test:<nombre>`, ver `package.json`). Corre solo el del área que tocas.
- No hay build ni dev server que valga la pena levantar para cambios de lógica.

## Estructura

- `src/actions/` Server Actions (mutaciones). Una por dominio: payroll, invoices, cutmeat-*, tresbe-*, documents, etc.
- `src/services/` lectura de datos para Server Components.
- `src/lib/<dominio>/` lógica pura de cada dominio (cálculos, validadores, PDFs). Aquí vive la lógica que se testea.
- `src/lib/intelligence/` pipeline SinexIA (extracción, clasificación, embeddings, retrieval, caché GPT).
- `src/app/(auth|dashboard|marketing)/` rutas. `supabase/migrations/` esquema y RLS.

## Reglas del proyecto

- UI de cara al cliente en español.
- Aislamiento por empresa (`company_id`) se impone en RLS, no solo en la UI. Toda tabla o consulta nueva debe respetarlo.
- Service role solo en servidor. Nunca exponer `OPENAI_API_KEY` ni claves de Supabase al cliente.
- Cambios de esquema = migración nueva en `supabase/migrations/`, nunca editar una ya aplicada.
- Cuadres de dinero: lógica determinística y con test, no depender de IA.
- Commits y PRs en español, formato `Área: qué cambia (#PR)`.

## Interfaz (rediseño UX)

- Sistema de diseño y reglas de uso: `docs/redesign/DESIGN_SYSTEM.md`. Componentes en `src/components/ui/`.
- Etiquetas legibles de valores internos (estados, prioridades, tipos): `src/lib/labels.ts`; no mostrar enums crudos.
- Navegación en `src/config/navigation.ts` (admin: 6 ítems; cliente: máx. 5). La ficha de empresa tiene pestañas por módulo en `src/lib/companies/tabs.ts`.
- Lógica pura de pantallas con test: `test:admin-home`, `test:company-tabs`, `test:invoice-list`, `test:calendar-agenda`.
- Varios tests (`test:invoice-visibility`, `test:billing-batch`, `test:company-workspace`) leen el código fuente de componentes: si mueves un texto o un enlace de lugar, actualiza el test.

## Documentación por tema (lee solo la que toque)

| Si trabajas en… | Lee |
|---|---|
| Arquitectura, auth, storage | `docs/ARCHITECTURE.md` |
| Reportes diarios Cut Meat | `docs/DAILY_REPORTS_CUTMEAT.md`, `docs/CUTMEAT_DAILY_DATA_CONTRACT.md` |
| Cut Meat recurrentes / paquete | `docs/CUTMEAT_RECURRENTES.md`, `docs/CUTMEAT_PACKAGE.md` |
| Presupuesto Tresbe | `docs/BUDGET_TRESBE.md` |
| Facturación | `docs/INVOICING.md` |
| Calendario | `docs/CALENDAR.md` |
| Clientes | `docs/CLIENTS.md` |
| Deploy | `docs/DEPLOYMENT.md` |
| Seguridad | `docs/SECURITY_QA_AUDIT.md` |

## Cómo trabajar aquí (ahorro de tokens)

- Busca con Grep/Glob antes de leer archivos enteros; lee por rango de líneas.
- No leas `package-lock.json`, `.next/`, `node_modules/` ni migraciones antiguas completas.
- `retrieval.ts` (~1000 líneas) y `processing.ts` (~1300) son grandes: lee solo la función que necesitas.
- Cambios pequeños y enfocados; no refactorices de paso.
- Si algo del proyecto cambia de forma duradera (comando, convención, decisión), actualiza este archivo.
