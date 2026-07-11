import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminIntegrityCheck } from "@/components/reports/admin-integrity-check";
import { AdminReportForm } from "@/components/reports/admin-report-form";
import { AdminReportsList } from "@/components/reports/admin-reports-list";
import { ClientReportCard } from "@/components/reports/client-report-card";
import { ReportsViewHandler } from "@/components/reports/reports-view-handler";
import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import { getCompanies } from "@/services/documents";
import { getProcessingByReportIds, getProfilesByReportIds } from "@/services/intelligence";
import { getViewedReportIds } from "@/services/notifications";
import { getAllReports, getReportsForCompany } from "@/services/reports";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage() {
  const profile = await requireAuth();

  if (profile.role === "admin") {
    const [companies, reports] = await Promise.all([
      getCompanies(),
      getAllReports(),
    ]);
    const [processingMap, profilesMap] = await Promise.all([
      getProcessingByReportIds(reports.map((r) => r.id)),
      getProfilesByReportIds(reports.map((r) => r.id)),
    ]);

    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Admin workspace"
          title="Reports"
          description="Publish report files to client companies."
        />

        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            Publish report
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a company, add details, and upload the finished PDF, Excel,
            or CSV. SinexIA processes the file automatically — no manual
            accounting fields required.
          </p>
          <div className="mt-6">
            <AdminReportForm companies={companies} />
          </div>
        </SurfaceCard>

        <SurfaceCard padding="lg">
          <AdminIntegrityCheck />
        </SurfaceCard>

        <div className="space-y-4">
          <h2 className="text-base font-semibold tracking-tight">
            All reports
          </h2>
          <AdminReportsList
            reports={reports}
            processingByReportId={processingMap}
            profilesByReportId={profilesMap}
          />
        </div>
      </div>
    );
  }

  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
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
    <div className="space-y-8 pb-6 sm:space-y-10">
      <Suspense fallback={null}>
        <ReportsViewHandler profileId={profile.id} />
      </Suspense>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Reportes
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Reportes publicados por Sinexia para su empresa. Consulte, descargue
          y pregunte a SinexIA cuando el análisis esté listo.
        </p>
      </header>

      {reports.length === 0 ? (
        <SurfaceCard padding="lg">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-base font-medium text-foreground">
              Aún no hay reportes
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
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
