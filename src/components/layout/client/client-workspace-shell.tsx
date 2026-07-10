import type { ReactNode } from "react";

import { SignOutControl } from "@/components/auth/sign-out-control";
import { ClientHeader } from "@/components/layout/client/client-header";
import { ClientNav } from "@/components/layout/client/client-nav";
import { WhatsAppSupportButton } from "@/components/support/whatsapp-support-button";
import { siteConfig } from "@/config/site";
import type { ClientReportNotifications } from "@/types/notifications";
import type { Profile } from "@/types";

type ClientWorkspaceShellProps = {
  children: ReactNode;
  profile: Profile;
  companyName?: string | null;
  inboxCount: number;
  notificationUnreadCount: number;
  reportNotifications: ClientReportNotifications;
};

export function ClientWorkspaceShell({
  children,
  profile,
  companyName,
  inboxCount,
  notificationUnreadCount,
  reportNotifications,
}: ClientWorkspaceShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <ClientHeader
        profile={profile}
        companyName={companyName}
        inboxCount={inboxCount}
        notificationUnreadCount={notificationUnreadCount}
        reportNotifications={reportNotifications}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
        <aside className="hidden w-48 shrink-0 md:block">
          <div className="sticky top-24 flex flex-col gap-6">
            <p className="px-3 text-lg font-semibold tracking-tight">
              {siteConfig.name}
            </p>
            <ClientNav
              companyName={companyName}
              inboxCount={inboxCount}
              reportNotifications={reportNotifications}
            />
            <SignOutControl variant="nav" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <WhatsAppSupportButton />
    </div>
  );
}
