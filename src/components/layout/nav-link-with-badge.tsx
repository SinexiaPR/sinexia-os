"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavBadge } from "@/components/ui/nav-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUnreadReportsCount } from "@/hooks/use-unread-reports";
import { useUnviewedDocumentsCount } from "@/hooks/use-viewed-documents";
import {
  isNavItemActive,
  type NavBadgeKey,
  type NavItem,
} from "@/config/navigation";
import type {
  ClientReportNotifications,
  NavBadgeCounts,
} from "@/types/notifications";
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
  /** Modo solo íconos: muestra el título en un tooltip y un punto como insignia. */
  collapsed?: boolean;
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
  collapsed = false,
}: NavLinkProps) {
  const Icon = item.icon;
  const badgeCount = resolveBadgeCount(item.badgeKey, inboxCount, reportsCount);

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? item.title : undefined}
      className={cn(
        "focus-visible:ring-ring relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        collapsed && "justify-center px-0",
        isActive ? activeClassName : inactiveClassName,
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", iconClassName)} />
      {collapsed ? (
        badgeCount > 0 ? (
          <span
            aria-hidden
            className="ring-sidebar absolute top-1.5 right-2 size-2 rounded-full bg-red-500 ring-2"
          />
        ) : null
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          <NavBadge count={badgeCount} />
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.title}
        {badgeCount > 0 ? ` (${badgeCount})` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

type ClientNavLinksProps = {
  items: NavItem[];
  reportNotifications: ClientReportNotifications;
  companyName?: string | null;
  className?: string;
  onNavigate?: () => void;
};

export function ClientNavLinks({
  items,
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
  const unviewedDocumentsCount = useUnviewedDocumentsCount(
    reportNotifications.profileId,
    reportNotifications.documentIds,
    reportNotifications.viewedDocumentIds,
  );

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {companyName ? (
        <div className="mb-6 px-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Empresa
          </p>
          <p className="text-foreground mt-1 truncate text-sm font-semibold">
            {companyName}
          </p>
        </div>
      ) : null}

      {items.map((item) => {
        const isActive = isNavItemActive(item, pathname);

        return (
          <NavLinkWithBadge
            key={item.href}
            item={item}
            isActive={isActive}
            inboxCount={unviewedDocumentsCount}
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
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function AdminNavLinks({
  items,
  badgeCounts,
  className,
  collapsed = false,
  onNavigate,
}: AdminNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className={cn("flex-1 space-y-1 p-3", className)}
    >
      {items.map((item) => {
        const isActive = isNavItemActive(item, pathname);

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
            collapsed={collapsed}
          />
        );
      })}
    </nav>
  );
}
