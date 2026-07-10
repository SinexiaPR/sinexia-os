import { DocumentList } from "@/components/dashboard/document-list";
import {
  PendingMetricCard,
  RecentActivityFeed,
} from "@/components/dashboard/recent-activity-feed";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { getAdminRecentActivity } from "@/services/activity";
import {
  countDocumentsReceivedToday,
  countPendingDocuments,
  getCompaniesWithStats,
  getRecentDocuments,
} from "@/services/documents";
import { getAllReports } from "@/services/reports";
import Link from "next/link";

export async function AdminDashboard() {
  const [
    companies,
    pendingCount,
    recentDocuments,
    recentActivity,
    reports,
    receivedToday,
  ] = await Promise.all([
    getCompaniesWithStats(),
    countPendingDocuments(),
    getRecentDocuments(6),
    getAdminRecentActivity(8),
    getAllReports(),
    countDocumentsReceivedToday(),
  ]);

  return (
    <div className="space-y-10 sm:space-y-12">
      <PageHeader
        eyebrow="Administración"
        title="Inicio"
        description="Resumen de empresas, documentos pendientes y actividad reciente."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Empresas activas"
          value={companies.length}
          hint="Cuentas de clientes"
        />
        <PendingMetricCard
          label="Documentos pendientes"
          value={pendingCount}
          hint="Recibidos o en revisión"
        />
        <MetricCard
          label="Documentos recibidos hoy"
          value={receivedToday}
          hint="Envíos del día"
        />
        <MetricCard
          label="Reportes publicados"
          value={reports.length}
          hint="Disponibles para clientes"
        />
      </div>

      <RecentActivityFeed items={recentActivity} />

      <div className="grid gap-8 lg:grid-cols-5">
        <SurfaceCard className="lg:col-span-2" padding="md">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight">Empresas</h2>
            <Link
              href="/dashboard/empresas"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <div className="mt-5 space-y-2">
            {companies.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay empresas registradas.
              </p>
            ) : (
              companies.slice(0, 6).map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {company.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {company.total_documents} en documentos
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {company.pending_count > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {company.pending_count > 9
                            ? "9+"
                            : company.pending_count}
                        </span>
                      ) : null}
                      <p className="text-2xl font-semibold tabular-nums">
                        {company.pending_count}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">pendientes</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        <div className="lg:col-span-3">
          <DocumentList
            documents={recentDocuments}
            title="Documentos recientes"
            showCompany
            viewAllHref="/dashboard/inbox"
            emptyMessage="Aún no hay documentos en ninguna empresa."
          />
        </div>
      </div>
    </div>
  );
}
