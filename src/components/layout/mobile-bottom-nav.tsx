"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavBadge } from "@/components/ui/nav-badge";
import { useUnreadReportsCount } from "@/hooks/use-unread-reports";
import type { NavItem } from "@/config/navigation";
import type { ClientReportNotifications } from "@/types/notifications";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  items: NavItem[];
  inboxCount?: number;
  reportNotifications?: ClientReportNotifications | null;
  className?: string;
};

export function MobileBottomNav({
  items,
  inboxCount = 0,
  reportNotifications = null,
  className,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const unreadReportsCount = useUnreadReportsCount(
    reportNotifications?.profileId ?? "",
    reportNotifications?.reportCreatedAts ?? [],
  );

  const mobileItems = items.filter((item) => item.mobile !== false).slice(0, 5);

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur-md md:hidden",
        "pb-[env(safe-area-inset-bottom,0px)]",
        className,
      )}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const badgeCount =
            item.badgeKey === "inbox"
              ? inboxCount
              : item.badgeKey === "reports"
                ? unreadReportsCount
                : 0;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon
                    className={cn(
                      "size-5",
                      isActive ? "stroke-[2.25]" : "opacity-90",
                    )}
                    aria-hidden
                  />
                  {badgeCount > 0 ? (
                    <span className="absolute -top-1.5 -right-2">
                      <NavBadge count={badgeCount} />
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
