import { AdminReportsList } from "@/components/reports/admin-reports-list";
import { PublishReportDrawer } from "@/components/reports/publish-report-drawer";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanies } from "@/services/documents";
import {
  getProcessingByReportIds,
  getProfilesByReportIds,
} from "@/services/intelligence";
import { getReportsForCompany } from "@/services/reports";

export const dynamic = "force-dynamic";

export default async function CompanyReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ publicar?: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const { publicar } = await searchParams;
  const [companies, reports] = await Promise.all([
    getCompanies(),
    getReportsForCompany(companyId),
  ]);
  const [processingMap, profilesMap] = await Promise.all([
    getProcessingByReportIds(reports.map((report) => report.id)),
    getProfilesByReportIds(reports.map((report) => report.id)),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          Reportes publicados
        </h2>
        <PublishReportDrawer
          companies={companies}
          initialCompanyId={companyId}
          defaultOpen={publicar === "1"}
        />
      </div>
      <AdminReportsList
        reports={reports}
        processingByReportId={processingMap}
        profilesByReportId={profilesMap}
      />
    </div>
  );
}
