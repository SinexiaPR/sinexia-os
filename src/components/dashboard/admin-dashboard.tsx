import Link from "next/link";

import { DocumentList } from "@/components/dashboard/document-list";
import { CalendarDashboardWidget } from "@/components/calendar/calendar-dashboard-widget";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getRecentDocuments } from "@/services/documents";
import { getCompanyActionStatuses } from "@/services/company-status";
import { getViewedDocumentIds } from "@/services/notifications";
import { requireAuth } from "@/lib/auth/session";
import {
  getAdminFirstName,
  getTodayItemsForAdmin,
} from "@/lib/calendar/dashboard-summary";
import { getCalendarDashboard } from "@/services/calendar";

const money = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
});
const weekRangeFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  timeZone: "America/Puerto_Rico",
});
function formatWeekRange(weekStart: string, weekEnd: string) {
  return `${weekRangeFormat.format(new Date(`${weekStart}T12:00:00`))} – ${weekRangeFormat.format(new Date(`${weekEnd}T12:00:00`))}`;
}

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
  const today = operationalDate();
  const [companyStatuses, recentDocuments, viewedDocumentIds, calendar] =
    await Promise.all([
      getCompanyActionStatuses(),
      getRecentDocuments(6),
      getViewedDocumentIds(profile.id),
      getCalendarDashboard(today),
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
        adminName={getAdminFirstName(profile.full_name, profile.email)}
        todayItems={getTodayItemsForAdmin(calendar.dueToday, profile.id, today)}
        upcoming={calendar.upcoming}
        overdue={calendar.overdue}
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <SurfaceCard
          id="empresas"
          className="scroll-mt-20 lg:col-span-2"
          padding="md"
        >
          <h2 className="text-base font-semibold tracking-tight">Empresas</h2>
          <div className="mt-5 space-y-2">
            {companyStatuses.map(
              ({
                company,
                payrollPending,
                invoiceOverdueCount,
                lastSibaritaPayroll,
              }) => {
                const urgent = Boolean(payrollPending) || invoiceOverdueCount > 0;
                return (
                  <Link
                    key={company.id}
                    href={{
                      pathname: `/dashboard/admin/companies/${company.id}`,
                    }}
                    className="border-border/70 hover:border-primary/35 hover:bg-muted/35 focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-20 items-center justify-between gap-3 rounded-xl border px-4 py-4 transition-colors outline-none focus-visible:ring-[3px]"
                    aria-label={`Abrir ${company.name}`}
                  >
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">
                        {company.name}
                      </p>
                      {lastSibaritaPayroll ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Última nómina:{" "}
                          {formatWeekRange(
                            lastSibaritaPayroll.weekStart,
                            lastSibaritaPayroll.weekEnd,
                          )}{" "}
                          · {money.format(lastSibaritaPayroll.totalPay)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      {urgent ? (
                        <span className="size-2 rounded-full bg-red-500/90" />
                      ) : null}
                      <p
                        className={`text-sm font-medium ${urgent ? "text-red-700" : "text-muted-foreground"}`}
                      >
                        {payrollPending?.label ??
                          (invoiceOverdueCount > 0
                            ? `${invoiceOverdueCount} factura${invoiceOverdueCount === 1 ? "" : "s"} vencida${invoiceOverdueCount === 1 ? "" : "s"}`
                            : "Al día")}
                      </p>
                    </div>
                  </Link>
                );
              },
            )}
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
