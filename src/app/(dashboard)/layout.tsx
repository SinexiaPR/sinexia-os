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
  getViewedReportIds,
} from "@/services/notifications";
import { getReportsForCompany } from "@/services/reports";

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

  const notificationUnreadCount = await countUnreadNotifications({
    userId: profile.id,
    role: profile.role,
    companyId: profile.company_id,
  });

  if (profile.role === "admin") {
    const inboxCount = await countPendingDocuments();

    return (
      <AdminWorkspaceShell
        profile={profile}
        badgeCounts={{ inbox: inboxCount }}
        notificationUnreadCount={notificationUnreadCount}
      >
        {children}
      </AdminWorkspaceShell>
    );
  }

  const [inboxCount, reports, viewedReportIds] = profile.company_id
    ? await Promise.all([
        countPendingDocumentsForCompany(profile.company_id),
        getReportsForCompany(profile.company_id),
        getViewedReportIds(profile.id),
      ])
    : [0, [], [] as string[]];

  return (
    <ClientWorkspaceShell
      profile={profile}
      companyName={company?.name}
      inboxCount={inboxCount}
      notificationUnreadCount={notificationUnreadCount}
      reportNotifications={{
        profileId: profile.id,
        reportIds: reports.map((r) => r.id),
        viewedReportIds,
      }}
    >
      {children}
    </ClientWorkspaceShell>
  );
}
