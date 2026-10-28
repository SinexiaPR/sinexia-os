# Resumen del rediseño UX/UI

Rama de trabajo: `claude/beautiful-albattani-pv3zvf` · PR #122 (borrador). Detalle técnico: `AUDITORIA.md` y `DESIGN_SYSTEM.md`.

## Menú antes y después

| Rol     | Antes                                                                              | Después                                                                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin   | Dashboard · Calendario · Facturación · Inbox · Reports · Profile (inglés mezclado) | **Inicio · Clientes · Facturación · Documentos · Reportes · Calendario**. Perfil, Configuración, Notificaciones, instalar app y Cerrar sesión van en el menú del avatar |
| Cliente | Hasta 7: Dashboard · Nóminas* · Facturas* · Inbox · Reports · SinexIA · Profile    | **Hasta 5:** Inicio · Documentos · Reportes · Nóminas* · Facturas* (*solo si su empresa tiene el módulo). SinexIA pasa a botón del encabezado; Perfil al avatar         |

Además: sidebar colapsable (estado en `localStorage`), paleta `Ctrl/Cmd + K`, migas de pan en pantallas de segundo nivel, selector de empresa con búsqueda y diccionario central de etiquetas (`src/lib/labels.ts`).

## Qué cambió por pantalla

- **Inicio:** 4 indicadores (clientes con pendientes, facturas vencidas, nóminas por aprobar, documentos por revisar), «Requiere tu atención» ordenada por urgencia, clientes al día en acordeón y actividad reciente colapsada.
- **Clientes (nueva):** listado con búsqueda y semáforo. **Ficha de empresa:** encabezado con estado y acción primaria «Subir reporte»; pestañas Resumen · Facturas · Nómina/Presupuesto/Informes (según módulo) · Documentos · Reportes · Actividad.
- **Facturación:** 6 columnas, chips de estado + «Más filtros», un solo botón primario y «Más acciones», resumen (pendiente, vencido, cobrado del mes), paginación de 25, pestaña «Históricas» para las importadas, detalle de emisión/correo/envío/pago/PDF en fila expandible.
- **Documentos (antes Inbox):** chips de estado + «Más filtros», estado vacío útil, prioridad con color.
- **Reportes:** lista como vista principal; «Publicar reporte» abre un panel lateral. «Diagnóstico SinexIA» pasó a **Configuración › Herramientas técnicas** (colapsada).
- **Calendario:** filtros dentro de un popover con contador; agenda limitada a 30 días con las series repetidas (p. ej. NÓMINA SIBARITA) como una sola entrada.
- **Nómina (Sibarita):** pestañas Semana actual · Empleados y tarifas · Historial · Vacaciones y enfermedad; alerta destacada de «tarifa por revisar»; empleados sin horas en acordeón; barra de total fija abajo; historial paginado; Vacaciones y enfermedad en 6 columnas con detalle expandible y un único aviso por fechas de contratación faltantes.
- **Portada y login:** marca, propuesta de valor, tres beneficios, enlace a sinexiapr.com; login centrado con error y estado de carga claros.
- **Transversal:** español en toda la interfaz visible, sistema de diseño (tokens, Table, Tabs, Accordion, Drawer, Modal, Combobox, FilterPanel, Toast, EmptyState, Skeleton), filtros en hoja inferior en móvil, foco visible, enlace «Saltar al contenido», objetivos táctiles de 44 px, modo oscuro preparado (no activado).

## Decisiones de diseño

- Las pestañas de la ficha son rutas reales (enlaces), no estado local: se pueden compartir y el botón «atrás» funciona.
- Los filtros de Documentos siguen siendo parámetros de URL (se pueden guardar y compartir); los de Facturación y Calendario son locales porque filtran datos ya cargados.
- En una nómina en **borrador**, los empleados sin horas quedan en un acordeón **abierto** (ahí es donde se escriben las horas); en nóminas enviadas o aprobadas quedan cerrado. La agrupación usa los datos guardados para que una fila no salte mientras se escribe.
- Dependencias nuevas, todas de la familia Radix que ya se usaba: `react-tabs`, `react-accordion`, `react-popover`.

## Puntos de negocio detectados que NO se cambiaron

1. **Facturas con vencimiento igual a emisión** (`src/actions/invoices.ts:131`: `due_date: value.invoiceDate`). Por eso casi todas aparecen «Vencidas»; el indicador «Facturas vencidas» de Inicio y el «Total vencido» de Facturación ahora lo hacen más visible. Decide si debe haber un plazo de pago (p. ej. 15 o 30 días).
2. **Fechas de contratación vacías** en Vacaciones y enfermedad: sin ellas no se calcula categoría ni tasa mensual. Ahora hay un aviso único; las fechas hay que cargarlas desde Empleados y tarifas.
3. **Empleado con tarifa por revisar** («Alberto (apellido pendiente)»): ahora es una alerta destacada arriba de la nómina con acceso directo a las tarifas; la tarifa en sí no se tocó.
4. **Zona horaria del Inicio:** las fechas de las tareas se formatean con `America/Argentina/Cordoba` (definido así a pedido en el ticket original); el resto de la app usa Puerto Rico.
5. **Tests que ya fallaban en `main` sin estos cambios:** `test:cutmeat-daily` («Informes diarios» mencionado fuera del módulo en `informes/page.tsx`) y `test:tresbe-stabilization` (espera `sticky top-0`).

## Pendientes

- **Capturas con sesión real y prueba de aislamiento admin/cliente:** necesitan un Supabase de pruebas con un usuario admin y uno cliente. No se verificó en este entorno; los cambios nuevos de datos son de solo lectura, exigen `requireAdmin` y respetan RLS, pero la prueba real queda por hacer.
- **Nómina de Tresbe** (`tresbe-payroll/admin-workspace.tsx`, ~1.800 líneas): solo recibió el encabezado y pestañas de la ficha; su interior (cálculo de propinas y turnos) no se reorganizó para no arriesgar los cuadres.
- **Vistas de cliente** (Inicio, Documentos, Reportes, Nóminas, Facturas): solo cambió la navegación, el idioma y los componentes compartidos; falta un rediseño propio.
- **Cut Meat:** textos que son nombres de reportes bancarios o de QuickBooks (p. ej. «Deposit Accounts Activity Summary», «Tr Type») siguen en inglés a propósito.
- Orden por «Fecha de contratación» y por «Años de servicio» ya no está en la tabla de Vacaciones y enfermedad (esos datos están en el detalle de cada fila).
- Vista previa de Vercel: se publica con cada commit del PR #122.
