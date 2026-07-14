"use client";

import { SignOutControl } from "@/components/auth/sign-out-control";
import { ClientNav } from "@/components/layout/client/client-nav";
import { siteConfig } from "@/config/site";
import type { ClientReportNotifications } from "@/types/notifications";

type ClientSidebarProps = {
  companyName?: string | null;
  companySlug?: string | null;
  reportNotifications: ClientReportNotifications;
  invoicesEnabled?: boolean;
};

export function ClientSidebar({
  companyName,
  companySlug,
  reportNotifications,
  invoicesEnabled = false,
}: ClientSidebarProps) {
  return (
    <aside className="hidden w-48 shrink-0 md:block">
      <div className="sticky top-24 flex flex-col gap-6">
        <p className="px-3 text-lg font-semibold tracking-tight">
          {siteConfig.name}
        </p>
        <ClientNav
          companyName={companyName}
          companySlug={companySlug}
          reportNotifications={reportNotifications}
          invoicesEnabled={invoicesEnabled}
        />
        <SignOutControl variant="nav" />
      </div>
    </aside>
  );
}
