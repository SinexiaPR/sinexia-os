import { DocumentList } from "@/components/dashboard/document-list";
import { CalendarDashboardWidget } from "@/components/calendar/calendar-dashboard-widget";
import {
  PendingMetricCard,
  RecentActivityFeed,
} from "@/components/dashboard/recent-activity-feed";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { getAdminRecentActivity } from "@/services/activity";
import {
  countPendingDocuments,
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
  const [
    companies,
    pendingCount,
    recentDocuments,
    recentActivity,
    viewedDocumentIds,
    calendar,
  ] = await Promise.all([
    getCompaniesWithStats(),
    countPendingDocuments(),
    getRecentDocuments(6),
    getAdminRecentActivity(8),
    getViewedDocumentIds(profile.id),
    getCalendarDashboard(operationalDate()),
  ]);

  const totalItems = companies.reduce((sum, c) => sum + c.total_documents, 0);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Admin workspace"
        title="Dashboard"
        description="Monitor client companies, pending items, and recent Inbox activity."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <PendingMetricCard
          label="Pending items"
          value={pendingCount}
          hint="Received or under review"
        />
        <MetricCard
          label="Companies"
          value={companies.length}
          hint="Active client accounts"
        />
        <MetricCard
          label="Total in Inbox"
          value={totalItems}
          hint="Across all companies"
        />
      </div>

      <RecentActivityFeed items={recentActivity} />

      <CalendarDashboardWidget
        items={calendar.items}
        dueToday={calendar.dueToday}
        upcoming={calendar.upcoming}
        overdue={calendar.overdue}
        completedThisWeek={calendar.completedThisWeek}
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <SurfaceCard className="lg:col-span-2" padding="md">
          <h2 className="text-base font-semibold tracking-tight">Companies</h2>
          <div className="mt-5 space-y-2">
            {companies.map((company) => (
              <div
                key={company.id}
                className="border-border/70 flex items-center justify-between rounded-xl border px-4 py-4"
              >
                <div>
                  <p className="text-foreground font-medium">{company.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {company.total_documents} in Inbox
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
                  <p className="text-muted-foreground text-xs">pending</p>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <div className="lg:col-span-3">
          <DocumentList
            documents={recentDocuments}
            title="Recent Inbox uploads"
            showCompany
            viewedDocumentIds={viewedDocumentIds}
            profileId={profile.id}
            isAdmin
            viewAllHref="/dashboard/inbox"
            emptyMessage="No items in any Inbox yet."
          />
        </div>
      </div>
    </div>
  );
}
