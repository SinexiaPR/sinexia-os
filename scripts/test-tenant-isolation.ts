/**
 * Pruebas de aislamiento entre clientes (correr antes de cada deploy).
 *
 * Con la sesión real de cada usuario cliente (cut, cut-meat-distributors, magol,
 * sibarita, tresbe) verifica que:
 *   1. En toda tabla/vista con columna company_id (descubierta en vivo), el cliente
 *      ve 0 filas de otras empresas. También `companies` (solo su propia fila).
 *   2. No puede ejecutar por RPC ninguna función de administración. Toda función
 *      expuesta por RPC debe estar clasificada abajo; una nueva sin clasificar
 *      hace fallar la corrida (obliga a decidir si es de admin o de cliente).
 *   3. `is_admin()` devuelve false e `integrity_checks` no devuelve filas.
 *
 * Uso:
 *   npm run test:isolation
 *
 * Variables (en .env.local o en el entorno):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY   -> descubre tablas/RPC y compara contra la verdad.
 *   ISOLATION_TEST_PASSWORD     -> contraseña de los 5 usuarios (o SEED_USER_PASSWORD).
 *   ISOLATION_CLIENTS           -> opcional, JSON para cambiar correos/claves:
 *                                  [{"slug":"cut","email":"...","password":"..."}]
 *
 * Solo lee, salvo las llamadas RPC: se hacen con argumentos inertes (UUID nulo,
 * fecha 1900-01-01) y SE ESPERA que todas sean rechazadas. Si una no lo es, es un
 * hallazgo de seguridad y la corrida falla. Prefiere correrla contra staging.
 *
 * Sale con código 1 si algo falla.
 */

import { resolve } from "node:path";

import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

// ---------------------------------------------------------------------------
// Clasificación de funciones RPC
// ---------------------------------------------------------------------------

/** Funciones de administración: un cliente NUNCA debe poder ejecutarlas. */
const ADMIN_RPCS = new Set([
  "cancel_tresbe_payroll",
  "create_weekly_invoice_drafts",
  "delete_admin_invoice",
  "delete_tresbe_payroll_draft",
  "emit_calendar_due_notifications",
  "emit_portal_notification",
  "issue_invoice",
  "log_data_load",
  "recalc_tresbe_payroll_shift",
  "recalculate_invoice_totals",
  "recalculate_tresbe_payroll",
  "reconcile_tresbe_employees",
  "reconcile_tresbe_employees_internal",
  "refresh_invoice_overdue_statuses",
  "refresh_tresbe_employee_reviews",
  "reopen_tresbe_payroll",
  "reopen_weekly_payroll",
  "replace_tresbe_employee_aliases",
  "reset_tresbe_payroll_draft",
  "rollup_tresbe_payroll_daily_entries",
  "send_tresbe_payroll",
]);

/** Funciones de trigger: no tienen sentido por RPC; cualquier error es correcto. */
const TRIGGER_FUNCTIONS = new Set([
  "add_active_employees_to_payroll",
  "audit_tresbe_employee_configuration",
  "audit_tresbe_employee_wage_change",
  "handle_new_user",
  "load_tresbe_payroll_employees",
  "notify_calendar_comment",
  "notify_calendar_item_events",
  "notify_calendar_occurrence_completed",
  "notify_document_events",
  "notify_invoice_issued",
  "notify_processing_events",
  "notify_report_published",
  "notify_tresbe_payroll_sent",
  "notify_weekly_payroll_submitted",
  "protect_profile_authorization_fields",
  "sync_employee_to_draft_payrolls",
  "sync_tresbe_employee_to_open_payrolls",
  "trg_tresbe_payroll_daily_entry_change",
  "trg_tresbe_shift_pool_change",
]);

/** Funciones que el portal del cliente sí usa (helpers de RLS y acciones propias). */
const CLIENT_RPCS = new Set([
  "can_access_document",
  "can_access_notification",
  "can_access_report",
  "current_company_id",
  "is_admin",
  "is_cut_meat_company",
  "is_sibarita_company",
  "is_tresbe_company",
  "mark_invoice_viewed",
  "mark_tresbe_payroll_viewed",
  "match_document_chunks",
]);

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const DEFAULT_CLIENTS = [
  { slug: "cut", email: "client@cut.com" },
  { slug: "cut-meat-distributors", email: "client@cutmeat.com" },
  { slug: "magol", email: "client@magol.com" },
  { slug: "sibarita", email: "client@sibarita.com" },
  { slug: "tresbe", email: "client@tresbe.com" },
];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

type ClientConfig = { slug: string; email: string; password: string };

type OpenApiProperty = {
  type?: string;
  format?: string;
  enum?: string[];
};

type OpenApi = {
  definitions?: Record<
    string,
    { properties?: Record<string, OpenApiProperty> }
  >;
  components?: {
    schemas?: Record<string, { properties?: Record<string, OpenApiProperty> }>;
  };
  paths?: Record<
    string,
    {
      post?: {
        parameters?: {
          in?: string;
          schema?: {
            properties?: Record<string, OpenApiProperty>;
            required?: string[];
          };
        }[];
      };
    }
  >;
};

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log(`  ✗ ${message}`);
};
const pass = (message: string) => console.log(`  ✓ ${message}`);
const info = (message: string) => console.log(`  · ${message}`);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}`);
    process.exit(1);
  }
  return value;
}

function loadClients(): ClientConfig[] {
  const override = process.env.ISOLATION_CLIENTS;
  if (override) return JSON.parse(override) as ClientConfig[];
  const password =
    process.env.ISOLATION_TEST_PASSWORD ?? process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error(
      "Falta ISOLATION_TEST_PASSWORD (o SEED_USER_PASSWORD) o ISOLATION_CLIENTS",
    );
    process.exit(1);
  }
  return DEFAULT_CLIENTS.map((client) => ({ ...client, password }));
}

function newClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Valor inerte para cada parámetro de una función RPC. */
function dummyValue(property: OpenApiProperty): unknown {
  if (property.enum?.length) return property.enum[0];
  switch (property.format) {
    case "uuid":
      return NIL_UUID;
    case "date":
      return "1900-01-01";
    case "jsonb":
    case "json":
      return [];
  }
  switch (property.type) {
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    default:
      return "test";
  }
}

const AUTH_DENIED =
  /admin|administrador|not authorized|permission denied|row-level security|forbidden|no autorizado/i;

// ---------------------------------------------------------------------------
// Descubrimiento (service role)
// ---------------------------------------------------------------------------

async function discover(url: string, serviceKey: string) {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) {
    console.error(
      `No se pudo leer el esquema OpenAPI de PostgREST (${response.status})`,
    );
    process.exit(1);
  }
  const spec = (await response.json()) as OpenApi;
  const schemas = spec.definitions ?? spec.components?.schemas ?? {};
  const companyTables = Object.entries(schemas)
    .filter(
      ([, schema]) => schema.properties && "company_id" in schema.properties,
    )
    .map(([name]) => name)
    .sort();
  const rpcs = Object.keys(spec.paths ?? {})
    .filter((path) => path.startsWith("/rpc/"))
    .map((path) => path.slice("/rpc/".length))
    .sort();
  return { spec, companyTables, rpcs };
}

// ---------------------------------------------------------------------------
// Verificaciones por cliente
// ---------------------------------------------------------------------------

async function inChunks<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function checkTables(
  client: SupabaseClient,
  admin: SupabaseClient,
  tables: string[],
  ownCompanyId: string,
) {
  let verified = 0;
  const failuresBefore = failures;
  const unverifiable: string[] = [];

  await inChunks(tables, 8, async (table) => {
    const query = (c: SupabaseClient) =>
      c
        .from(table)
        .select("company_id", { count: "exact", head: true })
        .not("company_id", "is", null)
        .neq("company_id", ownCompanyId);

    const { count, error } = await query(client);
    if (error) {
      // Sin permiso sobre la tabla = tampoco ve filas ajenas.
      if (error.code === "42501") return pass(`${table}: sin permiso (42501)`);
      return fail(
        `${table}: error inesperado (${error.code}) ${error.message}`,
      );
    }
    if ((count ?? 0) > 0) {
      return fail(`${table}: ve ${count} fila(s) de otras empresas`);
    }
    const { count: truth } = await query(admin);
    if (!truth) {
      unverifiable.push(table);
    } else {
      verified += 1;
    }
  });

  if (failures === failuresBefore)
    pass(`${verified} tablas con datos de otras empresas: 0 filas visibles`);
  if (unverifiable.length) {
    info(
      `sin datos de otras empresas, no verificables con datos reales (${unverifiable.length}): ${unverifiable.sort().join(", ")}`,
    );
  }
}

async function checkCompaniesTable(
  client: SupabaseClient,
  ownCompanyId: string,
) {
  const { data, error } = await client.from("companies").select("id");
  if (error) return fail(`companies: error ${error.code} ${error.message}`);
  const foreign = (data ?? []).filter((row) => row.id !== ownCompanyId);
  if (foreign.length)
    fail(`companies: ve ${foreign.length} empresa(s) ajena(s)`);
  else pass("companies: solo su propia empresa");
}

async function checkRpcs(
  client: SupabaseClient,
  url: string,
  token: string,
  spec: OpenApi,
  rpcs: string[],
) {
  const unclassified = rpcs.filter(
    (name) =>
      !ADMIN_RPCS.has(name) &&
      !TRIGGER_FUNCTIONS.has(name) &&
      !CLIENT_RPCS.has(name),
  );
  if (unclassified.length) {
    fail(
      `RPC sin clasificar (agrégalas a ADMIN_RPCS/TRIGGER_FUNCTIONS/CLIENT_RPCS): ${unclassified.join(", ")}`,
    );
  }

  const denied: string[] = [];
  for (const name of rpcs.filter(
    (n) => ADMIN_RPCS.has(n) || TRIGGER_FUNCTIONS.has(n),
  )) {
    const properties =
      spec.paths?.[`/rpc/${name}`]?.post?.parameters?.find(
        (p) => p.in === "body",
      )?.schema?.properties ?? {};
    const body = Object.fromEntries(
      Object.entries(properties).map(([arg, property]) => [
        arg,
        dummyValue(property),
      ]),
    );
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let error: { code?: string; message?: string } = {};
    try {
      error = JSON.parse(text) as typeof error;
    } catch {
      // cuerpo no JSON: se evalúa por el status
    }

    if (response.ok) {
      fail(`${name}: un cliente LA EJECUTÓ (HTTP ${response.status})`);
    } else if (TRIGGER_FUNCTIONS.has(name)) {
      denied.push(name);
    } else if (
      response.status === 401 ||
      response.status === 403 ||
      error.code === "42501" ||
      AUTH_DENIED.test(error.message ?? "")
    ) {
      denied.push(name);
    } else {
      fail(
        `${name}: se ejecutó y falló por otra razón, no por autorización (HTTP ${response.status}, ${error.code}: ${error.message})`,
      );
    }
  }
  if (denied.length)
    pass(`${denied.length} funciones de admin/trigger rechazadas`);

  const { data: isAdmin, error: isAdminError } = await client.rpc("is_admin");
  if (isAdminError || isAdmin !== false)
    fail(`is_admin() debe ser false (obtuvo ${String(isAdmin)})`);
  else pass("is_admin() = false");

  const { data: checks, error: checksError } = await client
    .from("integrity_checks")
    .select("check_code");
  if (checksError && checksError.code !== "42501")
    fail(`integrity_checks: error ${checksError.code}`);
  else if ((checks ?? []).length)
    fail(`integrity_checks: devuelve ${checks?.length} fila(s) a un cliente`);
  else pass("integrity_checks: 0 filas");
}

// ---------------------------------------------------------------------------

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const clients = loadClients();

  console.log(`Aislamiento entre clientes — ${url}`);
  const admin = newClient(url, serviceKey);
  const { spec, companyTables, rpcs } = await discover(url, serviceKey);
  console.log(
    `Descubiertas ${companyTables.length} tablas/vistas con company_id y ${rpcs.length} funciones RPC`,
  );

  const stale = [...ADMIN_RPCS, ...TRIGGER_FUNCTIONS, ...CLIENT_RPCS].filter(
    (name) => !rpcs.includes(name),
  );
  if (stale.length)
    info(`clasificadas pero no expuestas por RPC: ${stale.join(", ")}`);

  const { data: companies, error: companiesError } = await admin
    .from("companies")
    .select("id, slug");
  if (companiesError) throw companiesError;
  const companyBySlug = new Map(
    (companies ?? []).map((c) => [c.slug, c.id as string]),
  );

  for (const entry of clients) {
    console.log(`\n[${entry.slug}] ${entry.email}`);
    const expectedCompany = companyBySlug.get(entry.slug);
    if (!expectedCompany) {
      fail(`no existe la empresa con slug ${entry.slug}`);
      continue;
    }

    const client = newClient(url, anonKey);
    const { data: session, error: signInError } =
      await client.auth.signInWithPassword({
        email: entry.email,
        password: entry.password,
      });
    if (signInError || !session.session) {
      fail(`no pudo iniciar sesión: ${signInError?.message}`);
      continue;
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role, company_id")
      .eq("id", session.user.id)
      .single();
    if (profile?.role !== "client" || profile.company_id !== expectedCompany) {
      fail(
        `el usuario no es cliente de ${entry.slug} (role=${profile?.role}); la prueba no es válida`,
      );
      continue;
    }

    await checkCompaniesTable(client, expectedCompany);
    await checkTables(client, admin, companyTables, expectedCompany);
    await checkRpcs(client, url, session.session.access_token, spec, rpcs);
    await client.auth.signOut();
  }

  console.log(
    failures
      ? `\n${failures} verificación(es) FALLARON`
      : "\nAislamiento entre clientes: OK",
  );
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
