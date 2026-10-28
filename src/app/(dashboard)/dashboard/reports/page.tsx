import type { Metadata } from "next";
import { Suspense } from "react";

import { PublishReportDrawer } from "@/components/reports/publish-report-drawer";
import { ReportsCompanyFilter } from "@/components/reports/reports-company-filter";
import { AdminReportsList } from "@/components/reports/admin-reports-list";
import { ClientReportCard } from "@/components/reports/client-report-card";
import { ReportsViewHandler } from "@/components/reports/reports-view-handler";
import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import { getCompanies } from "@/services/documents";
import {
  getProcessingByReportIds,
  getProfilesByReportIds,
} from "@/services/intelligence";
import { getViewedReportIds } from "@/services/notifications";
import { getAllReports, getReportsForCompany } from "@/services/reports";

export const metadata: Metadata = {
  title: "Reportes",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; publicar?: string }>;
}) {
  const profile = await requireAuth();
  const { company: companyFilter, publicar } = await searchParams;

  if (profile.role === "admin") {
    const [companies, reports] = await Promise.all([
      getCompanies(),
      companyFilter ? getReportsForCompany(companyFilter) : getAllReports(),
    ]);
    const [processingMap, profilesMap] = await Promise.all([
      getProcessingByReportIds(reports.map((r) => r.id)),
      getProfilesByReportIds(reports.map((r) => r.id)),
    ]);

    return (
      <div className="space-y-5">
        <PageHeader
          title="Reportes"
          description="Reportes publicados para las empresas clientes."
          action={
            <PublishReportDrawer
              companies={companies}
              initialCompanyId={companyFilter}
              defaultOpen={publicar === "1"}
            />
          }
        />

        <ReportsCompanyFilter companies={companies} value={companyFilter} />

        <AdminReportsList
          reports={reports}
          processingByReportId={processingMap}
          profilesByReportId={profilesMap}
        />
      </div>
    );
  }

  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Su cuenta no está vinculada a una empresa.
        </p>
      </div>
    );
  }

  const reports = await getReportsForCompany(profile.company_id);
  const [processingMap, profilesMap, viewedReportIds] = await Promise.all([
    getProcessingByReportIds(reports.map((r) => r.id)),
    getProfilesByReportIds(reports.map((r) => r.id)),
    getViewedReportIds(profile.id),
  ]);
  const viewedSet = new Set(viewedReportIds);

  return (
    <div className="space-y-5 pb-6 sm:space-y-6">
      <Suspense fallback={null}>
        <ReportsViewHandler profileId={profile.id} />
      </Suspense>
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Reportes publicados por Sinexia para su empresa. Consulte, descargue y
          pregunte a SinexIA cuando el análisis esté listo.
        </p>
      </header>

      {reports.length === 0 ? (
        <SurfaceCard padding="lg">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-foreground text-base font-medium">
              Aún no hay reportes
            </p>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Cuando Sinexia publique reportes para su empresa, aparecerán aquí.
            </p>
          </div>
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ClientReportCard
              key={report.id}
              report={report}
              processing={processingMap.get(report.id) ?? null}
              profile={profilesMap.get(report.id) ?? null}
              profileId={profile.id}
              isUnread={!viewedSet.has(report.id)}
            />
          ))}
        </div>
      )}

      <ContactSinexiaCard />
    </div>
  );
}
