import { createClient } from "@/lib/supabase/server";
import { getSibaritaPayrollHistory } from "@/services/company-workspace";
import type { Company } from "@/types";

// Maria only wants payroll status here -- invoice payment/due-date state is
// reconciled outside Sinexia OS and is deliberately not surfaced.
const SIBARITA_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  submitted: "Enviada",
  approved: "Al día",
};
const SIBARITA_PENDING_STATUSES = ["draft", "submitted"];

const TRESBE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  calculated: "Calculada",
  corrected: "Corregida",
  sent: "Enviada",
  viewed: "Enviada",
  cancelled: "Al día",
};
const TRESBE_PENDING_STATUSES = ["draft", "calculated", "corrected"];

export type CompanyActionStatus = {
  company: Company;
  /** null for companies without their own payroll module. */
  payrollStatusLabel: string | null;
  payrollUrgent: boolean;
  lastSibaritaPayroll: {
    weekStart: string;
    weekEnd: string;
    totalPay: number;
  } | null;
};

export async function getCompanyActionStatuses(): Promise<
  CompanyActionStatus[]
> {
  const supabase = await createClient();
  const [companiesRes, weeklyPayrollsRes, tresbePayrollsRes] =
    await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase
        .from("weekly_payrolls")
        .select("company_id,status,week_start,week_end")
        .order("week_start", { ascending: false }),
      supabase
        .from("tresbe_payrolls")
        .select("company_id,status,week_start,week_end")
        .order("week_start", { ascending: false }),
    ]);
  if (companiesRes.error) throw companiesRes.error;
  if (weeklyPayrollsRes.error) throw weeklyPayrollsRes.error;
  if (tresbePayrollsRes.error) throw tresbePayrollsRes.error;

  const companies = (companiesRes.data ?? []) as Company[];
  const latestWeeklyByCompany = new Map<
    string,
    { status: string; week_start: string; week_end: string }
  >();
  for (const row of weeklyPayrollsRes.data ?? []) {
    if (!latestWeeklyByCompany.has(row.company_id))
      latestWeeklyByCompany.set(row.company_id, row);
  }
  const latestTresbeByCompany = new Map<
    string,
    { status: string; week_start: string; week_end: string }
  >();
  for (const row of tresbePayrollsRes.data ?? []) {
    if (!latestTresbeByCompany.has(row.company_id))
      latestTresbeByCompany.set(row.company_id, row);
  }

  const sibarita = companies.find((company) => company.slug === "sibarita");
  const lastSibaritaWeek = sibarita
    ? (await getSibaritaPayrollHistory(sibarita.id))[0]
    : null;

  return companies.map((company) => {
    let payrollStatusLabel: string | null = null;
    let payrollUrgent = false;
    if (company.slug === "sibarita") {
      const latest = latestWeeklyByCompany.get(company.id);
      payrollStatusLabel = latest
        ? (SIBARITA_STATUS_LABELS[latest.status] ?? "Al día")
        : "Al día";
      payrollUrgent = Boolean(
        latest && SIBARITA_PENDING_STATUSES.includes(latest.status),
      );
    } else if (company.slug === "tresbe") {
      const latest = latestTresbeByCompany.get(company.id);
      payrollStatusLabel = latest
        ? (TRESBE_STATUS_LABELS[latest.status] ?? "Al día")
        : "Al día";
      payrollUrgent = Boolean(
        latest && TRESBE_PENDING_STATUSES.includes(latest.status),
      );
    }

    return {
      company,
      payrollStatusLabel,
      payrollUrgent,
      lastSibaritaPayroll:
        company.slug === "sibarita" && lastSibaritaWeek
          ? {
              weekStart: lastSibaritaWeek.weekStart,
              weekEnd: lastSibaritaWeek.weekEnd,
              totalPay: lastSibaritaWeek.totalPay,
            }
          : null,
    };
  });
}
