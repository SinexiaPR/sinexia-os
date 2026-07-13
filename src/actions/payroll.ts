"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSibaritaCompany } from "@/services/payroll";

async function authorizeCompany(requestedCompanyId: string) {
  const profile = await requireAuth();
  if (profile.role === "client" && profile.company_id !== requestedCompanyId)
    throw new Error("No autorizado.");
  const company = await resolveSibaritaCompany(requestedCompanyId);
  if (!company)
    throw new Error("La nómina semanal solo está disponible para Sibarita.");
  return { profile, company };
}

const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(120),
  section: z.enum(["BOTANICO FOH", "SELVA FOH", "BOH"]),
  compensationType: z.enum(["hourly", "hourly_training", "fixed_weekly"]),
  regularRate: z.number().min(0).nullable(),
  trainingRate: z.number().min(0).nullable(),
  fixedSalary: z.number().min(0).nullable(),
  internalNote: z.string().trim().max(1000).nullable().optional(),
});

export type PayrollEmployeeInput = z.infer<typeof employeeSchema>;

export async function savePayrollEmployee(input: PayrollEmployeeInput) {
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Revisa los datos y tarifas del empleado." };
  const data = parsed.data;
  try {
    await authorizeCompany(data.companyId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No autorizado." };
  }
  if (
    data.compensationType !== "fixed_weekly" &&
    (!data.regularRate || data.regularRate <= 0)
  )
    return { error: "La tarifa regular debe ser mayor que cero." };
  if (
    data.compensationType === "hourly_training" &&
    (!data.trainingRate || data.trainingRate <= 0)
  )
    return { error: "La tarifa de entrenamiento debe ser mayor que cero." };
  if (
    data.compensationType === "fixed_weekly" &&
    (!data.fixedSalary || data.fixedSalary <= 0)
  )
    return { error: "El salario semanal debe ser mayor que cero." };
  const values = {
    company_id: data.companyId,
    first_name: data.firstName,
    last_name: data.lastName,
    section: data.section,
    compensation_type: data.compensationType,
    regular_hourly_rate:
      data.compensationType === "fixed_weekly" ? null : data.regularRate,
    training_hourly_rate:
      data.compensationType === "hourly_training" ? data.trainingRate : 0,
    fixed_weekly_salary:
      data.compensationType === "fixed_weekly" ? data.fixedSalary : null,
    requires_compensation_review: false,
    internal_note: data.internalNote ?? null,
  };
  const supabase = await createClient();
  const { error } = data.id
    ? await supabase
        .from("payroll_employees")
        .update(values)
        .eq("id", data.id)
        .eq("company_id", data.companyId)
    : await supabase.from("payroll_employees").insert(values);
  if (error)
    return {
      error:
        error.code === "23505" ? "Este empleado ya existe." : error.message,
    };
  revalidatePath("/dashboard/payroll");
  return { success: true };
}

export async function setPayrollEmployeeActive(
  companyId: string,
  employeeId: string,
  active: boolean,
) {
  try {
    await authorizeCompany(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_employees")
    .update({ active })
    .eq("id", employeeId)
    .eq("company_id", companyId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/payroll");
  return { success: true };
}

export async function createWeeklyPayroll(
  companyId: string,
  weekStart: string,
) {
  let profile;
  try {
    ({ profile } = await authorizeCompany(companyId));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No autorizado." };
  }
  const parsed = z.string().date().safeParse(weekStart);
  if (!parsed.success) return { error: "Fecha no válida." };
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_payrolls").insert({
    company_id: companyId,
    week_start: weekStart,
    week_end: end.toISOString().slice(0, 10),
    created_by: profile.id,
  });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Ya existe una nómina para esa semana."
          : error.message,
    };
  revalidatePath("/dashboard/payroll");
  return { success: true };
}

const entryUpdateSchema = z.object({
  id: z.string().uuid(),
  regularHours: z.number().min(0),
  trainingHours: z.number().min(0),
  otherPayments: z.number().min(0),
  comment: z.string().max(500).nullable(),
});
export type PayrollEntryUpdate = z.infer<typeof entryUpdateSchema>;

export async function saveWeeklyPayrollEntries(
  companyId: string,
  payrollId: string,
  updates: PayrollEntryUpdate[],
) {
  try {
    await authorizeCompany(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const parsed = z.array(entryUpdateSchema).safeParse(updates);
  if (!parsed.success) return { error: "Hay valores inválidos o negativos." };
  const supabase = await createClient();
  const { data: payroll } = await supabase
    .from("weekly_payrolls")
    .select("id,status")
    .eq("id", payrollId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!payroll || payroll.status !== "draft")
    return { error: "Solo se pueden editar borradores." };
  for (const update of parsed.data) {
    const { error } = await supabase
      .from("weekly_payroll_entries")
      .update({
        regular_hours: update.regularHours,
        training_hours: update.trainingHours,
        other_payments: update.otherPayments,
        comment: update.comment,
      })
      .eq("id", update.id)
      .eq("payroll_id", payrollId);
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/payroll");
  return { success: true };
}

export async function submitWeeklyPayroll(
  companyId: string,
  payrollId: string,
) {
  try {
    await authorizeCompany(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_payrolls")
    .update({ status: "submitted" })
    .eq("id", payrollId)
    .eq("company_id", companyId)
    .eq("status", "draft");
  if (error)
    return {
      error: error.message.includes("invalid or unreviewed")
        ? "Configura las tarifas y revisiones pendientes antes de enviar."
        : error.message,
    };
  revalidatePath("/dashboard/payroll");
  return { success: true };
}

export async function approveWeeklyPayroll(
  companyId: string,
  payrollId: string,
) {
  const profile = await requireAuth();
  if (profile.role !== "admin")
    return { error: "Solo un administrador puede aprobar la nómina." };
  try {
    await authorizeCompany(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_payrolls")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", payrollId)
    .eq("company_id", companyId)
    .eq("status", "submitted");
  if (error) return { error: error.message };
  revalidatePath("/dashboard/payroll");
  return { success: true };
}
