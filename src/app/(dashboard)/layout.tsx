import { AdminWorkspaceShell } from "@/components/layout/admin/admin-workspace-shell";
import { ClientWorkspaceShell } from "@/components/layout/client/client-workspace-shell";
import { requireAuth } from "@/lib/auth/session";
import {
  countPendingDocuments,
  countPendingDocumentsForCompany,
  getCompanyById,
} from "@/services/documents";
import { getReportCreatedDatesForCompany } from "@/services/reports";

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

  if (profile.role === "admin") {
    const inboxCount = await countPendingDocuments();

    return (
      <AdminWorkspaceShell profile={profile} badgeCounts={{ inbox: inboxCount }}>
        {children}
      </AdminWorkspaceShell>
    );
  }

  const [inboxCount, reportCreatedAts] = profile.company_id
    ? await Promise.all([
        countPendingDocumentsForCompany(profile.company_id),
        getReportCreatedDatesForCompany(profile.company_id),
      ])
    : [0, []];

  return (
    <ClientWorkspaceShell
      profile={profile}
      companyName={company?.name}
      inboxCount={inboxCount}
      reportNotifications={{
        profileId: profile.id,
        reportCreatedAts,
      }}
    >
      {children}
    </ClientWorkspaceShell>
  );
}
