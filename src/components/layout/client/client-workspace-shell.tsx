import type { ReactNode } from "react";

import { ClientBottomNav } from "@/components/layout/client/client-bottom-nav";
import { ClientHeader } from "@/components/layout/client/client-header";
import { ClientSidebar } from "@/components/layout/client/client-sidebar";
import { SkipLink } from "@/components/layout/skip-link";
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
  invoicesEnabled?: boolean;
};

export function ClientWorkspaceShell({
  children,
  profile,
  companyName,
  companySlug,
  notificationUnreadCount,
  reportNotifications,
  invoicesEnabled = false,
}: ClientWorkspaceShellProps) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <SkipLink />
      <ClientHeader
        profile={profile}
        companyName={companyName}
        notificationUnreadCount={notificationUnreadCount}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-10 px-4 pt-5 pb-28 sm:px-6 sm:pt-6 md:pb-6">
        <ClientSidebar
          companyName={companyName}
          companySlug={companySlug}
          reportNotifications={reportNotifications}
          invoicesEnabled={invoicesEnabled}
        />

        <main id="contenido" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <ClientBottomNav
        companySlug={companySlug}
        invoicesEnabled={invoicesEnabled}
        reportNotifications={reportNotifications}
      />
      <WhatsAppSupportButton />
    </div>
  );
}
