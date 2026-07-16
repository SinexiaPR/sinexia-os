import { createClient } from "@/lib/supabase/server";
import type { TresbePayrollRule } from "@/lib/tresbe-payroll/calculations";

export type TresbePayrollStatus =
  "draft" | "calculated" | "sent" | "viewed" | "corrected" | "cancelled";

export type TresbeEmployee = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  normalized_name: string;
  source_name: string | null;
  area: string;
  payment_method: "payroll_system" | "services" | "mixed" | "manual";
  payroll_rule: TresbePayrollRule;
  receives_proportional_tips: boolean;
  regular_hourly_rate: number | null;
  service_hourly_rate: number | null;
  default_weekly_hours: number | null;
  default_weekly_salary: number | null;
  annual_salary: number | null;
  wage_requires_review: boolean;
  wage_review_reason: string | null;
  wage_source: string | null;
  wage_updated_at: string | null;
  hiring_date: string | null;
  is_active: boolean;
  internal_note: string | null;
  tresbe_employee_aliases?: Array<{ alias_name: string }>;
};

export type TresbePayroll = {
  id: string;
  company_id: string;
  week_start: string;
  week_end: string;
  status: TresbePayrollStatus;
  employee_count: number;
  total_weekly_hours: number;
  total_system_hours: number;
  total_service_hours: number;
  total_system_pay: number;
  total_tips: number;
  total_service_checks: number;
  total_adjustments: number;
  grand_total: number;
  admin_note: string | null;
  client_note: string | null;
  supporting_document_id: string | null;
  pdf_storage_path: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  email_recipient: string | null;
  email_status: "not_configured" | "pending" | "sent" | "failed" | null;
  email_sent_at: string | null;
  email_error: string | null;
  created_at: string;
};

export type TresbePayrollEntry = {
  id: string;
  payroll_id: string;
  employee_id: string;
  employee_name_snapshot: string;
  area_snapshot: string;
  payment_method_snapshot: string;
  payroll_rule_snapshot: TresbePayrollRule;
  receives_proportional_tips_snapshot: boolean;
  regular_rate_snapshot: number | null;
  service_rate_snapshot: number | null;
  weekly_salary_snapshot: number | null;
  is_new_employee: boolean;
  total_weekly_hours: number;
  system_hours: number;
  service_hours: number;
  manual_system_amount: number;
  system_pay: number;
  tips: number;
  fixed_service_amount: number;
  service_check_amount: number;
  other_adjustments: number;
  employee_total: number;
  service_reason: string | null;
  comment: string | null;
};

export type TresbePayrollSettings = {
  id: string;
  company_id: string;
  default_email_recipient: string | null;
  email_cc: string | null;
  email_subject_template: string | null;
};

export type TresbeWageReviewItem = {
  id: string;
  company_id: string;
  report_date: string;
  official_name: string | null;
  source_name: string | null;
  employee_id: string | null;
  reason: string;
};

export async function resolveTresbeCompany(companyId?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id,name,slug")
    .eq("slug", "tresbe");
  if (companyId) query = query.eq("id", companyId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTresbeAdminWorkspace(
  companyId: string,
  payrollId?: string | null,
) {
  const supabase = await createClient();
  const [employeesResult, payrollsResult, settingsResult, wageReviewsResult] =
    await Promise.all([
      supabase
        .from("tresbe_employees")
        .select("*,tresbe_employee_aliases(alias_name)")
        .eq("company_id", companyId)
        .order("area")
        .order("display_name"),
      supabase
        .from("tresbe_payrolls")
        .select("*")
        .eq("company_id", companyId)
        .order("week_start", { ascending: false })
        .limit(52),
      supabase
        .from("tresbe_payroll_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("tresbe_wage_review_items")
        .select("*")
        .eq("company_id", companyId)
        .is("resolved_at", null)
        .order("created_at"),
    ]);
  if (employeesResult.error) throw employeesResult.error;
  if (payrollsResult.error) throw payrollsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (wageReviewsResult.error) throw wageReviewsResult.error;

  const payrolls = (payrollsResult.data ?? []) as TresbePayroll[];
  const selected =
    payrolls.find((payroll) => payroll.id === payrollId) ??
    payrolls.find((payroll) =>
      ["draft", "calculated", "corrected"].includes(payroll.status),
    ) ??
    payrolls[0] ??
    null;
  let entries: TresbePayrollEntry[] = [];
  if (selected) {
    const { data, error } = await supabase
      .from("tresbe_payroll_entries")
      .select("*")
      .eq("payroll_id", selected.id)
      .order("area_snapshot")
      .order("employee_name_snapshot");
    if (error) throw error;
    entries = (data ?? []) as TresbePayrollEntry[];
  }
  return {
    employees: (employeesResult.data ?? []) as TresbeEmployee[],
    payrolls,
    selected,
    entries,
    settings: settingsResult.data as TresbePayrollSettings | null,
    wageReviews: (wageReviewsResult.data ?? []) as TresbeWageReviewItem[],
  };
}

export async function getTresbeClientWorkspace(
  companyId: string,
  payrollId?: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tresbe_payrolls")
    .select("*")
    .eq("company_id", companyId)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  const payrolls = (data ?? []) as TresbePayroll[];
  const selected =
    payrolls.find((payroll) => payroll.id === payrollId) ?? payrolls[0] ?? null;
  let entries: TresbePayrollEntry[] = [];
  if (selected) {
    const result = await supabase
      .from("tresbe_payroll_entries")
      .select("*")
      .eq("payroll_id", selected.id)
      .order("area_snapshot")
      .order("employee_name_snapshot");
    if (result.error) throw result.error;
    entries = (result.data ?? []) as TresbePayrollEntry[];
  }
  return { payrolls, selected, entries };
}
