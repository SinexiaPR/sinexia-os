import type { ReactNode } from "react";

import { SignOutControl } from "@/components/auth/sign-out-control";
import { AdminHeader } from "@/components/layout/admin/admin-header";
import { AdminSidebar } from "@/components/layout/admin/admin-sidebar";
import { WhatsAppSupportButton } from "@/components/support/whatsapp-support-button";
import type { NavBadgeCounts } from "@/types/notifications";
import type { Profile } from "@/types";

type AdminWorkspaceShellProps = {
  children: ReactNode;
  profile: Profile;
  badgeCounts: NavBadgeCounts;
  notificationUnreadCount: number;
};

export function AdminWorkspaceShell({
  children,
  profile,
  badgeCounts,
  notificationUnreadCount,
}: AdminWorkspaceShellProps) {
  return (
    <div className="flex min-h-svh bg-muted/30">
      <div className="hidden w-60 shrink-0 border-r border-border/80 md:block">
        <div className="sticky top-0 flex h-svh flex-col">
          <AdminSidebar badgeCounts={badgeCounts} className="flex-1" />
          <div className="border-t border-sidebar-border p-3">
            <SignOutControl variant="nav" />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          profile={profile}
          badgeCounts={badgeCounts}
          notificationUnreadCount={notificationUnreadCount}
        />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
            {children}
          </div>
        </main>
      </div>
      <WhatsAppSupportButton />
    </div>
  );
}
