"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { categoryHintFor } from "@/lib/tresbe-budget/category-hints";
import { weekStartOf } from "@/lib/tresbe-budget/dates";
import { buildForecastForWeek } from "@/lib/tresbe-budget/forecast";
import {
  getBudgetAssumptions,
  getBudgetCategories,
  resolveTresbeCompany,
} from "@/services/tresbe-budget";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite().min(0).max(99_999_999);

async function authorize(companyId: string) {
  const profile = await requireAdmin();
  const company = await resolveTresbeCompany(companyId);
  if (!company) {
    throw new Error("El presupuesto está disponible únicamente para Tresbe.");
  }
  return { profile, company };
}

function refresh(companyId: string) {
  revalidatePath(`/dashboard/admin/companies/${companyId}/budget`);
}

function failure(error: unknown) {
  return {
    error:
      error instanceof Error
        ? error.message
        : "No se pudo completar la acción.",
  };
}

// ---------------------------------------------------------------------------
// Movimientos reales
// ---------------------------------------------------------------------------

const movementSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  entryDate: isoDate,
  direction: z.enum(["ingreso", "egreso"]),
  categoryId: z.string().uuid(),
  concept: z.string().trim().min(1).max(200),
  counterparty: z.string().trim().max(200).nullable(),
  amount: money.refine((value) => value > 0, "El importe debe ser mayor a 0."),
  account: z.string().trim().max(100).nullable(),
  note: z.string().trim().max(1000).nullable(),
  // La categoría forzada por el concepto solo se puede saltear a conciencia.
  overrideHint: z.boolean().optional(),
});
export type BudgetMovementInput = z.infer<typeof movementSchema>;

export async function saveBudgetMovement(input: BudgetMovementInput) {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del movimiento." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const categories = await getBudgetCategories(data.companyId);
    const category = categories.find((item) => item.id === data.categoryId);
    if (!category) return { error: "Categoría inválida." };
    if (
      category.kind !== "financiamiento" &&
      category.kind !== data.direction
    ) {
      return {
        error: `La categoría "${category.name}" no admite movimientos de ${data.direction}.`,
      };
    }
    const hint = categoryHintFor(data.concept, data.counterparty);
    if (
      hint &&
      hint.level === "obligatoria" &&
      hint.code !== category.code &&
      !data.overrideHint
    ) {
      const expected = categories.find((item) => item.code === hint.code);
      return {
        error: `${hint.reason} Categoría esperada: ${expected?.name ?? hint.code}.`,
        hint,
      };
    }
    const supabase = await createClient();
    const values = {
      company_id: data.companyId,
      entry_date: data.entryDate,
      week_start: weekStartOf(data.entryDate),
      direction: data.direction,
      category_id: data.categoryId,
      concept: data.concept,
      counterparty: data.counterparty || null,
      amount: data.amount,
      account: data.account || null,
      note: data.note || null,
      updated_by: profile.id,
    };
    const { error } = data.id
      ? await supabase
          .from("tresbe_budget_movements")
          .update(values)
          .eq("id", data.id)
          .eq("company_id", data.companyId)
      : await supabase
          .from("tresbe_budget_movements")
          .insert({ ...values, created_by: profile.id });
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBudgetMovement(input: {
  companyId: string;
  id: string;
}) {
  const parsed = z
    .object({ companyId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Movimiento inválido." };
  try {
    await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("tresbe_budget_movements")
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

// ---------------------------------------------------------------------------
// Presupuesto: generación desde supuestos y edición manual
// ---------------------------------------------------------------------------

export async function generateWeeklyBudget(input: {
  companyId: string;
  weekStart: string;
  overwriteManual?: boolean;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      weekStart: isoDate,
      overwriteManual: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Semana inválida." };
  const { companyId, overwriteManual } = parsed.data;
  const weekStart = weekStartOf(parsed.data.weekStart);
  try {
    const { profile } = await authorize(companyId);
    const [categories, assumptions] = await Promise.all([
      getBudgetCategories(companyId),
      getBudgetAssumptions(companyId),
    ]);
    if (!assumptions) {
      return {
        error: "Configura primero los supuestos del forecast.",
      };
    }
    const byCode = new Map(categories.map((item) => [item.code, item.id]));
    const required = [
      "credit_card_disponible",
      "cash_disponible",
      "nomina",
      "payroll_taxes",
    ];
    const missing = required.filter((code) => !byCode.has(code));
    if (missing.length) {
      return { error: `Faltan categorías base: ${missing.join(", ")}.` };
    }
    const forecast = buildForecastForWeek({
      weekStart,
      settings: assumptions.settings,
      salesPattern: assumptions.salesPattern,
      recurringDebits: assumptions.recurringDebits,
      vendors: assumptions.vendorSchedule,
      categoryIds: {
        creditCard: byCode.get("credit_card_disponible")!,
        cash: byCode.get("cash_disponible")!,
        payroll: byCode.get("nomina")!,
        payrollTaxes: byCode.get("payroll_taxes")!,
      },
    });

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("tresbe_budget_entries")
      .select("id,entry_date,category_id,origin")
      .eq("company_id", companyId)
      .eq("week_start", weekStart);
    if (existingError) throw existingError;
    const manualKeys = new Set(
      (existing ?? [])
        .filter((row) => row.origin === "manual")
        .map((row) => `${row.category_id}|${row.entry_date}`),
    );

    // Las celdas editadas a mano se respetan salvo confirmación explícita.
    const keptManual = overwriteManual ? 0 : manualKeys.size;
    const rows = forecast
      .filter(
        (entry) =>
          overwriteManual ||
          !manualKeys.has(`${entry.categoryId}|${entry.entryDate}`),
      )
      .map((entry) => ({
        company_id: companyId,
        entry_date: entry.entryDate,
        week_start: weekStart,
        category_id: entry.categoryId,
        amount: entry.amount,
        origin: "calculado" as const,
        note: entry.sources.slice(0, 4).join(" · ").slice(0, 500),
        generated_at: new Date().toISOString(),
        updated_by: profile.id,
      }));

    // Se limpian las celdas calculadas anteriores para que un supuesto dado de
    // baja no deje un importe fantasma en la semana.
    const staleIds = (existing ?? [])
      .filter((row) => (overwriteManual ? true : row.origin === "calculado"))
      .filter(
        (row) =>
          !rows.some(
            (entry) =>
              entry.category_id === row.category_id &&
              entry.entry_date === row.entry_date,
          ),
      )
      .map((row) => row.id);
    if (staleIds.length) {
      const { error } = await supabase
        .from("tresbe_budget_entries")
        .delete()
        .in("id", staleIds);
      if (error) throw error;
    }
    if (rows.length) {
      const { error } = await supabase
        .from("tresbe_budget_entries")
        .upsert(rows, { onConflict: "company_id,entry_date,category_id" });
      if (error) throw error;
    }
    refresh(companyId);
    return { success: true, generated: rows.length, keptManual };
  } catch (error) {
    return failure(error);
  }
}

export async function saveBudgetCell(input: {
  companyId: string;
  entryDate: string;
  categoryId: string;
  amount: number;
  note?: string | null;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      entryDate: isoDate,
      categoryId: z.string().uuid(),
      amount: money,
      note: z.string().trim().max(500).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Importe inválido." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("tresbe_budget_entries").upsert(
      {
        company_id: data.companyId,
        entry_date: data.entryDate,
        week_start: weekStartOf(data.entryDate),
        category_id: data.categoryId,
        amount: data.amount,
        origin: "manual" as const,
        note: data.note ?? null,
        updated_by: profile.id,
      },
      { onConflict: "company_id,entry_date,category_id" },
    );
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Control de caja
// ---------------------------------------------------------------------------

export async function saveCashControl(input: {
  companyId: string;
  weekStart: string;
  openingBankBalance: number;
  actualBankBalance: number | null;
  minimumCashTarget: number | null;
  notes: string | null;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      weekStart: isoDate,
      openingBankBalance: z.number().finite(),
      actualBankBalance: z.number().finite().nullable(),
      minimumCashTarget: z.number().finite().min(0).nullable(),
      notes: z.string().trim().max(1000).nullable(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { error: "Revisa los importes del control de caja." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("tresbe_budget_cash_control").upsert(
      {
        company_id: data.companyId,
        week_start: weekStartOf(data.weekStart),
        opening_bank_balance: data.openingBankBalance,
        actual_bank_balance: data.actualBankBalance,
        minimum_cash_target: data.minimumCashTarget,
        notes: data.notes || null,
        updated_by: profile.id,
      },
      { onConflict: "company_id,week_start" },
    );
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Supuestos del forecast
// ---------------------------------------------------------------------------

const rate = z.number().finite().min(0).max(1);

export async function saveBudgetSettings(input: {
  companyId: string;
  weekOneStart: string;
  forecastWeeks: number;
  processorFeeRate: number;
  loanHoldbackRate: number;
  cardSettlementLagDays: number;
  payrollAmount: number;
  payrollWeekday: number;
  relatedCashOutLabel: string | null;
  relatedCashOutAmount: number;
  relatedCashOutEnabled: boolean;
  payrollTaxRate: number;
  payrollTaxOffsetDays: number;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      weekOneStart: isoDate,
      forecastWeeks: z.number().int().min(1).max(52),
      processorFeeRate: rate,
      loanHoldbackRate: rate,
      cardSettlementLagDays: z.number().int().min(0).max(14),
      payrollAmount: money,
      payrollWeekday: z.number().int().min(1).max(7),
      relatedCashOutLabel: z.string().trim().max(120).nullable(),
      relatedCashOutAmount: money,
      relatedCashOutEnabled: z.boolean(),
      payrollTaxRate: rate,
      payrollTaxOffsetDays: z.number().int().min(0).max(14),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisa los supuestos." };
  const data = parsed.data;
  try {
    await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("tresbe_budget_settings").upsert(
      {
        company_id: data.companyId,
        week_one_start: weekStartOf(data.weekOneStart),
        forecast_weeks: data.forecastWeeks,
        processor_fee_rate: data.processorFeeRate,
        loan_holdback_rate: data.loanHoldbackRate,
        card_settlement_lag_days: data.cardSettlementLagDays,
        payroll_amount: data.payrollAmount,
        payroll_weekday: data.payrollWeekday,
        related_cash_out_label: data.relatedCashOutLabel || null,
        related_cash_out_amount: data.relatedCashOutAmount,
        related_cash_out_enabled: data.relatedCashOutEnabled,
        payroll_tax_rate: data.payrollTaxRate,
        payroll_tax_offset_days: data.payrollTaxOffsetDays,
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

export async function saveSalesPattern(input: {
  companyId: string;
  rows: Array<{ weekday: number; grossSales: number; cardShare: number }>;
}) {
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      rows: z
        .array(
          z.object({
            weekday: z.number().int().min(1).max(7),
            grossSales: money,
            cardShare: rate,
          }),
        )
        .min(1)
        .max(7),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Revisa el patrón de ventas." };
  const data = parsed.data;
  try {
    await authorize(data.companyId);
    const supabase = await createClient();
    const { error } = await supabase.from("tresbe_budget_sales_pattern").upsert(
      data.rows.map((row) => ({
        company_id: data.companyId,
        weekday: row.weekday,
        gross_sales: row.grossSales,
        card_share: row.cardShare,
      })),
      { onConflict: "company_id,weekday" },
    );
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

const recurringDebitSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  concept: z.string().trim().min(1).max(200),
  classification: z.string().trim().max(120).nullable(),
  categoryId: z.string().uuid(),
  amount: money,
  frequency: z.enum(["semanal", "quincenal", "mensual"]),
  weekday: z.number().int().min(1).max(7).nullable(),
  dayOfMonth: z.number().int().min(1).max(31).nullable(),
  weekendShift: z.enum(["ninguno", "viernes_anterior", "lunes_siguiente"]),
  confidence: z.enum(["alta", "media", "baja"]),
  isActive: z.boolean(),
  note: z.string().trim().max(500).nullable(),
});

export async function saveRecurringDebit(
  input: z.infer<typeof recurringDebitSchema>,
) {
  const parsed = recurringDebitSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa el débito recurrente." };
  const data = parsed.data;
  if (data.frequency === "mensual" ? !data.dayOfMonth : !data.weekday) {
    return {
      error:
        data.frequency === "mensual"
          ? "Indica el día del mes."
          : "Indica el día de la semana.",
    };
  }
  try {
    await authorize(data.companyId);
    const supabase = await createClient();
    const values = {
      company_id: data.companyId,
      concept: data.concept,
      classification: data.classification || null,
      category_id: data.categoryId,
      amount: data.amount,
      frequency: data.frequency,
      weekday: data.frequency === "mensual" ? null : data.weekday,
      day_of_month: data.frequency === "mensual" ? data.dayOfMonth : null,
      weekend_shift: data.weekendShift,
      confidence: data.confidence,
      is_active: data.isActive,
      note: data.note || null,
    };
    const { error } = data.id
      ? await supabase
          .from("tresbe_budget_recurring_debits")
          .update(values)
          .eq("id", data.id)
          .eq("company_id", data.companyId)
      : await supabase.from("tresbe_budget_recurring_debits").insert(values);
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRecurringDebit(input: {
  companyId: string;
  id: string;
}) {
  const parsed = z
    .object({ companyId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Débito inválido." };
  try {
    await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("tresbe_budget_recurring_debits")
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

const vendorSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  vendorName: z.string().trim().min(1).max(200),
  vendorType: z.enum([
    "proveedor_activo",
    "recurrente_al_dia",
    "compra_mercaderia_cash",
  ]),
  categoryId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  amount: money,
  isActive: z.boolean(),
  note: z.string().trim().max(500).nullable(),
});

export async function saveVendorSchedule(input: z.infer<typeof vendorSchema>) {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa el proveedor." };
  const data = parsed.data;
  try {
    await authorize(data.companyId);
    const supabase = await createClient();
    const values = {
      company_id: data.companyId,
      vendor_name: data.vendorName,
      vendor_type: data.vendorType,
      category_id: data.categoryId,
      weekday: data.weekday,
      amount: data.amount,
      is_active: data.isActive,
      note: data.note || null,
    };
    const { error } = data.id
      ? await supabase
          .from("tresbe_budget_vendor_schedule")
          .update(values)
          .eq("id", data.id)
          .eq("company_id", data.companyId)
      : await supabase.from("tresbe_budget_vendor_schedule").insert(values);
    if (error) throw error;
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteVendorSchedule(input: {
  companyId: string;
  id: string;
}) {
  const parsed = z
    .object({ companyId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Proveedor inválido." };
  try {
    await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("tresbe_budget_vendor_schedule")
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
