import { createClient } from "@/lib/supabase/server";
import { getSibaritaPayrollHistory } from "@/services/company-workspace";
import type { Company } from "@/types";

const TRESBE_PENDING_STATUSES = ["draft", "calculated", "corrected"];
const SIBARITA_PENDING_STATUSES = ["draft", "submitted"];

const SIBARITA_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  submitted: "Enviada",
  approved: "Aprobada",
};

const TRESBE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  calculated: "Calculada",
  sent: "Enviada",
  viewed: "Vista por cliente",
  corrected: "Corregida",
  cancelled: "Cancelada",
};

export type CompanyActionStatus = {
  company: Company;
  payrollPending: { label: string } | null;
  invoiceOverdueCount: number;
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
  const [companiesRes, weeklyPayrollsRes, tresbePayrollsRes, overdueRes] =
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
      supabase
        .from("invoices")
        .select("company_id")
        .eq("status", "overdue")
        .eq("is_legacy_import", false),
    ]);
  if (companiesRes.error) throw companiesRes.error;
  if (weeklyPayrollsRes.error) throw weeklyPayrollsRes.error;
  if (tresbePayrollsRes.error) throw tresbePayrollsRes.error;
  if (overdueRes.error) throw overdueRes.error;

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
  const overdueCountByCompany = new Map<string, number>();
  for (const row of overdueRes.data ?? []) {
    overdueCountByCompany.set(
      row.company_id,
      (overdueCountByCompany.get(row.company_id) ?? 0) + 1,
    );
  }

  const sibarita = companies.find((company) => company.slug === "sibarita");
  const lastSibaritaWeek = sibarita
    ? (await getSibaritaPayrollHistory(sibarita.id))[0]
    : null;

  return companies.map((company) => {
    let payrollPending: CompanyActionStatus["payrollPending"] = null;
    if (company.slug === "sibarita") {
      const latest = latestWeeklyByCompany.get(company.id);
      if (latest && SIBARITA_PENDING_STATUSES.includes(latest.status)) {
        payrollPending = {
          label: `Nómina ${SIBARITA_STATUS_LABELS[latest.status] ?? latest.status}`,
        };
      }
    } else if (company.slug === "tresbe") {
      const latest = latestTresbeByCompany.get(company.id);
      if (latest && TRESBE_PENDING_STATUSES.includes(latest.status)) {
        payrollPending = {
          label: `Nómina ${TRESBE_STATUS_LABELS[latest.status] ?? latest.status}`,
        };
      }
    }

    return {
      company,
      payrollPending,
      invoiceOverdueCount: overdueCountByCompany.get(company.id) ?? 0,
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
