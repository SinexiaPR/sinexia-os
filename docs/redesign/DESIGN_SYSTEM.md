# Sistema de diseño de Sinexia OS

Base: Tailwind 4 + Radix (shadcn) + `lucide-react` (único set de íconos) + fuente Geist.
Los tokens viven en `src/app/globals.css`; los componentes en `src/components/ui/`.

## Tokens

| Grupo      | Tokens                                                                                           | Uso                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Superficie | `background`, `card`, `popover`, `muted`, `accent`, `border`, `input`                            | Fondo gris muy claro, tarjetas blancas con borde sutil                             |
| Marca      | `primary` (azul marino), `primary-foreground`, `ring`                                            | Botón primario, foco, pestaña activa                                               |
| Sidebar    | `sidebar*`                                                                                       | Menú lateral oscuro del admin                                                      |
| Semánticos | `success`, `warning`, `danger`, `info` y sus `*-soft`                                            | Texto y fondo suave de estados (contraste AA); nunca solo color: siempre con texto |
| Radios     | `--radius` (6 px) → `rounded-sm/md/lg/xl`                                                        |                                                                                    |
| Sombras    | `--shadow-card`, `--shadow-popover`                                                              | Sutiles; sin degradados                                                            |
| Espaciado  | Escala de 4 px de Tailwind (`1` = 4 px, `2` = 8 px…)                                             |                                                                                    |
| Tipografía | 12 `text-xs` · 14 `text-sm` · 16 `text-base` · 20 `text-xl` · 24 `text-2xl` · 32+ `text-3xl/4xl` | Cifras financieras con `tabular-nums` y alineadas a la derecha                     |

**Modo oscuro:** los tokens ya existen bajo `.dark` en `globals.css`. No está activado en ningún lado; bastaría añadir la clase `dark` a `<html>`.

## Componentes

| Componente         | Archivo                                          | Notas                                                                                                     |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Button             | `button.tsx`                                     | Variantes `default`, `outline`, `ghost`, `destructive`; en pantallas táctiles los controles miden ≥ 44 px |
| Card               | `surface-card.tsx` (`SurfaceCard`, `MetricCard`) |                                                                                                           |
| Badge de estado    | `status-badge.tsx`                               | `tone`: success / warning / danger / info / neutral                                                       |
| Table              | `table.tsx`                                      | Encabezado fijo, densidad `comfortable` / `compact`, `numeric` para importes                              |
| Tabs               | `tabs.tsx` (Radix)                               | Pestañas de pantalla. La ficha de empresa usa enlaces reales (`company-tabs.tsx`)                         |
| Accordion          | `accordion.tsx` (Radix)                          | Secciones colapsables                                                                                     |
| Drawer             | `sheet.tsx` (Radix Dialog)                       | Panel lateral o inferior                                                                                  |
| Modal              | `dialog.tsx` (Radix Dialog)                      |                                                                                                           |
| Dropdown           | `dropdown-menu.tsx`                              |                                                                                                           |
| Combobox           | `combobox.tsx`                                   | Selector con búsqueda; sirve en formularios GET (`name`)                                                  |
| Popover de filtros | `popover.tsx`, `filter-panel.tsx`                | `FilterPanel`: popover en escritorio, hoja inferior en móvil                                              |
| Toast              | `toast.tsx`                                      | `useToast()`; región `aria-live` en `<body>`                                                              |
| EmptyState         | `empty-state.tsx`                                | Ícono, mensaje útil y acción opcional                                                                     |
| Skeleton           | `skeleton.tsx`                                   | `dashboard/loading.tsx` lo usa                                                                            |
| PageHeader         | `layout/page-header.tsx`                         | Con migas de pan (`layout/breadcrumbs.tsx`)                                                               |
| Paginación         | `pagination-bar.tsx` + `lib/pagination.ts`       |                                                                                                           |

## Reglas de uso

- Toda cadena que venga de la base de datos o de un enum pasa por `src/lib/labels.ts` (`labelFor`). Nunca mostrar valores crudos como `not_configured`.
- Interfaz 100 % en español (español neutro de Puerto Rico, tuteo en el admin y usted con clientes donde ya existía).
- Divulgación progresiva: filtros en chips + «Más filtros», detalle en fila expandible, secciones secundarias en acordeón.
- Accesibilidad: foco visible, `aria-expanded/controls` en acordeones y filas expandibles, enlace «Saltar al contenido», `prefers-reduced-motion` respetado.
