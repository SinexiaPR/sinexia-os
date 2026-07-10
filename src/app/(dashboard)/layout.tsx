import { AdminWorkspaceShell } from "@/components/layout/admin/admin-workspace-shell";
import { ClientWorkspaceShell } from "@/components/layout/client/client-workspace-shell";
import { requireAuth } from "@/lib/auth/session";
import {
  countPendingDocuments,
  countPendingDocumentsForCompany,
  getCompanyById,
} from "@/services/documents";
import {
  countUnreadNotifications,
  getNotificationsForUser,
} from "@/services/notifications";
import { getReportSummariesForCompany } from "@/services/reports";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await requireAuth();

  const company =
    profile.company_id != null
      ? await getCompanyById(profile.company_id)
      : null;

  const [notifications, unreadNotifications] = await Promise.all([
    getNotificationsForUser(25),
    countUnreadNotifications(),
  ]);

  if (profile.role === "admin") {
    const inboxCount = await countPendingDocuments();

    return (
      <AdminWorkspaceShell
        profile={profile}
        badgeCounts={{
          inbox: inboxCount,
          notifications: unreadNotifications,
        }}
        notifications={notifications}
      >
        {children}
      </AdminWorkspaceShell>
    );
  }

  const [inboxCount, reportSummaries] = profile.company_id
    ? await Promise.all([
        countPendingDocumentsForCompany(profile.company_id),
        getReportSummariesForCompany(profile.company_id),
      ])
    : [0, [] as { id: string; created_at: string }[]];

  return (
    <ClientWorkspaceShell
      profile={profile}
      companyName={company?.name}
      inboxCount={inboxCount}
      reportNotifications={{
        profileId: profile.id,
        reportCreatedAts: reportSummaries.map((r) => r.created_at),
        reports: reportSummaries,
        unreadReportsCount: reportSummaries.length,
      }}
      notifications={notifications}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </ClientWorkspaceShell>
  );
}
