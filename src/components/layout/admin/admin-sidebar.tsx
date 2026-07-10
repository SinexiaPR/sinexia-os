"use client";

import { AdminNavLinks } from "@/components/layout/nav-link-with-badge";
import { adminNavItems } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import type { NavBadgeCounts } from "@/types/notifications";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  badgeCounts: NavBadgeCounts;
  className?: string;
  onNavigate?: () => void;
};

export function AdminSidebar({
  badgeCounts,
  className,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
          S
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{siteConfig.name}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            Admin workspace
          </p>
        </div>
      </div>

      <AdminNavLinks
        items={adminNavItems}
        badgeCounts={badgeCounts}
        onNavigate={onNavigate}
      />
    </aside>
  );
}
