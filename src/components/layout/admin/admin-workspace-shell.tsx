"use client";

import type { ReactNode } from "react";

import { AdminHeader } from "@/components/layout/admin/admin-header";
import { AdminSidebar } from "@/components/layout/admin/admin-sidebar";
import { CommandPaletteProvider } from "@/components/layout/command-palette";
import { SkipLink } from "@/components/layout/skip-link";
import { WhatsAppSupportButton } from "@/components/support/whatsapp-support-button";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
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
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <CommandPaletteProvider>
      <SkipLink />
      <div className="bg-muted/30 flex min-h-svh">
        <div
          className={cn(
            "border-border/80 hidden shrink-0 border-r transition-[width] duration-200 md:block",
            collapsed ? "w-16" : "w-56",
          )}
        >
          <div className="sticky top-0 flex h-svh flex-col">
            <AdminSidebar
              badgeCounts={badgeCounts}
              collapsed={collapsed}
              onToggleCollapsed={() => setCollapsed(!collapsed)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader
            profile={profile}
            badgeCounts={badgeCounts}
            notificationUnreadCount={notificationUnreadCount}
          />
          <main id="contenido" className="flex-1">
            <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
              {children}
            </div>
          </main>
        </div>
        <WhatsAppSupportButton />
      </div>
    </CommandPaletteProvider>
  );
}
