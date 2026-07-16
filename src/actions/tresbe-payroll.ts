"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireAuth } from "@/lib/auth/session";
import {
  reverseLeaveAccrualForTresbePayroll,
  syncLeaveAccrualForTresbePayroll,
} from "@/lib/leave-accrual/processing";
import { createClient } from "@/lib/supabase/server";
import {
  sendPayrollEmail,
  isPayrollEmailConfigured,
} from "@/lib/tresbe-payroll/email";
import { buildTresbePayrollPdf } from "@/lib/tresbe-payroll/pdf";
import {
  resolveTresbeCompany,
  type TresbePayroll,
  type TresbePayrollEntry,
} from "@/services/tresbe-payroll";

async function authorizeTresbeAdmin(companyId: string) {
  const profile = await requireAdmin();
  const company = await resolveTresbeCompany(companyId);
  if (!company)
    throw new Error("La nómina está disponible únicamente para Tresbe.");
  return { profile, company };
}

const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(120).nullable(),
  area: z.string().trim().min(1).max(100),
  paymentMethod: z.enum(["payroll_system", "services", "mixed", "manual"]),
  payrollRule: z.enum([
    "unconfigured",
    "standard_hourly_40_plus_services",
    "preset_40_hourly",
    "full_services",
    "preset_40_weekly_salary",
    "fixed_weekly_salary",
    "custom_manual",
  ]),
  receivesProportionalTips: z.boolean(),
  regularRate: z.number().min(0).nullable(),
  serviceRate: z.number().min(0).nullable(),
  defaultHours: z.number().min(0).nullable(),
  defaultSalary: z.number().min(0).nullable(),
  annualSalary: z.number().min(0).nullable(),
  hiringDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  workerClassification: z.enum(["w2", "services", "contractor"]),
  internalNote: z.string().trim().max(1000).nullable(),
  aliases: z.array(z.string().trim().min(1).max(202)).max(30),
});
export type TresbeEmployeeInput = z.infer<typeof employeeSchema>;

export async function saveTresbeEmployee(input: TresbeEmployeeInput) {
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del empleado." };
  let profile;
  try {
    ({ profile } = await authorizeTresbeAdmin(parsed.data.companyId));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No autorizado." };
  }
  const data = parsed.data;
  const weeklySalary =
    data.annualSalary != null
      ? Math.round((data.annualSalary / 52) * 100) / 100
      : data.defaultSalary;
  const wageConfigured =
    data.payrollRule === "full_services"
      ? (weeklySalary ?? 0) > 0 ||
        (data.serviceRate ?? data.regularRate ?? 0) > 0
      : ["fixed_weekly_salary", "preset_40_weekly_salary"].includes(
            data.payrollRule,
          )
        ? (weeklySalary ?? 0) > 0
        : ["standard_hourly_40_plus_services", "preset_40_hourly"].includes(
              data.payrollRule,
            )
          ? (data.regularRate ?? 0) > 0
          : data.payrollRule === "custom_manual";
  const values = {
    company_id: data.companyId,
    first_name: data.firstName,
    last_name: data.lastName || null,
    area: data.area,
    payment_method: data.paymentMethod,
    payroll_rule: data.payrollRule,
    receives_proportional_tips: data.receivesProportionalTips,
    regular_hourly_rate: data.regularRate,
    service_hourly_rate: data.serviceRate,
    default_weekly_hours: [
      "preset_40_hourly",
      "preset_40_weekly_salary",
    ].includes(data.payrollRule)
      ? 40
      : data.defaultHours,
    default_weekly_salary: weeklySalary,
    annual_salary: data.annualSalary,
    wage_requires_review: !wageConfigured,
    wage_review_reason: wageConfigured
      ? null
      : "Wage requires administrator review",
    wage_source: "Manual administrator update",
    wage_updated_at: new Date().toISOString(),
    hiring_date: data.hiringDate,
    worker_classification: data.workerClassification,
    internal_note: data.internalNote,
    updated_by: profile.id,
  };
  const supabase = await createClient();
  const result = data.id
    ? await supabase
        .from("tresbe_employees")
        .update(values)
        .eq("id", data.id)
        .eq("company_id", data.companyId)
        .select("*")
        .single()
    : await supabase
        .from("tresbe_employees")
        .insert({
          ...values,
          created_by: profile.id,
        })
        .select("*")
        .single();
  if (result.error) {
    console.error("saveTresbeEmployee", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      error:
        result.error.code === "23505"
          ? "Ya existe un empleado con ese nombre."
          : result.error.code === "PGRST116"
            ? "No se encontró el empleado que intentas actualizar. Recarga la página."
            : "No se pudo guardar la configuración del empleado.",
    };
  }
  const aliasesResult = await supabase.rpc("replace_tresbe_employee_aliases", {
    p_employee_id: result.data.id,
    p_aliases: data.aliases,
  });
  if (aliasesResult.error) {
    console.error("saveTresbeEmployee.aliases", {
      code: aliasesResult.error.code,
      message: aliasesResult.error.message,
    });
    return {
      error: "El empleado se guardó, pero no se pudieron guardar sus alias.",
    };
  }
  revalidatePath(`/dashboard/admin/companies/${data.companyId}/payroll`);
  return {
    success: true,
    employee: {
      ...result.data,
      tresbe_employee_aliases: (aliasesResult.data ?? []).map(
        (alias: { alias_name: string }) => ({ alias_name: alias.alias_name }),
      ),
    },
  };
}

export async function setTresbeEmployeeActive(
  companyId: string,
  employeeId: string,
  isActive: boolean,
) {
  let profile;
  try {
    ({ profile } = await authorizeTresbeAdmin(companyId));
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tresbe_employees")
    .update({ is_active: isActive, updated_by: profile.id })
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .select("id,is_active")
    .single();
  if (error || !data) {
    console.error("setTresbeEmployeeActive", {
      code: error?.code,
      message: error?.message,
    });
    return { error: "No se pudo actualizar el estado del empleado." };
  }
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  return { success: true };
}

export async function reconcileTresbeEmployees(companyId: string) {
  try {
    await authorizeTresbeAdmin(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reconcile_tresbe_employees", {
    p_company_id: companyId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  return { success: true };
}

export async function createTresbePayroll(
  companyId: string,
  weekStart: string,
) {
  const parsedDate = z.string().date().safeParse(weekStart);
  if (!parsedDate.success) return { error: "Fecha de inicio no válida." };
  let profile;
  try {
    ({ profile } = await authorizeTresbeAdmin(companyId));
  } catch {
    return { error: "No autorizado." };
  }
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tresbe_payrolls")
    .insert({
      company_id: companyId,
      week_start: weekStart,
      week_end: end.toISOString().slice(0, 10),
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const existing = await supabase
      .from("tresbe_payrolls")
      .select("id,status")
      .eq("company_id", companyId)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (
      existing.data &&
      ["draft", "calculated", "corrected"].includes(existing.data.status)
    )
      return { success: true, payrollId: existing.data.id };
    return { error: "Ya existe una nómina cerrada para ese periodo." };
  }
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  return { success: true, payrollId: data.id };
}

const entrySchema = z.object({
  id: z.string().uuid(),
  totalWeeklyHours: z.number().min(0),
  regularRate: z.number().min(0).nullable(),
  serviceRate: z.number().min(0).nullable(),
  weeklySalary: z.number().min(0).nullable(),
  manualSystemAmount: z.number().min(0),
  tips: z.number().min(0),
  fixedServiceAmount: z.number().min(0),
  otherAdjustments: z.number(),
  vacationPaidHours: z.number().min(0),
  sickPaidHours: z.number().min(0),
  holidayPaidHours: z.number().min(0),
  juryDutyHours: z.number().min(0),
  bereavementHours: z.number().min(0),
  serviceReason: z
    .enum(["Horas sobre 40", "Empleado por servicios", "Ajuste manual", "Otro"])
    .nullable(),
  comment: z.string().trim().max(1000).nullable(),
});
export type TresbeEntryInput = z.infer<typeof entrySchema>;

export async function saveTresbePayrollDraft(params: {
  companyId: string;
  payrollId: string;
  adminNote: string | null;
  clientNote: string | null;
  emailRecipient: string | null;
  entries: TresbeEntryInput[];
}) {
  let profile;
  try {
    ({ profile } = await authorizeTresbeAdmin(params.companyId));
  } catch {
    return { error: "No autorizado." };
  }
  const parsed = z.array(entrySchema).safeParse(params.entries);
  if (!parsed.success) return { error: "Hay valores inválidos en la nómina." };
  if (
    parsed.data.some(
      (entry) => entry.otherAdjustments < 0 && (entry.comment?.length ?? 0) < 5,
    )
  )
    return { error: "Los ajustes negativos requieren un comentario." };

  const supabase = await createClient();
  const [payrollResult, entryRulesResult] = await Promise.all([
    supabase
      .from("tresbe_payrolls")
      .select("id,status")
      .eq("id", params.payrollId)
      .eq("company_id", params.companyId)
      .maybeSingle(),
    supabase
      .from("tresbe_payroll_entries")
      .select("id,payroll_rule_snapshot")
      .eq("payroll_id", params.payrollId),
  ]);
  if (
    !payrollResult.data ||
    !["draft", "calculated", "corrected"].includes(payrollResult.data.status)
  )
    return { error: "La nómina ya no se puede editar." };
  if (entryRulesResult.error) return { error: entryRulesResult.error.message };
  const entryRules = new Map(
    (entryRulesResult.data ?? []).map((entry) => [
      entry.id,
      entry.payroll_rule_snapshot,
    ]),
  );
  if (
    parsed.data.some(
      (entry) =>
        ["standard_hourly_40_plus_services", "preset_40_hourly"].includes(
          entryRules.get(entry.id) ?? "",
        ) &&
        entry.fixedServiceAmount > 0 &&
        (entry.comment?.length ?? 0) < 5,
    )
  )
    return { error: "El override de servicios requiere un comentario." };

  const header = await supabase
    .from("tresbe_payrolls")
    .update({
      admin_note: params.adminNote || null,
      client_note: params.clientNote || null,
      email_recipient: params.emailRecipient || null,
      updated_by: profile.id,
    })
    .eq("id", params.payrollId)
    .eq("company_id", params.companyId)
    .select("id")
    .single();
  if (header.error || !header.data) {
    console.error("saveTresbePayrollDraft.header", {
      code: header.error?.code,
      message: header.error?.message,
    });
    return {
      error:
        header.error?.code === "PGRST116"
          ? "La nómina ya no está disponible para editar. Recarga la página."
          : "No se pudo guardar la cabecera de la nómina.",
    };
  }

  for (const entry of parsed.data) {
    const { data, error } = await supabase
      .from("tresbe_payroll_entries")
      .update({
        total_weekly_hours: entry.totalWeeklyHours,
        regular_rate_snapshot: entry.regularRate,
        service_rate_snapshot: entry.serviceRate,
        weekly_salary_snapshot: entry.weeklySalary,
        manual_system_amount: entry.manualSystemAmount,
        tips: entry.tips,
        fixed_service_amount: entry.fixedServiceAmount,
        other_adjustments: entry.otherAdjustments,
        vacation_paid_hours: entry.vacationPaidHours,
        sick_paid_hours: entry.sickPaidHours,
        holiday_paid_hours: entry.holidayPaidHours,
        jury_duty_hours: entry.juryDutyHours,
        bereavement_hours: entry.bereavementHours,
        service_reason: entry.serviceReason,
        comment: entry.comment || null,
      })
      .eq("id", entry.id)
      .eq("payroll_id", params.payrollId)
      .select("id")
      .single();
    if (error || !data) {
      console.error("saveTresbePayrollDraft.entry", {
        entryId: entry.id,
        code: error?.code,
        message: error?.message,
      });
      return {
        error:
          error?.code === "PGRST116"
            ? "Una fila de la nómina cambió o ya no existe. Recarga la página."
            : `No se pudo guardar la entrada de ${entry.id}.`,
      };
    }
  }
  const overrides = parsed.data.filter(
    (entry) =>
      ["standard_hourly_40_plus_services", "preset_40_hourly"].includes(
        entryRules.get(entry.id) ?? "",
      ) &&
      entry.fixedServiceAmount > 0 &&
      entry.comment,
  );
  if (overrides.length) {
    const { error } = await supabase.from("tresbe_payroll_events").insert(
      overrides.map((entry) => ({
        payroll_id: params.payrollId,
        user_id: profile.id,
        event_type: "service_override",
        content: `Entrada ${entry.id}: ${entry.comment}`.slice(0, 2000),
      })),
    );
    if (error) return { error: error.message };
  }
  revalidatePath(`/dashboard/admin/companies/${params.companyId}/payroll`);
  return { success: true };
}

export async function recalculateTresbePayroll(
  companyId: string,
  payrollId: string,
) {
  try {
    await authorizeTresbeAdmin(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("recalculate_tresbe_payroll", {
    p_payroll_id: payrollId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  return { success: true };
}

export async function sendTresbePayrollToClient(params: {
  companyId: string;
  payrollId: string;
  clientNote: string | null;
  emailRecipient: string | null;
}) {
  try {
    await authorizeTresbeAdmin(params.companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_tresbe_payroll", {
    p_payroll_id: params.payrollId,
    p_client_note: params.clientNote,
    p_email_recipient: params.emailRecipient,
  });
  if (error)
    return {
      error: error.message.includes("invalid employee")
        ? "Revisa tarifas, salarios, servicios y explicaciones antes de enviar."
        : error.message,
    };
  try {
    await syncLeaveAccrualForTresbePayroll(params.payrollId);
  } catch (leaveError) {
    console.error("syncLeaveAccrualForTresbePayroll", leaveError);
  }
  revalidatePath(`/dashboard/admin/companies/${params.companyId}/payroll`);
  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard", "layout");
  return { success: true, message: "Nómina de Tresbe enviada correctamente." };
}

export async function cancelTresbePayroll(
  companyId: string,
  payrollId: string,
  reason: string,
) {
  try {
    await authorizeTresbeAdmin(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_tresbe_payroll", {
    p_payroll_id: payrollId,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  try {
    await reverseLeaveAccrualForTresbePayroll(payrollId);
  } catch (leaveError) {
    console.error("reverseLeaveAccrualForTresbePayroll", leaveError);
  }
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  return { success: true };
}

export async function resetTresbePayrollDraft(
  companyId: string,
  payrollId: string,
  reason: string,
) {
  const parsedReason = z.string().trim().min(5).max(500).safeParse(reason);
  if (!parsedReason.success)
    return { error: "Indica un motivo de al menos 5 caracteres." };
  try {
    await authorizeTresbeAdmin(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_tresbe_payroll_draft", {
    p_payroll_id: payrollId,
    p_reason: parsedReason.data,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  return {
    success: true,
    payrollId,
    message: "Nómina reiniciada correctamente.",
  };
}

export async function deleteTresbePayrollDraft(
  companyId: string,
  payrollId: string,
  reason: string,
) {
  const parsedReason = z.string().trim().min(5).max(500).safeParse(reason);
  if (!parsedReason.success)
    return { error: "Indica un motivo de al menos 5 caracteres." };
  try {
    await authorizeTresbeAdmin(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_tresbe_payroll_draft", {
    p_payroll_id: payrollId,
    p_reason: parsedReason.data,
  });
  if (error) {
    console.error("deleteTresbePayrollDraft", {
      code: error.code,
      message: error.message,
    });
    return {
      error: error.message.includes("never-sent")
        ? "Solo se puede eliminar una nómina borrador que nunca fue enviada."
        : "No se pudo eliminar la nómina.",
    };
  }
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  return { success: true, message: "Nómina eliminada correctamente." };
}

export async function reopenTresbePayroll(
  companyId: string,
  payrollId: string,
  reason: string,
) {
  const parsedReason = z.string().trim().min(10).max(500).safeParse(reason);
  if (!parsedReason.success)
    return { error: "Indica un motivo de al menos 10 caracteres." };
  try {
    await authorizeTresbeAdmin(companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_tresbe_payroll", {
    p_payroll_id: payrollId,
    p_reason: parsedReason.data,
  });
  if (error) return { error: error.message };
  try {
    await reverseLeaveAccrualForTresbePayroll(payrollId);
  } catch (leaveError) {
    console.error("reverseLeaveAccrualForTresbePayroll", leaveError);
  }
  revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  revalidatePath("/dashboard/payroll");
  return {
    success: true,
    payrollId,
    message: "Nómina reabierta para corrección.",
  };
}

export async function markTresbePayrollViewed(payrollId: string) {
  const profile = await requireAuth();
  if (profile.role !== "client" || !profile.company_id)
    return { error: "No autorizado." };
  const company = await resolveTresbeCompany(profile.company_id);
  if (!company) return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_tresbe_payroll_viewed", {
    p_payroll_id: payrollId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function saveTresbePayrollSettings(params: {
  companyId: string;
  defaultEmailRecipient: string | null;
  emailCc: string | null;
}) {
  try {
    await authorizeTresbeAdmin(params.companyId);
  } catch {
    return { error: "No autorizado." };
  }
  const emails = z
    .object({
      recipient: z.string().email().nullable(),
      cc: z.string().email().nullable(),
    })
    .safeParse({ recipient: params.defaultEmailRecipient, cc: params.emailCc });
  if (!emails.success) return { error: "Revisa las direcciones de correo." };
  const supabase = await createClient();
  const { error } = await supabase.from("tresbe_payroll_settings").upsert(
    {
      company_id: params.companyId,
      default_email_recipient: params.defaultEmailRecipient,
      email_cc: params.emailCc,
    },
    { onConflict: "company_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/admin/companies/${params.companyId}/payroll`);
  return { success: true };
}

export async function emailTresbePayroll(
  companyId: string,
  payrollId: string,
  recipient: string,
) {
  const email = z.string().email().safeParse(recipient.trim());
  if (!email.success) return { error: "Correo destinatario no válido." };
  let profile;
  let company;
  try {
    ({ profile, company } = await authorizeTresbeAdmin(companyId));
  } catch {
    return { error: "No autorizado." };
  }
  const supabase = await createClient();
  const [payrollResult, entriesResult, settingsResult] = await Promise.all([
    supabase
      .from("tresbe_payrolls")
      .select("*")
      .eq("id", payrollId)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("tresbe_payroll_entries")
      .select("*")
      .eq("payroll_id", payrollId)
      .order("employee_name_snapshot"),
    supabase
      .from("tresbe_payroll_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);
  const payroll = payrollResult.data as TresbePayroll | null;
  const entries = (entriesResult.data ?? []) as TresbePayrollEntry[];
  if (!payroll || !["sent", "viewed", "corrected"].includes(payroll.status))
    return { error: "La nómina debe enviarse a Tresbe antes del correo." };

  if (!isPayrollEmailConfigured()) {
    await supabase
      .from("tresbe_payrolls")
      .update({
        email_recipient: email.data,
        email_status: "not_configured",
        email_error: "Correo no configurado",
        email_sent_by: profile.id,
      })
      .eq("id", payrollId);
    return { error: "Correo no configurado" };
  }

  await supabase
    .from("tresbe_payrolls")
    .update({
      email_recipient: email.data,
      email_status: "pending",
      email_error: null,
    })
    .eq("id", payrollId);
  try {
    const pdf = await buildTresbePayrollPdf({
      companyName: company.name,
      payroll,
      entries,
    });
    const period = `${payroll.week_start} al ${payroll.week_end}`;
    const result = await sendPayrollEmail({
      to: email.data,
      cc: settingsResult.data?.email_cc ?? null,
      subject: `Nómina Tresbe — ${period}`,
      filename: `nomina-tresbe-${payroll.week_start}.pdf`,
      pdf,
      text: [
        "Hola,",
        "",
        `Adjuntamos el resumen de nómina de Tresbe correspondiente al periodo ${period}.`,
        "",
        `Total nómina en sistema: $${Number(payroll.total_system_pay).toFixed(2)}`,
        `Total cheques de servicios: $${Number(payroll.total_service_checks).toFixed(2)}`,
        `Total tips: $${Number(payroll.total_tips).toFixed(2)}`,
        `Total general a pagar: $${Number(payroll.grand_total).toFixed(2)}`,
        "",
        "Saludos,",
        "Sinexia",
      ].join("\n"),
    });
    await supabase
      .from("tresbe_payrolls")
      .update({
        email_status: "sent",
        email_sent_at: new Date().toISOString(),
        email_sent_by: profile.id,
        email_provider_message_id: result.messageId,
        email_error: null,
      })
      .eq("id", payrollId);
    await supabase.from("tresbe_payroll_events").insert({
      payroll_id: payrollId,
      user_id: profile.id,
      event_type: "email_sent",
      content: `Destinatario: ${email.data}`,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de correo";
    await supabase
      .from("tresbe_payrolls")
      .update({
        email_status: "failed",
        email_error: message,
        email_sent_by: profile.id,
      })
      .eq("id", payrollId);
    await supabase.from("tresbe_payroll_events").insert({
      payroll_id: payrollId,
      user_id: profile.id,
      event_type: "email_failed",
      content: message.slice(0, 2000),
    });
    return { error: message };
  } finally {
    revalidatePath(`/dashboard/admin/companies/${companyId}/payroll`);
  }
}
