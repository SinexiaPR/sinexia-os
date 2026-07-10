import type { ReactNode } from "react";

import { AdminHeader } from "@/components/layout/admin/admin-header";
import { AdminSidebar } from "@/components/layout/admin/admin-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { WhatsAppSupportButton } from "@/components/support/whatsapp-support-button";
import { adminNavItems } from "@/config/navigation";
import type { NavBadgeCounts } from "@/types/notifications";
import type { AppNotification, Profile } from "@/types";

type AdminWorkspaceShellProps = {
  children: ReactNode;
  profile: Profile;
  badgeCounts: NavBadgeCounts;
  notifications: AppNotification[];
};

export function AdminWorkspaceShell({
  children,
  profile,
  badgeCounts,
  notifications,
}: AdminWorkspaceShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden w-60 shrink-0 border-r border-border/80 md:block">
        <div className="sticky top-0 h-svh">
          <AdminSidebar badgeCounts={badgeCounts} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          profile={profile}
          badgeCounts={badgeCounts}
          notifications={notifications}
        />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-safe-nav sm:px-8 sm:pt-10 md:pb-10">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav
        items={adminNavItems.filter((item) => item.mobile)}
        inboxCount={badgeCounts.inbox}
      />
      <WhatsAppSupportButton />
    </div>
  );
}
