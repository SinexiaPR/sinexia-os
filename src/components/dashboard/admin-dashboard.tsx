import Link from "next/link";

import { DocumentList } from "@/components/dashboard/document-list";
import { CalendarDashboardWidget } from "@/components/calendar/calendar-dashboard-widget";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  getCompaniesWithStats,
  getRecentDocuments,
} from "@/services/documents";
import { getViewedDocumentIds } from "@/services/notifications";
import { requireAuth } from "@/lib/auth/session";
import { getCalendarDashboard } from "@/services/calendar";

function operationalDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function AdminDashboard() {
  const profile = await requireAuth();
  const [companies, recentDocuments, viewedDocumentIds, calendar] =
    await Promise.all([
      getCompaniesWithStats(),
      getRecentDocuments(6),
      getViewedDocumentIds(profile.id),
      getCalendarDashboard(operationalDate()),
    ]);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Admin workspace"
        title="Dashboard"
        description="Organiza el trabajo del equipo y revisa los documentos recibidos."
      />

      <CalendarDashboardWidget
        items={calendar.items}
        dueToday={calendar.dueToday}
        upcoming={calendar.upcoming}
        overdue={calendar.overdue}
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <SurfaceCard className="lg:col-span-2" padding="md">
          <h2 className="text-base font-semibold tracking-tight">Empresas</h2>
          <div className="mt-5 space-y-2">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={{
                  pathname: "/dashboard/inbox",
                  query: { company: company.id },
                }}
                className="border-border/70 hover:border-primary/35 hover:bg-muted/35 focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-20 items-center justify-between rounded-xl border px-4 py-4 transition-colors outline-none focus-visible:ring-[3px]"
                aria-label={`Abrir documentos de ${company.name}`}
              >
                <div>
                  <p className="text-foreground font-medium">{company.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {company.total_documents} documentos en Inbox
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {company.pending_count > 0 ? (
                      <span className="size-2 rounded-full bg-red-500/90" />
                    ) : null}
                    <p className="text-2xl font-semibold tabular-nums">
                      {company.pending_count}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">pendientes</p>
                </div>
              </Link>
            ))}
          </div>
        </SurfaceCard>

        <div className="lg:col-span-3">
          <DocumentList
            documents={recentDocuments}
            title="Documentos recibidos recientes"
            showCompany
            viewedDocumentIds={viewedDocumentIds}
            profileId={profile.id}
            isAdmin
            viewAllHref="/dashboard/inbox"
            viewAllLabel="Ver todos"
            emptyMessage="Todavía no hay documentos en los Inbox."
          />
        </div>
      </div>
    </div>
  );
}
