import type { Metadata } from "next";

import { AdminReportForm } from "@/components/reports/admin-report-form";
import { ReportCenter } from "@/components/reports/report-center";
import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { MarkReportsSeen } from "@/components/notifications/mark-reports-seen";
import { PageHeader } from "@/components/layout/page-header";
import { ScrollToHighlight } from "@/components/portal/scroll-to-highlight";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import { getCompanies } from "@/services/documents";
import {
  getAllReports,
  getReportsForCompany,
  getSignedReportFileUrl,
} from "@/services/reports";

export const metadata: Metadata = {
  title: "Reportes",
};

type ReportsPageProps = {
  searchParams?: Promise<{ report?: string }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const profile = await requireAuth();
  const params = searchParams ? await searchParams : {};
  const highlightId = params.report ?? null;

  if (profile.role === "admin") {
    const [companies, reports] = await Promise.all([
      getCompanies(),
      getAllReports(),
    ]);

    const signedUrls: Record<string, string | null> = {};
    await Promise.all(
      reports.map(async (report) => {
        signedUrls[report.id] = await getSignedReportFileUrl(report.file_url);
      }),
    );

    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Administración"
          title="Reportes"
          description="Publique y gestione reportes para las empresas clientes."
        />

        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            Publicar reporte
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seleccione una empresa, complete los datos y suba el archivo.
          </p>
          <div className="mt-6">
            <AdminReportForm companies={companies} />
          </div>
        </SurfaceCard>

        <div className="space-y-4">
          <h2 className="text-base font-semibold tracking-tight">
            Todos los reportes
          </h2>
          <ReportCenter
            reports={reports}
            profile={profile}
            companies={companies}
            signedUrls={signedUrls}
            highlightId={highlightId}
          />
        </div>
        <ScrollToHighlight id={highlightId} prefix="report" />
      </div>
    );
  }

  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Reportes
        </h1>
        <p className="text-muted-foreground">
          Su cuenta no está vinculada a una empresa.
        </p>
      </div>
    );
  }

  const reports = await getReportsForCompany(profile.company_id);
  const reportCreatedAts = reports.map((report) => report.created_at);

  const signedUrls: Record<string, string | null> = {};
  await Promise.all(
    reports.map(async (report) => {
      signedUrls[report.id] = await getSignedReportFileUrl(report.file_url);
    }),
  );

  return (
    <div className="space-y-8 pb-2 sm:space-y-10">
      <MarkReportsSeen
        profileId={profile.id}
        reportCreatedAts={reportCreatedAts}
      />
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Reportes
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Reportes publicados por Sinexia para su empresa.
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
        <ReportCenter
          reports={reports}
          profile={profile}
          signedUrls={signedUrls}
          highlightId={highlightId}
        />
      )}

      <ScrollToHighlight id={highlightId} prefix="report" />

      <ContactSinexiaCard />
    </div>
  );
}
