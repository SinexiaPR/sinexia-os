import { AdminWorkspaceShell } from "@/components/layout/admin/admin-workspace-shell";
import { ClientWorkspaceShell } from "@/components/layout/client/client-workspace-shell";
import { requireAuth } from "@/lib/auth/session";
import { getCompanyById, getDocumentsForCompany } from "@/services/documents";
import {
  countUnreadAdminInboxNotifications,
  countUnreadNotifications,
  getViewedDocumentIds,
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
    const inboxCount = await countUnreadAdminInboxNotifications({
      userId: profile.id,
    });

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

  const [reports, viewedReportIds, documentIds, viewedDocumentIds] =
    profile.company_id
      ? await Promise.all([
          getReportsForCompany(profile.company_id),
          getViewedReportIds(profile.id),
          getDocumentsForCompany(profile.company_id).then((docs) =>
            docs.map((doc) => doc.id),
          ),
          getViewedDocumentIds(profile.id),
        ])
      : [[], [] as string[], [] as string[], [] as string[]];

  return (
    <ClientWorkspaceShell
      profile={profile}
      companyName={company?.name}
      companySlug={company?.slug}
      notificationUnreadCount={notificationUnreadCount}
      reportNotifications={{
        profileId: profile.id,
        reportIds: reports.map((r) => r.id),
        viewedReportIds,
        documentIds,
        viewedDocumentIds,
      }}
    >
      {children}
    </ClientWorkspaceShell>
  );
}
