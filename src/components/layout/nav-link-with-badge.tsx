"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavBadge } from "@/components/ui/nav-badge";
import { useUnreadReportsCount } from "@/hooks/use-unread-reports";
import type { NavBadgeKey, NavItem } from "@/config/navigation";
import type { ClientReportNotifications, NavBadgeCounts } from "@/types/notifications";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  item: NavItem;
  isActive: boolean;
  inboxCount: number;
  reportsCount: number;
  onNavigate?: () => void;
  activeClassName: string;
  inactiveClassName: string;
  iconClassName?: string;
};

function resolveBadgeCount(
  badgeKey: NavBadgeKey | undefined,
  inboxCount: number,
  reportsCount: number,
): number {
  if (badgeKey === "inbox") {
    return inboxCount;
  }

  if (badgeKey === "reports") {
    return reportsCount;
  }

  return 0;
}

export function NavLinkWithBadge({
  item,
  isActive,
  inboxCount,
  reportsCount,
  onNavigate,
  activeClassName,
  inactiveClassName,
  iconClassName,
}: NavLinkProps) {
  const Icon = item.icon;
  const badgeCount = resolveBadgeCount(item.badgeKey, inboxCount, reportsCount);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        isActive ? activeClassName : inactiveClassName,
      )}
    >
      <Icon className={cn("size-4 shrink-0", iconClassName)} />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <NavBadge count={badgeCount} />
    </Link>
  );
}

type ClientNavLinksProps = {
  items: NavItem[];
  inboxCount: number;
  reportNotifications: ClientReportNotifications;
  companyName?: string | null;
  className?: string;
  onNavigate?: () => void;
};

export function ClientNavLinks({
  items,
  inboxCount,
  reportNotifications,
  companyName,
  className,
  onNavigate,
}: ClientNavLinksProps) {
  const pathname = usePathname();
  const unreadReportsCount = useUnreadReportsCount(
    reportNotifications.profileId,
    reportNotifications.reportIds,
    reportNotifications.viewedReportIds,
  );

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {companyName ? (
        <div className="mb-6 px-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Company
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {companyName}
          </p>
        </div>
      ) : null}

      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <NavLinkWithBadge
            key={item.href}
            item={item}
            isActive={isActive}
            inboxCount={inboxCount}
            reportsCount={unreadReportsCount}
            onNavigate={onNavigate}
            activeClassName="bg-foreground text-background shadow-sm"
            inactiveClassName="text-muted-foreground hover:bg-muted hover:text-foreground"
            iconClassName={isActive ? undefined : "opacity-80"}
          />
        );
      })}
    </nav>
  );
}

type AdminNavLinksProps = {
  items: NavItem[];
  badgeCounts: NavBadgeCounts;
  className?: string;
  onNavigate?: () => void;
};

export function AdminNavLinks({
  items,
  badgeCounts,
  className,
  onNavigate,
}: AdminNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex-1 space-y-0.5 p-3", className)}>
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <NavLinkWithBadge
            key={item.href}
            item={item}
            isActive={isActive}
            inboxCount={badgeCounts.inbox}
            reportsCount={0}
            onNavigate={onNavigate}
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
            inactiveClassName="text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            iconClassName="opacity-80"
          />
        );
      })}
    </nav>
  );
}
