import type { ReactNode } from "react";

import { ClientHeader } from "@/components/layout/client/client-header";
import { ClientSidebar } from "@/components/layout/client/client-sidebar";
import { WhatsAppSupportButton } from "@/components/support/whatsapp-support-button";
import type { ClientReportNotifications } from "@/types/notifications";
import type { Profile } from "@/types";

type ClientWorkspaceShellProps = {
  children: ReactNode;
  profile: Profile;
  companyName?: string | null;
  companySlug?: string | null;
  notificationUnreadCount: number;
  reportNotifications: ClientReportNotifications;
};

export function ClientWorkspaceShell({
  children,
  profile,
  companyName,
  companySlug,
  notificationUnreadCount,
  reportNotifications,
}: ClientWorkspaceShellProps) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <ClientHeader
        profile={profile}
        companyName={companyName}
        companySlug={companySlug}
        notificationUnreadCount={notificationUnreadCount}
        reportNotifications={reportNotifications}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
        <ClientSidebar
          companyName={companyName}
          companySlug={companySlug}
          reportNotifications={reportNotifications}
        />

        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <WhatsAppSupportButton />
    </div>
  );
}
