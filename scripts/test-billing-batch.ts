// Verifica la feature "Generar facturas de la semana" (facturación en
// lote): numeración consecutiva reutilizando issue_invoice (nunca una
// secuencia nueva), anti-duplicado atómico con lock de fila, cliente
// nuevo entrando sin tocar código, cliente desactivado excluido, y que
// la UI/acciones no reinventan la lógica de emisión/PDF ya existente.
//
// Las garantías de concurrencia/numeración de la función SQL
// (create_weekly_invoice_drafts) ya se probaron en vivo contra la base
// de desarrollo, dentro de una transacción con ROLLBACK (6 escenarios:
// borrador, duplicado bloqueado, numeración consecutiva real vía
// issue_invoice, duplicado bloqueado aun ya emitida, cliente desactivado
// excluido, cliente nuevo facturando en el mismo lote) -- sin dejar
// datos de prueba ni consumir ningún número real. Este script se queda
// con la verificación estática de código, siguiendo el mismo patrón que
// scripts/test-invoice-client-visibility.ts para todo lo que depende de
// auth.uid()/RLS en producción.
//
//   npx tsx scripts/test-billing-batch.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const migration = read(
  "supabase/migrations/20261019120000_billing_batch_clients.sql",
);
const action = read("src/actions/billing-batch.ts");
const service = read("src/services/billing-batch.ts");
const generator = read("src/components/invoices/weekly-batch-generator.tsx");
const editor = read("src/components/invoices/billing-clients-editor.tsx");
const invoicesPage = read(
  "src/app/(dashboard)/dashboard/admin/invoices/page.tsx",
);
const zipRoute = read("src/app/api/invoices/batch-download/route.ts");

// ---------------------------------------------------------------------
// Numeración: nunca una secuencia nueva, siempre issue_invoice().
// ---------------------------------------------------------------------
assert.doesNotMatch(
  migration,
  /invoice_sequences\s*\n?\s*SET\s+last_issued_number/,
  "create_weekly_invoice_drafts NO toca invoice_sequences directamente",
);
assert.doesNotMatch(
  migration,
  /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.issue_invoice/,
  "la migración no redefine issue_invoice -- lo reusa tal cual",
);
assert.match(
  action,
  /issueInvoice\(invoiceId\)/,
  "confirmWeeklyInvoiceBatch llama a la MISMA acción issueInvoice() que ya usa el flujo manual, no la reimplementa",
);
assert.match(
  action,
  /import \{ issueInvoice \} from "@\/actions\/invoices"/,
  "issueInvoice se importa del módulo existente, no se copia",
);

// ---------------------------------------------------------------------
// Concurrencia: lock de fila antes de decidir, no solo una verificación
// previa en la app.
// ---------------------------------------------------------------------
assert.match(
  migration,
  /SELECT \* INTO v_client FROM public\.billing_batch_clients[\s\S]{0,80}FOR UPDATE/,
  "create_weekly_invoice_drafts bloquea la fila del cliente facturable (FOR UPDATE) antes de decidir -- a prueba de doble clic/dos sesiones",
);
assert.match(
  migration,
  /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/,
  "solo un admin autenticado puede llamar a create_weekly_invoice_drafts",
);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.create_weekly_invoice_drafts\(JSONB\) FROM PUBLIC, anon/,
);

// ---------------------------------------------------------------------
// Anti-duplicado atómico: índice único parcial, no solo un SELECT previo.
// ---------------------------------------------------------------------
assert.match(
  migration,
  /CREATE UNIQUE INDEX IF NOT EXISTS invoices_billing_batch_period_uq\s*\n\s*ON public\.invoices\(billing_batch_client_id, billing_period_start\)\s*\n\s*WHERE billing_batch_client_id IS NOT NULL AND status <> 'cancelled'/,
  "el anti-duplicado es un índice único parcial a nivel de base -- no solo una verificación de la app",
);
assert.match(
  migration,
  /Ya existe una factura para %[\s\S]{0,40}confirm[aá] "?regenerar"?/i,
  "mensaje claro de duplicado, con la vía explícita de regenerar",
);
assert.match(
  migration,
  /status = 'cancelled'[\s\S]{0,200}cancellation_reason = 'Regenerada desde el lote semanal'/,
  "regenerar cancela la factura anterior (nunca reutiliza su número) antes de crear la nueva",
);

// ---------------------------------------------------------------------
// Cliente nuevo entra directo al lote; cliente desactivado, excluido --
// ambos a través del mismo filtro "active", sin ninguna lista aparte en
// el código.
// ---------------------------------------------------------------------
assert.match(
  migration,
  /WHERE id = \(v_req->>'billingBatchClientId'\)::UUID AND active/,
  "create_weekly_invoice_drafts exige active=true por fila -- un cliente desactivado nunca puede facturar aunque se lo pidan explícitamente",
);
assert.match(
  service,
  /\.eq\("active", true\)/,
  "previewWeeklyInvoiceBatch solo lista clientes activos -- uno nuevo que se inserta ya activo aparece solo, sin tocar código",
);
assert.doesNotMatch(
  service,
  /company_id\s*(===|==)\s*["'](magol|sibarita|cut|baldonny)/i,
  "ningún nombre de cliente hardcodeado en el servicio -- todo sale de billing_batch_clients",
);
assert.doesNotMatch(
  action,
  /\b130\.00\b|\b200\.00\b|\b300\.00\b|\b320\.00\b|\b180\.00\b/,
  "ningún monto fijo hardcodeado en las acciones -- vienen siempre de billing_batch_clients o de un override explícito de la vista previa",
);

// ---------------------------------------------------------------------
// Fallback de nombre de facturación: igual que el formulario manual
// (invoice-editor.tsx: billing_legal_name || company.name) -- Magol y
// Cut Meat Distributors no tienen billing_legal_name propio hoy.
// ---------------------------------------------------------------------
assert.match(
  migration,
  /v_legal_name := COALESCE\(v_billing\.billing_legal_name, v_company_name\)/,
  "mismo fallback que invoice-editor.tsx: billing_legal_name, o si no, el nombre de la empresa",
);

// ---------------------------------------------------------------------
// "Pendiente de monto" para amount_type='system' sin resolver -- nunca
// se inventa un número, nunca se genera nada en silencio.
// ---------------------------------------------------------------------
assert.match(
  service,
  /pendingAmount = client\.amount_type === "system"/,
);
assert.match(
  generator,
  /disabled=\{line\.pendingAmount/,
  "una línea pendiente de monto queda deshabilitada en la vista previa, nunca se incluye sola",
);
assert.match(
  generator,
  /Pendiente de monto/,
);

// ---------------------------------------------------------------------
// Vista previa antes de crear nada; confirmar es un paso aparte y
// explícito (con recuento + total mostrado antes de llamar al server).
// ---------------------------------------------------------------------
assert.match(generator, /Confirmar y generar/);
assert.match(
  generator,
  /window\.confirm\(/,
  "la confirmación final pide un OK explícito con el recap de líneas y el total antes de llamar al servidor",
);
const confirmFunctionBody = generator.slice(
  generator.indexOf("const confirm = () =>"),
  generator.indexOf("const downloadBatch ="),
);
assert.match(
  confirmFunctionBody,
  /!window\.confirm\(/,
  "la función confirm() pide un OK explícito con window.confirm antes de seguir",
);
assert.match(
  confirmFunctionBody,
  /confirmWeeklyInvoiceBatch\(/,
  "confirmWeeklyInvoiceBatch se llama dentro de la misma función confirm(), después del window.confirm",
);

// ---------------------------------------------------------------------
// RLS: solo admin gestiona billing_batch_clients -- ningún cliente lo ve.
// ---------------------------------------------------------------------
assert.match(
  migration,
  /ALTER TABLE public\.billing_batch_clients ENABLE ROW LEVEL SECURITY/,
);
assert.match(
  migration,
  /CREATE POLICY "Admins manage billing batch clients" ON public\.billing_batch_clients\s*\nFOR ALL TO authenticated USING \(public\.is_admin\(\)\) WITH CHECK \(public\.is_admin\(\)\)/,
  "única política: solo admin, ningún acceso de cliente a la config de facturación en lote",
);

// ---------------------------------------------------------------------
// "Nunca eliminar datos": desactivar, no borrar.
// ---------------------------------------------------------------------
assert.doesNotMatch(
  action,
  /from\("billing_batch_clients"\)\s*\.delete\(/,
  "no existe ninguna acción que borre un cliente facturable -- solo active=false (setBillingBatchClientActive)",
);
assert.match(
  editor,
  /¿Desactivar a[\s\S]{0,60}No se borra|nada se borra/,
);

// ---------------------------------------------------------------------
// Aislamiento: cada factura del lote queda ligada a su company_id real
// (de billing_batch_clients -> companies), las mismas políticas RLS que
// ya protegen `invoices` siguen aplicando sin cambios.
// ---------------------------------------------------------------------
assert.doesNotMatch(
  migration,
  /ALTER\s+POLICY|DROP\s+POLICY\s+IF\s+EXISTS\s+"Clients read own published invoices"/,
  "la política de aislamiento de invoices para clientes no se toca",
);
assert.match(
  migration,
  /v_client\.company_id, v_client\.id, v_period_start, v_period_end/,
  "cada factura del lote se inserta con el company_id real del cliente facturable",
);

// ---------------------------------------------------------------------
// Botón único en Facturación, rol admin (la página entera ya exige
// requireAdmin()).
// ---------------------------------------------------------------------
assert.match(invoicesPage, /Generar facturas de la semana/);
assert.match(invoicesPage, /Clientes facturables/);

// ---------------------------------------------------------------------
// Descarga del lote: PDF existente (mismo bucket/plantilla), nunca se
// regenera un PDF distinto para el ZIP.
// ---------------------------------------------------------------------
assert.match(zipRoute, /from\("invoices"\)\s*\n\s*\.download\(path\)|admin\.storage\.from\("invoices"\)/);
assert.match(zipRoute, /profile\.role !== "admin"/);
assert.doesNotMatch(
  zipRoute,
  /buildInvoicePdf/,
  "el ZIP reusa el PDF ya generado y subido por issueInvoice -- no genera uno nuevo",
);

console.log(
  "Facturación en lote semanal: numeración vía issue_invoice (sin secuencia nueva), " +
    "anti-duplicado atómico con lock de fila + índice único parcial, regenerar cancela " +
    "sin reusar número, cliente nuevo/desactivado solo por el flag 'active', fallback de " +
    "nombre de facturación igual al formulario manual, montos 'pendiente' nunca generan " +
    "en silencio, confirmación explícita antes de escribir, RLS solo-admin, sin deletes, " +
    "ZIP reusa el PDF ya emitido -- PASS.",
);
console.log(
  "(Numeración consecutiva real, duplicado bloqueado incluso ya emitida, cliente nuevo " +
    "facturando sin tocar código y cliente desactivado excluido -- verificados en vivo " +
    "contra la base de desarrollo dentro de una transacción con ROLLBACK; ver resumen de " +
    "la tarea.)",
);
