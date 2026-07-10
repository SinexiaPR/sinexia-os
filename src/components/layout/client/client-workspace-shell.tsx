import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientHeader } from "@/components/layout/client/client-header";
import { ClientNav } from "@/components/layout/client/client-nav";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { WhatsAppSupportButton } from "@/components/support/whatsapp-support-button";
import { clientNavItems } from "@/config/navigation";
import type { ClientReportNotifications } from "@/types/notifications";
import type { Profile } from "@/types";

type ClientWorkspaceShellProps = {
  children: ReactNode;
  profile: Profile;
  companyName?: string | null;
  inboxCount: number;
  reportNotifications: ClientReportNotifications;
};

export function ClientWorkspaceShell({
  children,
  profile,
  companyName,
  inboxCount,
  reportNotifications,
}: ClientWorkspaceShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <ClientHeader
        profile={profile}
        companyName={companyName}
        inboxCount={inboxCount}
        reportNotifications={reportNotifications}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-10 px-4 pt-6 pb-safe-nav sm:px-6 sm:pt-10 md:pb-10 lg:pt-12">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-24 space-y-8">
            <BrandLogo href="/dashboard" showSubtitle size="sm" />
            <ClientNav
              companyName={companyName}
              inboxCount={inboxCount}
              reportNotifications={reportNotifications}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <MobileBottomNav
        items={clientNavItems}
        inboxCount={inboxCount}
        reportNotifications={reportNotifications}
      />
      <WhatsAppSupportButton />
    </div>
  );
}
