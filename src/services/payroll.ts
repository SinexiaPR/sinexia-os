import { createClient } from "@/lib/supabase/server";

export type WorkerClassification = "w2" | "services" | "contractor";

export type PayrollEmployee = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  section: string;
  compensation_type: "hourly" | "hourly_training" | "fixed_weekly" | null;
  regular_hourly_rate: number | null;
  training_hourly_rate: number | null;
  fixed_weekly_salary: number | null;
  worker_classification: WorkerClassification;
  hiring_date: string | null;
  active: boolean;
  requires_compensation_review: boolean;
  internal_note: string | null;
};
export type WeeklyPayroll = {
  id: string;
  company_id: string;
  week_start: string;
  week_end: string;
  status: "draft" | "submitted" | "approved";
  created_at: string;
};
export type WeeklyPayrollEntry = {
  id: string;
  payroll_id: string;
  employee_id: string;
  employee_name_snapshot: string;
  section_snapshot: string;
  compensation_type_snapshot: PayrollEmployee["compensation_type"];
  regular_rate_snapshot: number | null;
  training_rate_snapshot: number | null;
  fixed_salary_snapshot: number | null;
  requires_review_snapshot: boolean;
  regular_hours: number;
  training_hours: number;
  other_payments: number;
  vacation_paid_hours: number;
  sick_paid_hours: number;
  holiday_paid_hours: number;
  jury_duty_hours: number;
  bereavement_hours: number;
  comment: string | null;
};

export async function resolveSibaritaCompany(companyId?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id,name,slug")
    .eq("slug", "sibarita");
  if (companyId) query = query.eq("id", companyId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPayrollWorkspace(companyId: string) {
  const supabase = await createClient();
  const [employeesRes, payrollsRes] = await Promise.all([
    supabase
      .from("payroll_employees")
      .select("*")
      .eq("company_id", companyId)
      .order("section")
      .order("last_name"),
    supabase
      .from("weekly_payrolls")
      .select("*")
      .eq("company_id", companyId)
      .order("week_start", { ascending: false })
      .limit(12),
  ]);
  if (employeesRes.error) throw employeesRes.error;
  if (payrollsRes.error) throw payrollsRes.error;
  const payrolls = (payrollsRes.data ?? []) as WeeklyPayroll[];
  const selected =
    payrolls.find((item) => item.status === "draft") ?? payrolls[0] ?? null;
  let entries: WeeklyPayrollEntry[] = [];
  if (selected) {
    const { data, error } = await supabase
      .from("weekly_payroll_entries")
      .select("*")
      .eq("payroll_id", selected.id)
      .order("section_snapshot")
      .order("employee_name_snapshot");
    if (error) throw error;
    entries = (data ?? []) as WeeklyPayrollEntry[];
  }
  return {
    employees: (employeesRes.data ?? []) as PayrollEmployee[],
    payrolls,
    selected,
    entries,
  };
}
