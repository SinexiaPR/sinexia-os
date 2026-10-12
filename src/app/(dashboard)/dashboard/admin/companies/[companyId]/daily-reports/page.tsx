import { notFound } from "next/navigation";

import { CutMeatDailyWorkspace } from "@/components/cutmeat-daily/daily-workspace";
import { requireAdmin } from "@/lib/auth/session";
import type { IsoDate } from "@/lib/cutmeat-daily/dates";
import {
  getDailyReportWorkspace,
  getRecentReports,
  resolveCutMeatCompany,
  suggestReportDate,
} from "@/services/cutmeat-daily";

export const dynamic = "force-dynamic";

export default async function CutMeatDailyReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  // Módulo interno de Cut Meat Distributors: sin excepción para el
  // portal cliente, igual que el presupuesto de Tresbe.
  await requireAdmin();
  const { companyId } = await params;
  const { date } = await searchParams;
  const company = await resolveCutMeatCompany(companyId);
  if (!company) notFound();

  const reportDate = ((date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : await suggestReportDate(company.id)) as IsoDate);
  const workspace = await getDailyReportWorkspace(company.id, reportDate);
  const recentReports = await getRecentReports(company.id);

  return (
    <CutMeatDailyWorkspace
      company={company}
      reportDate={reportDate}
      workspace={workspace}
      recentReports={recentReports}
    />
  );
}
