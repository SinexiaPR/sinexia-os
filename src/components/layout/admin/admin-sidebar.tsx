"use client";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminNavLinks } from "@/components/layout/nav-link-with-badge";
import { adminNavItems } from "@/config/navigation";
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
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <BrandLogo href="/dashboard" showSubtitle size="sm" inverted />
      </div>

      <AdminNavLinks
        items={adminNavItems}
        badgeCounts={badgeCounts}
        onNavigate={onNavigate}
      />

      <div className="mt-auto border-t border-sidebar-border p-3">
        <SignOutButton variant="sidebar" />
      </div>
    </aside>
  );
}
