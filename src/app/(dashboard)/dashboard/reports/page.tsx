import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Suspense } from "react";

import { PublishReportDrawer } from "@/components/reports/publish-report-drawer";
import { ReportsCompanyFilter } from "@/components/reports/reports-company-filter";
import { AdminReportsList } from "@/components/reports/admin-reports-list";
import { ClientReportCard } from "@/components/reports/client-report-card";
import { ReportsViewHandler } from "@/components/reports/reports-view-handler";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getReportCategoryMeta } from "@/lib/constants/reports";
import { paginate } from "@/lib/pagination";
import { cn } from "@/lib/utils";
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
  searchParams: Promise<{
    company?: string;
    publicar?: string;
    categoria?: string;
    page?: string;
  }>;
}) {
  const profile = await requireAuth();
  const {
    company: companyFilter,
    publicar,
    categoria,
    page,
  } = await searchParams;

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
  const categories = Array.from(new Set(reports.map((r) => r.category)));
  const activeCategory = categories.find((c) => c === categoria) ?? null;
  const visibleReports = activeCategory
    ? reports.filter((r) => r.category === activeCategory)
    : reports;
  const view = paginate(visibleReports, Number(page) || 1, 8);
  const reportsHref = (query: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const text = params.toString();
    return text ? `/dashboard/reports?${text}` : "/dashboard/reports";
  };

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

      {categories.length > 1 ? (
        <nav aria-label="Tipo de reporte" className="flex flex-wrap gap-1.5">
          {[null, ...categories].map((category) => {
            const active = category === activeCategory;
            return (
              <Link
                key={category ?? "todos"}
                href={reportsHref({ categoria: category ?? undefined })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring inline-flex min-h-10 items-center rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {category
                  ? (getReportCategoryMeta(category)?.clientLabel ?? category)
                  : "Todos"}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {reports.length === 0 ? (
        <SurfaceCard padding="sm" className="p-0">
          <EmptyState
            icon={BarChart3}
            title="Aún no hay reportes"
            description="Cuando Sinexia publique reportes para su empresa, aparecerán aquí."
          />
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          {view.items.map((report) => (
            <ClientReportCard
              key={report.id}
              report={report}
              processing={processingMap.get(report.id) ?? null}
              profile={profilesMap.get(report.id) ?? null}
              profileId={profile.id}
              isUnread={!viewedSet.has(report.id)}
            />
          ))}
          <PaginationLinks
            view={view}
            hrefForPage={(next) =>
              reportsHref({
                categoria: activeCategory ?? undefined,
                page: next > 1 ? String(next) : undefined,
              })
            }
          />
        </div>
      )}
    </div>
  );
}
