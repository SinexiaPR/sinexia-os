"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { markPaid, shiftPeriod } from "@/lib/cutmeat-recurrentes/calculations";
import { createClient } from "@/lib/supabase/server";
import { resolveCutMeatCompany } from "@/services/cutmeat-daily";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite().min(0).max(9_999_999);

async function authorize(companyId: string) {
  const profile = await requireAdmin();
  const company = await resolveCutMeatCompany(companyId);
  if (!company) {
    throw new Error("Los recurrentes están disponibles únicamente para Cut Meat Distributors.");
  }
  return { profile, company };
}

function refresh(companyId: string) {
  revalidatePath(`/dashboard/admin/companies/${companyId}/recurrentes`);
}

function failure(error: unknown) {
  return {
    error: error instanceof Error ? error.message : "No se pudo completar la acción.",
  };
}

async function logHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recurrenteId: string,
  previousValue: unknown,
  newValue: unknown,
  changedBy: string,
) {
  await supabase.from("cutmeat_recurrentes_history").insert({
    recurrente_id: recurrenteId,
    previous_value: previousValue ?? null,
    new_value: newValue,
    changed_by: changedBy,
  });
}

const recurrenteSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  period: isoDate,
  fecha: isoDate.nullable().optional(),
  trType: z.string().trim().max(60).nullable().optional(),
  num: z.string().trim().max(120).nullable().optional(),
  vendor: z.string().trim().min(1).max(200),
  dueDate: isoDate.nullable().optional(),
  amount: money,
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function saveRecurrente(input: z.infer<typeof recurrenteSchema>) {
  const parsed = recurrenteSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los datos del recurrente." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();
    const values = {
      company_id: data.companyId,
      period: data.period,
      fecha: data.fecha ?? null,
      tr_type: data.trType ?? null,
      num: data.num ?? null,
      vendor: data.vendor,
      due_date: data.dueDate ?? null,
      amount: data.amount,
      notes: data.notes ?? null,
      updated_by: profile.id,
    };
    if (data.id) {
      const previous = await supabase
        .from("cutmeat_recurrentes")
        .select("*")
        .eq("id", data.id)
        .eq("company_id", data.companyId)
        .single();
      if (previous.error) throw previous.error;
      const { error } = await supabase
        .from("cutmeat_recurrentes")
        .update(values)
        .eq("id", data.id)
        .eq("company_id", data.companyId);
      if (error) throw error;
      await logHistory(supabase, data.id, previous.data, values, profile.id);
    } else {
      const inserted = await supabase
        .from("cutmeat_recurrentes")
        .insert(values)
        .select("id")
        .single();
      if (inserted.error) throw inserted.error;
      await logHistory(supabase, inserted.data.id, null, values, profile.id);
    }
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRecurrente(input: { companyId: string; id: string }) {
  const parsed = z
    .object({ companyId: z.string().uuid(), id: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Recurrente inválido." };
  try {
    await authorize(parsed.data.companyId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cutmeat_recurrentes")
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

const markPaidSchema = z.object({
  companyId: z.string().uuid(),
  id: z.string().uuid(),
  paid: z.boolean(),
  paidDate: isoDate.nullable().optional(),
  paidAmount: money.nullable().optional(),
});

export async function markRecurrentePaid(input: z.infer<typeof markPaidSchema>) {
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos de pago inválidos." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();
    const current = await supabase
      .from("cutmeat_recurrentes")
      .select("*")
      .eq("id", data.id)
      .eq("company_id", data.companyId)
      .single();
    if (current.error) throw current.error;

    const updated = markPaid(
      { id: data.id, vendor: current.data.vendor, dueDate: current.data.due_date, amount: Number(current.data.amount), pagado: current.data.pagado },
      { paid: data.paid, paidDate: data.paidDate, paidAmount: data.paidAmount },
    );
    const values = {
      pagado: updated.pagado,
      paid_date: updated.paidDate,
      paid_amount: updated.paidAmount,
      updated_by: profile.id,
    };
    const { error } = await supabase
      .from("cutmeat_recurrentes")
      .update(values)
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw error;
    await logHistory(supabase, data.id, current.data, { ...current.data, ...values }, profile.id);
    refresh(data.companyId);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

const copyPreviousMonthSchema = z.object({
  companyId: z.string().uuid(),
  fromPeriod: isoDate,
  toPeriod: isoDate,
});

/**
 * Copia los recurrentes de un mes al siguiente, sin marcar ningún pago
 * (período, fecha y vencimiento se corren un mes; notas quedan vacías
 * porque las del mes anterior son sobre pagos/confirmaciones que ya no
 * aplican). No hace nada si el mes destino ya tiene recurrentes cargados
 * -- evita duplicar si se clickea más de una vez.
 */
export async function copyPreviousMonth(input: z.infer<typeof copyPreviousMonthSchema>) {
  const parsed = copyPreviousMonthSchema.safeParse(input);
  if (!parsed.success) return { error: "Períodos inválidos." };
  const data = parsed.data;
  try {
    const { profile } = await authorize(data.companyId);
    const supabase = await createClient();

    const existing = await supabase
      .from("cutmeat_recurrentes")
      .select("id")
      .eq("company_id", data.companyId)
      .eq("period", data.toPeriod)
      .limit(1);
    if (existing.error) throw existing.error;
    if (existing.data && existing.data.length > 0) {
      return { error: `Ya hay recurrentes cargados para ${data.toPeriod}.` };
    }

    const source = await supabase
      .from("cutmeat_recurrentes")
      .select("*")
      .eq("company_id", data.companyId)
      .eq("period", data.fromPeriod);
    if (source.error) throw source.error;
    if (!source.data || source.data.length === 0) {
      return { error: `No hay recurrentes en ${data.fromPeriod} para copiar.` };
    }

    const rows = source.data.map((row) => ({
      company_id: data.companyId,
      period: data.toPeriod,
      fecha: row.fecha ? shiftPeriod(row.fecha, 1) : null,
      tr_type: row.tr_type,
      num: row.num,
      vendor: row.vendor,
      due_date: row.due_date ? shiftPeriod(row.due_date, 1) : null,
      amount: row.amount,
      pagado: false,
      paid_date: null,
      paid_amount: null,
      notes: null,
      updated_by: profile.id,
    }));
    const inserted = await supabase.from("cutmeat_recurrentes").insert(rows);
    if (inserted.error) throw inserted.error;
    refresh(data.companyId);
    return { success: true, copied: rows.length };
  } catch (error) {
    return failure(error);
  }
}
