"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  extractAgingBalanceDetail,
  extractBankExport,
  extractReconciliationReport,
} from "@/lib/cutmeat-daily/extractors";
import { extractPdf } from "@/lib/intelligence/extraction/pdf";
import {
  buildAgingCustomersPdf,
  buildAgingVendorsPdf,
  buildBankExportPdf,
  buildConsolidatedPdf,
  buildReconciliationPdf,
} from "@/lib/cutmeat-daily/pdf";
import { getDailyReportWorkspace, resolveCutMeatCompany } from "@/services/cutmeat-daily";
import type { IsoDate } from "@/lib/cutmeat-daily/dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite().min(-9_999_999).max(9_999_999);
const positiveMoney = z.number().finite().min(0).max(9_999_999);

async function authorize(companyId: string) {
  const profile = await requireAdmin();
  const company = await resolveCutMeatCompany(companyId);
  if (!company) {
    throw new Error(
      "Los informes diarios están disponibles únicamente para Cut Meat Distributors.",
    );
  }
  return { profile, company };
}

function refresh(companyId: string) {
  revalidatePath(`/dashboard/admin/companies/${companyId}/daily-reports`);
}

function failure(error: unknown) {
  return {
    error:
      error instanceof Error ? error.message : "No se pudo completar la acción.",
  };
}

async function requireEditableReport(reportId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_reports")
    .select("status")
    .eq("id", reportId)
    .single();
  if (error) throw error;
  if (data.status === "closed") {
    throw new Error("El día está cerrado. Reabrilo antes de modificarlo.");
  }
}

async function logEvent(
  reportId: string,
  eventType: "created" | "closed" | "reopened" | "pdf_generated" | "data_updated",
  createdBy: string,
  detail?: Record<string, unknown>,
) {
  const supabase = await createClient();
  await supabase.from("cutmeat_daily_report_events").insert({
    report_id: reportId,
    event_type: eventType,
    detail: detail ?? null,
    created_by: createdBy,
  });
}

// ---------------------------------------------------------------------------
// El día del informe: crear / cerrar / reabrir
// ---------------------------------------------------------------------------

export async function ensureDailyReport(input: { companyId: string; reportDate: string }) {
  const parsed = z
    .object({ companyId: z.string().uuid(), reportDate: isoDate })
    .safeParse(input);
  if (!parsed.success) return { error: "Fecha inválida." };
  try {
    const { profile } = await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const existing = await supabase
      .from("cutmeat_daily_reports")
      .select("id")
      .eq("company_id", parsed.data.companyId)
      .eq("report_date", parsed.data.reportDate)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { success: true, reportId: existing.data.id };
    const inserted = await supabase
      .from("cutmeat_daily_reports")
      .insert({
        company_id: parsed.data.companyId,
        report_date: parsed.data.reportDate,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    await logEvent(inserted.data.id, "created", profile.id);
    refresh(parsed.data.companyId);
    return { success: true, reportId: inserted.data.id };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Al cerrar, se congelan Balance after Weekly Payments y Balance GABRIEL
 * de ESTE día (si hay conciliación cargada) -- el día siguiente los lee
 * como "el último día cerrado anterior" (ver buildBalanceGabriel en
 * lib/cutmeat-daily/calculations.ts) en vez de recalcularlos sobre datos
 * que puedan cambiar después. Se recalculan de nuevo la próxima vez que
 * se cierre (p.ej. tras reabrir y corregir algo).
 */
export async function closeDailyReport(input: { companyId: string; reportId: string }) {
  const parsed = z
    .object({ companyId: z.string().uuid(), reportId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Informe inválido." };
  try {
    const { profile } = await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const report = await supabase
      .from("cutmeat_daily_reports")
      .select("report_date")
      .eq("id", parsed.data.reportId)
      .eq("company_id", parsed.data.companyId)
      .single();
    if (report.error) throw report.error;
    const workspace = await getDailyReportWorkspace(
      parsed.data.companyId,
      report.data.report_date as IsoDate,
    );
    const { error } = await supabase
      .from("cutmeat_daily_reports")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: profile.id,
        updated_by: profile.id,
        balance_after_weekly: workspace.weeklyPayments?.balanceAfterWeeklyPayments ?? null,
        balance_gabriel: workspace.balanceGabriel ?? null,
      })
      .eq("id", parsed.data.reportId)
      .eq("company_id", parsed.data.companyId);
    if (error) throw error;
    await logEvent(parsed.data.reportId, "closed", profile.id);
    refresh(parsed.data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Reabrir limpia Balance after Weekly Payments y Balance GABRIEL
 * congelados de este día -- vuelven a quedar null hasta el próximo
 * cierre, para no dejar un valor potencialmente desactualizado (ya que
 * se puede volver a editar la conciliación/recurrentes) marcado como
 * "congelado".
 */
export async function reopenDailyReport(input: { companyId: string; reportId: string }) {
  const parsed = z
    .object({ companyId: z.string().uuid(), reportId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Informe inválido." };
  try {
    const { profile } = await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cutmeat_daily_reports")
      .update({
        status: "reopened",
        reopened_at: new Date().toISOString(),
        reopened_by: profile.id,
        updated_by: profile.id,
        balance_after_weekly: null,
        balance_gabriel: null,
      })
      .eq("id", parsed.data.reportId)
      .eq("company_id", parsed.data.companyId);
    if (error) throw error;
    await logEvent(parsed.data.reportId, "reopened", profile.id);
    refresh(parsed.data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Extracción "mejor esfuerzo" de los PDF de entrada (Fase 1, sin API de
// QuickBooks): se lee el texto, se corren los extractores de
// lib/cutmeat-daily/extractors.ts y se sube el PDF crudo a Storage para
// guardar su storage_path -- la pantalla siempre deja revisar/corregir
// antes de guardar.
// ---------------------------------------------------------------------------

async function readUploadedPdf(companyId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new Error("Seleccioná un PDF.");
  if (file.type && file.type !== "application/pdf")
    throw new Error("El archivo debe ser un PDF.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extraction = await extractPdf(Buffer.from(bytes));
  if (extraction.requiresOcr || !extraction.text)
    throw new Error(
      "No se pudo leer el texto del PDF (puede ser una imagen escaneada); cargá los datos a mano.",
    );
  const admin = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const sourcePdfPath = `${companyId}/sources/${Date.now()}-${safeName}`;
  const uploaded = await admin.storage.from("cutmeat-daily").upload(sourcePdfPath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploaded.error) throw uploaded.error;
  return { text: extraction.text, sourcePdfPath };
}

/**
 * @deprecated La pantalla ya no sube PDF para extraer estos datos (ver
 * docs/CUTMEAT_DAILY_DATA_CONTRACT.md) -- queda sin borrar por si algo
 * externo todavía la llama directamente.
 */
export async function extractReconciliationPdf(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  if (!z.string().uuid().safeParse(companyId).success) return { error: "Empresa inválida." };
  try {
    await authorize(companyId);
    const { text, sourcePdfPath } = await readUploadedPdf(companyId, formData);
    const parsed = extractReconciliationReport(text);
    return { success: true, sourcePdfPath, ...parsed };
  } catch (error) {
    return failure(error);
  }
}

/** @deprecated Ver extractReconciliationPdf más arriba. */
export async function extractBankExportPdf(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  if (!z.string().uuid().safeParse(companyId).success) return { error: "Empresa inválida." };
  try {
    await authorize(companyId);
    const { text, sourcePdfPath } = await readUploadedPdf(companyId, formData);
    const parsed = extractBankExport(text);
    return { success: true, sourcePdfPath, ...parsed };
  } catch (error) {
    return failure(error);
  }
}

/** @deprecated Ver extractReconciliationPdf más arriba. */
export async function extractAgingPdf(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  if (!z.string().uuid().safeParse(companyId).success) return { error: "Empresa inválida." };
  try {
    await authorize(companyId);
    const { text, sourcePdfPath } = await readUploadedPdf(companyId, formData);
    const parsed = extractAgingBalanceDetail(text);
    return { success: true, sourcePdfPath, ...parsed };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Reconciliation Report
// ---------------------------------------------------------------------------

const reconciliationItemSchema = z.object({
  itemType: z.enum(["uncleared_check", "uncleared_deposit"]),
  reference: z.string().trim().min(1).max(200),
  amount: money,
});

export async function saveReconciliation(input: {
  companyId: string;
  reportId: string;
  statementEnding: number;
  register: number;
  items: Array<z.infer<typeof reconciliationItemSchema>>;
  sourcePdfPath?: string | null;
  /** Origen del dato: a mano en la pantalla, o importado por una skill
   * de Claude vía loadDailyReportData. Ver docs/CUTMEAT_DAILY_DATA_CONTRACT.md. */
  source?: "manual" | "claude-controlado";
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      reportId: z.string().uuid(),
      statementEnding: money,
      register: money,
      items: z.array(reconciliationItemSchema).max(200),
      sourcePdfPath: z.string().max(500).nullable().optional(),
      source: z.enum(["manual", "claude-controlado"]).optional().default("manual"),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos de conciliación." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    await requireEditableReport(data.reportId);
    const supabase = await createClient();
    const upserted = await supabase.from("cutmeat_daily_reconciliation").upsert(
      {
        report_id: data.reportId,
        statement_ending: data.statementEnding,
        register: data.register,
        source_pdf_path: data.sourcePdfPath ?? null,
        extracted_at: new Date().toISOString(),
        updated_by: profile.id,
        source: data.source,
        loaded_by: profile.id,
        loaded_at: new Date().toISOString(),
      },
      { onConflict: "report_id" },
    );
    if (upserted.error) throw upserted.error;
    const deleted = await supabase
      .from("cutmeat_daily_reconciliation_items")
      .delete()
      .eq("report_id", data.reportId);
    if (deleted.error) throw deleted.error;
    if (data.items.length) {
      const inserted = await supabase.from("cutmeat_daily_reconciliation_items").insert(
        data.items.map((item) => ({
          report_id: data.reportId,
          item_type: item.itemType,
          reference: item.reference,
          amount: item.amount,
        })),
      );
      if (inserted.error) throw inserted.error;
    }
    await logEvent(data.reportId, "data_updated", profile.id, {
      section: "reconciliation",
    });
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Export del banco
// ---------------------------------------------------------------------------

const bankMovementSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(300),
  amount: positiveMoney.refine((v) => v > 0, "El importe debe ser mayor a 0."),
  direction: z.enum(["ingreso", "egreso"]),
  linkedRecurringId: z.string().uuid().nullable().optional(),
  isNotEnteredDeposit: z.boolean().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function saveBankExport(input: {
  companyId: string;
  reportId: string;
  closingBalance: number | null;
  movements: Array<z.infer<typeof bankMovementSchema>>;
  sourcePdfPath?: string | null;
  source?: "manual" | "claude-controlado";
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      reportId: z.string().uuid(),
      closingBalance: money.nullable(),
      movements: z.array(bankMovementSchema).max(500),
      sourcePdfPath: z.string().max(500).nullable().optional(),
      source: z.enum(["manual", "claude-controlado"]).optional().default("manual"),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisá el export del banco." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    await requireEditableReport(data.reportId);
    const supabase = await createClient();
    const upserted = await supabase.from("cutmeat_daily_bank_export").upsert(
      {
        report_id: data.reportId,
        closing_balance: data.closingBalance,
        source_pdf_path: data.sourcePdfPath ?? null,
        extracted_at: new Date().toISOString(),
        updated_by: profile.id,
        source: data.source,
        loaded_by: profile.id,
        loaded_at: new Date().toISOString(),
      },
      { onConflict: "report_id" },
    );
    if (upserted.error) throw upserted.error;
    const deleted = await supabase
      .from("cutmeat_daily_bank_movements")
      .delete()
      .eq("report_id", data.reportId);
    if (deleted.error) throw deleted.error;
    if (data.movements.length) {
      const inserted = await supabase.from("cutmeat_daily_bank_movements").insert(
        data.movements.map((movement) => ({
          report_id: data.reportId,
          description: movement.description,
          amount: movement.amount,
          direction: movement.direction,
          linked_recurring_id: movement.linkedRecurringId ?? null,
          is_not_entered_deposit: movement.isNotEnteredDeposit ?? false,
          note: movement.note ?? null,
          updated_by: profile.id,
        })),
      );
      if (inserted.error) throw inserted.error;
    }
    await logEvent(data.reportId, "data_updated", profile.id, { section: "bank_export" });
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Aging de proveedores y clientes
// ---------------------------------------------------------------------------

/**
 * Un nombre (vendor/customer) puede repetirse en varias filas cuando se
 * carga el detalle por factura (txn_date/txn_type/num/due_date/amount/
 * open_balance) -- el PDF los agrupa por nombre con subtotal. Sin
 * detalle, una sola fila con `balance` (el total de ese nombre) sigue
 * funcionando igual que antes.
 */
const agingItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  balance: money,
  txnDate: isoDate.nullable().optional(),
  txnType: z.string().trim().max(60).nullable().optional(),
  num: z.string().trim().max(60).nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  amount: money.nullable().optional(),
  openBalance: money.nullable().optional(),
});

async function saveAging(
  table: "vendors" | "customers",
  input: {
    companyId: string;
    reportId: string;
    rawTotal: number;
    items: Array<z.infer<typeof agingItemSchema>>;
    sourcePdfPath?: string | null;
    source?: "manual" | "claude-controlado";
  },
) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      reportId: z.string().uuid(),
      rawTotal: money,
      items: z.array(agingItemSchema).max(500),
      sourcePdfPath: z.string().max(500).nullable().optional(),
      source: z.enum(["manual", "claude-controlado"]).optional().default("manual"),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisá el aging." };
  const data = parsed.data;
  const headTable = table === "vendors" ? "cutmeat_daily_aging_vendors" : "cutmeat_daily_aging_customers";
  const itemsTable =
    table === "vendors" ? "cutmeat_daily_aging_vendor_items" : "cutmeat_daily_aging_customer_items";
  const nameColumn = table === "vendors" ? "vendor_name" : "customer_name";
  try {
    const { profile } = await authorize(data.companyId);
    await requireEditableReport(data.reportId);
    const supabase = await createClient();
    const upserted = await supabase.from(headTable).upsert(
      {
        report_id: data.reportId,
        raw_total: data.rawTotal,
        source_pdf_path: data.sourcePdfPath ?? null,
        extracted_at: new Date().toISOString(),
        updated_by: profile.id,
        source: data.source,
        loaded_by: profile.id,
        loaded_at: new Date().toISOString(),
      },
      { onConflict: "report_id" },
    );
    if (upserted.error) throw upserted.error;
    const deleted = await supabase.from(itemsTable).delete().eq("report_id", data.reportId);
    if (deleted.error) throw deleted.error;
    if (data.items.length) {
      const inserted = await supabase.from(itemsTable).insert(
        data.items.map((item) => ({
          report_id: data.reportId,
          [nameColumn]: item.name,
          balance: item.balance,
          txn_date: item.txnDate ?? null,
          txn_type: item.txnType ?? null,
          num: item.num ?? null,
          due_date: item.dueDate ?? null,
          amount: item.amount ?? null,
          open_balance: item.openBalance ?? null,
        })),
      );
      if (inserted.error) throw inserted.error;
    }
    await logEvent(data.reportId, "data_updated", profile.id, { section: `aging_${table}` });
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveAgingVendors(
  input: Parameters<typeof saveAging>[1],
) {
  return saveAging("vendors", input);
}

export async function saveAgingCustomers(
  input: Parameters<typeof saveAging>[1],
) {
  return saveAging("customers", input);
}

// ---------------------------------------------------------------------------
// Ingresos proyectados (THIS WEEK)
// ---------------------------------------------------------------------------

export async function saveIncomeProjection(input: {
  companyId: string;
  days: Array<{ date: string; amount: number }>;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      days: z
        .array(z.object({ date: isoDate, amount: positiveMoney }))
        .min(1)
        .max(7),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisá la proyección de ingresos." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("cutmeat_daily_income_projection").upsert(
      data.days.map((day) => ({
        company_id: data.companyId,
        projection_date: day.date,
        amount: day.amount,
        updated_by: profile.id,
      })),
      { onConflict: "company_id,projection_date" },
    );
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Configuración de empresa: proveedores, feriados, Prime Meats
// ---------------------------------------------------------------------------

export async function saveVendorConfig(input: {
  companyId: string;
  vendorName: string;
  inclusion: "included" | "excluded";
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      vendorName: z.string().trim().min(1).max(200),
      inclusion: z.enum(["included", "excluded"]),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisá el proveedor." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("cutmeat_daily_vendor_config").upsert(
      {
        company_id: data.companyId,
        vendor_name: data.vendorName,
        inclusion: data.inclusion,
        updated_by: profile.id,
      },
      { onConflict: "company_id,vendor_name" },
    );
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteVendorConfig(input: { companyId: string; id: string }) {
  const parsed = z
    .object({ companyId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Proveedor inválido." };
  try {
    await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cutmeat_daily_vendor_config")
      .delete()
      .eq("id", parsed.data.id)
      .eq("company_id", parsed.data.companyId);
    if (error) throw error;
    refresh(parsed.data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveHoliday(input: {
  companyId: string;
  holidayDate: string;
  label?: string | null;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      holidayDate: isoDate,
      label: z.string().trim().max(120).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisá el feriado." };
  const data = parsed.data;
  try {
    await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("cutmeat_daily_holidays").upsert(
      {
        company_id: data.companyId,
        holiday_date: data.holidayDate,
        label: data.label ?? null,
      },
      { onConflict: "company_id,holiday_date" },
    );
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteHoliday(input: { companyId: string; id: string }) {
  const parsed = z
    .object({ companyId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Feriado inválido." };
  try {
    await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cutmeat_daily_holidays")
      .delete()
      .eq("id", parsed.data.id)
      .eq("company_id", parsed.data.companyId);
    if (error) throw error;
    refresh(parsed.data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveCutMeatSettings(input: {
  companyId: string;
  primeMeatsBalance: number;
  primeMeatsRecurring: number;
  defaultDailyIncome: number;
  flatWeeklyIncome: number;
  gabrielStartingBalance: number;
  currentWeekIncome: number;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      primeMeatsBalance: money,
      primeMeatsRecurring: money,
      defaultDailyIncome: positiveMoney,
      flatWeeklyIncome: positiveMoney,
      gabrielStartingBalance: money,
      currentWeekIncome: positiveMoney,
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisá la configuración." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("cutmeat_daily_settings").upsert(
      {
        company_id: data.companyId,
        prime_meats_balance: data.primeMeatsBalance,
        prime_meats_recurring: data.primeMeatsRecurring,
        default_daily_income: data.defaultDailyIncome,
        flat_weekly_income: data.flatWeeklyIncome,
        gabriel_starting_balance: data.gabrielStartingBalance,
        current_week_income: data.currentWeekIncome,
        updated_by: profile.id,
      },
      { onConflict: "company_id" },
    );
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Variación Diaria: líneas libres (concepto + monto), sin tipos fijos ni
// clasificación automática -- las carga el admin a mano, igual que hoy
// las pone Hernan en la planilla.
// ---------------------------------------------------------------------------

const varianceLineSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  reportId: z.string().uuid(),
  concept: z.string().trim().min(1).max(200),
  amount: money,
});

export async function saveVarianceLine(input: z.infer<typeof varianceLineSchema>) {
  const parsed = varianceLineSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá la línea de Variación Diaria." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    await requireEditableReport(data.reportId);
    const supabase = await createClient();
    if (data.id) {
      const { error } = await supabase
        .from("cutmeat_daily_variance_lines")
        .update({ concept: data.concept, amount: data.amount, updated_by: profile.id })
        .eq("id", data.id)
        .eq("report_id", data.reportId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("cutmeat_daily_variance_lines").insert({
        report_id: data.reportId,
        concept: data.concept,
        amount: data.amount,
        created_by: profile.id,
        updated_by: profile.id,
      });
      if (error) throw error;
    }
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteVarianceLine(input: {
  companyId: string;
  reportId: string;
  id: string;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      reportId: z.string().uuid(),
      id: z.string().uuid(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Línea inválida." };
  try {
    await authorize(parsed.data.companyId);
    await requireEditableReport(parsed.data.reportId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cutmeat_daily_variance_lines")
      .delete()
      .eq("id", parsed.data.id)
      .eq("report_id", parsed.data.reportId);
    if (error) throw error;
    refresh(parsed.data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Carga programática de un día completo (para una skill de Claude u otra
// automatización, no solo para la pantalla).
// ---------------------------------------------------------------------------

const programmaticPayloadSchema = z.object({
  companyId: z.string().uuid(),
  reportDate: isoDate,
  reconciliation: z
    .object({
      statementEnding: money,
      register: money,
      items: z.array(reconciliationItemSchema),
      sourcePdfPath: z.string().max(500).nullable().optional(),
    })
    .optional(),
  bankExport: z
    .object({
      closingBalance: money.nullable(),
      movements: z.array(bankMovementSchema),
      sourcePdfPath: z.string().max(500).nullable().optional(),
    })
    .optional(),
  agingVendors: z
    .object({ rawTotal: money, items: z.array(agingItemSchema), sourcePdfPath: z.string().max(500).nullable().optional() })
    .optional(),
  agingCustomers: z
    .object({ rawTotal: money, items: z.array(agingItemSchema), sourcePdfPath: z.string().max(500).nullable().optional() })
    .optional(),
  varianceLines: z.array(z.object({ concept: z.string().trim().min(1).max(200), amount: money })).optional(),
});

/**
 * Endpoint programático de administrador: carga de una sola vez los
 * datos del día (todo lo que no sea editable sin pasar por ensureDailyReport
 * primero). Pensado para una skill de Claude que corra el proceso desde
 * afuera de la pantalla.
 *
 * El día queda SIEMPRE en borrador -- esta función nunca llama a
 * closeDailyReport, así que una carga externa no puede cerrar un día
 * por sí sola; solo un admin lo cierra desde la pantalla.
 */
export async function loadDailyReportData(
  input: z.infer<typeof programmaticPayloadSchema>,
) {
  const parsed = programmaticPayloadSchema.safeParse(input);
  if (!parsed.success) return { error: "Carga inválida." };
  const data = parsed.data;
  try {
    await authorize(data.companyId);
    const ensured = await ensureDailyReport({
      companyId: data.companyId,
      reportDate: data.reportDate,
    });
    if ("error" in ensured) return ensured;
    const reportId = ensured.reportId;
    const results = await Promise.all([
      data.reconciliation
        ? saveReconciliation({
            companyId: data.companyId,
            reportId,
            statementEnding: data.reconciliation.statementEnding,
            register: data.reconciliation.register,
            items: data.reconciliation.items,
            sourcePdfPath: data.reconciliation.sourcePdfPath,
            source: "claude-controlado",
          })
        : null,
      data.bankExport
        ? saveBankExport({
            companyId: data.companyId,
            reportId,
            closingBalance: data.bankExport.closingBalance,
            movements: data.bankExport.movements,
            sourcePdfPath: data.bankExport.sourcePdfPath,
            source: "claude-controlado",
          })
        : null,
      data.agingVendors
        ? saveAgingVendors({
            companyId: data.companyId,
            reportId,
            rawTotal: data.agingVendors.rawTotal,
            items: data.agingVendors.items,
            sourcePdfPath: data.agingVendors.sourcePdfPath,
            source: "claude-controlado",
          })
        : null,
      data.agingCustomers
        ? saveAgingCustomers({
            companyId: data.companyId,
            reportId,
            rawTotal: data.agingCustomers.rawTotal,
            items: data.agingCustomers.items,
            sourcePdfPath: data.agingCustomers.sourcePdfPath,
            source: "claude-controlado",
          })
        : null,
    ]);
    const errors = results.filter(
      (result): result is { error: string } => Boolean(result && "error" in result),
    );
    if (errors.length) return { error: errors.map((e) => e.error).join(" ") };

    if (data.varianceLines?.length) {
      const varianceResults = await Promise.all(
        data.varianceLines.map((line) =>
          saveVarianceLine({
            companyId: data.companyId,
            reportId,
            concept: line.concept,
            amount: line.amount,
          }),
        ),
      );
      const varianceErrors = varianceResults.filter(
        (result): result is { error: string } => "error" in result,
      );
      if (varianceErrors.length) return { error: varianceErrors.map((e) => e.error).join(" ") };
    }

    return { success: true, reportId };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Generación de los 5 PDF (pdf-lib). Cada llamada crea una versión nueva en
// cutmeat_daily_generated_pdfs -- nunca sobrescribe un storage_path previo.
// ---------------------------------------------------------------------------

export type CutMeatPdfDocType =
  | "reconciliation"
  | "bank"
  | "consolidated"
  | "vendors"
  | "customers";

function buildPdfFilename(docType: CutMeatPdfDocType, reportDate: IsoDate): string {
  const [year, month, day] = reportDate.split("-");
  switch (docType) {
    case "reconciliation":
      return `CUTD-Reconciliation_Report_${month}-${day}-${year}.pdf`;
    case "bank":
      return `CUTD-Export-${month}${day}${year}.pdf`;
    case "consolidated":
      return `CUTD-Consolidated-${month}-${day}-${year}.pdf`;
    case "vendors":
      return `AGING-VENDORS-WAGYU_FOOD_SERVICES.pdf`;
    case "customers":
      return `AGING-CUSTOMERS-WAGYU_FOOD_SERVICES.pdf`;
  }
}

export async function generateDailyPdf(input: {
  companyId: string;
  reportDate: string;
  docType: CutMeatPdfDocType;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      reportDate: isoDate,
      docType: z.enum(["reconciliation", "bank", "consolidated", "vendors", "customers"]),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Solicitud de PDF inválida." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const workspace = await getDailyReportWorkspace(data.companyId, data.reportDate as IsoDate);
    const report = workspace.report;
    if (!report) return { error: "Primero guardá algún dato para este día." };
    const reportDate = data.reportDate as IsoDate;

    let bytes: Uint8Array;
    switch (data.docType) {
      case "reconciliation": {
        if (!workspace.reconciliation || !workspace.reconciliationControl)
          return { error: "Todavía no se cargó la conciliación de este día." };
        bytes = await buildReconciliationPdf({
          reportDate,
          control: workspace.reconciliationControl,
          checks: workspace.reconciliation.unclearedChecks.map((item) => ({
            name: item.reference,
            balance: Number(item.amount),
          })),
          deposits: workspace.reconciliation.unclearedDeposits.map((item) => ({
            name: item.reference,
            balance: Number(item.amount),
          })),
        });
        break;
      }
      case "bank": {
        if (!workspace.bankExport)
          return { error: "Todavía no se cargó el export del banco de este día." };
        bytes = await buildBankExportPdf({
          reportDate,
          closingBalance: workspace.bankExport.closingBalance,
          movements: workspace.bankMovements,
        });
        break;
      }
      case "vendors": {
        if (!workspace.vendorAging)
          return { error: "Todavía no se cargó el aging de proveedores de este día." };
        bytes = await buildAgingVendorsPdf({
          reportDate,
          items: workspace.vendorItems,
          rawTotal: workspace.vendorAging.rawTotal,
          groups: workspace.vendorGroups,
        });
        break;
      }
      case "customers": {
        if (!workspace.customerAging)
          return { error: "Todavía no se cargó el aging de clientes de este día." };
        bytes = await buildAgingCustomersPdf({
          reportDate,
          items: workspace.customerItems,
          rawTotal: workspace.customerAging.rawTotal,
          groups: workspace.customerGroups,
        });
        break;
      }
      case "consolidated": {
        bytes = await buildConsolidatedPdf({
          reportDate,
          control: workspace.reconciliationControl,
          recurrentes: {
            prior: workspace.buckets.prior.items,
            priorTotal: workspace.buckets.prior.total,
            thisWeek: workspace.buckets.thisWeek.items,
            thisWeekTotal: workspace.buckets.thisWeek.total,
          },
          financial: workspace.financial,
          varianceLines: workspace.varianceLines,
          totalVariance: workspace.totalVariance,
          balanceGabriel: workspace.balanceGabriel,
          balanceWithNotEntered: workspace.balanceWithNotEntered,
          incomeDays: workspace.incomeDays,
          vendorAging: workspace.vendorAging,
          customerAgingTotal: workspace.customerAging?.consolidated ?? null,
        });
        break;
      }
    }

    const admin = createAdminClient();
    const supabase = await createClient();
    const existing = await supabase
      .from("cutmeat_daily_generated_pdfs")
      .select("version")
      .eq("report_id", report.id)
      .eq("doc_type", data.docType)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    const version = (existing.data?.version ?? 0) + 1;
    const filename = buildPdfFilename(data.docType, reportDate);
    const storagePath = `${data.companyId}/${data.reportDate}/${data.docType}/v${version}-${filename}`;
    const uploaded = await admin.storage.from("cutmeat-daily").upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    const inserted = await supabase
      .from("cutmeat_daily_generated_pdfs")
      .insert({
        report_id: report.id,
        doc_type: data.docType,
        version,
        storage_path: storagePath,
        generated_by: profile.id,
      })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    await logEvent(report.id, "pdf_generated", profile.id, {
      docType: data.docType,
      version,
    });
    refresh(data.companyId);
    return { success: true, storagePath, version, filename };
  } catch (error) {
    return failure(error);
  }
}
