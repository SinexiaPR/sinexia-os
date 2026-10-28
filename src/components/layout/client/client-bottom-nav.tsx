"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavBadge } from "@/components/ui/nav-badge";
import { getClientNavItems, isNavItemActive } from "@/config/navigation";
import { useUnreadReportsCount } from "@/hooks/use-unread-reports";
import { useUnviewedDocumentsCount } from "@/hooks/use-viewed-documents";
import { cn } from "@/lib/utils";
import type { ClientReportNotifications } from "@/types/notifications";

/** Barra inferior de la versión móvil: los mismos accesos del menú del cliente. */
export function ClientBottomNav({
  companySlug,
  invoicesEnabled = false,
  reportNotifications,
}: {
  companySlug?: string | null;
  invoicesEnabled?: boolean;
  reportNotifications: ClientReportNotifications;
}) {
  const pathname = usePathname();
  const unreadReports = useUnreadReportsCount(
    reportNotifications.profileId,
    reportNotifications.reportIds,
    reportNotifications.viewedReportIds,
  );
  const unviewedDocuments = useUnviewedDocumentsCount(
    reportNotifications.profileId,
    reportNotifications.documentIds,
    reportNotifications.viewedDocumentIds,
  );
  const items = getClientNavItems({ companySlug, invoicesEnabled });

  return (
    <nav
      aria-label="Navegación principal"
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          const count =
            item.badgeKey === "inbox"
              ? unviewedDocuments
              : item.badgeKey === "reports"
                ? unreadReports
                : 0;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-5" />
                  {count > 0 ? (
                    <span className="absolute -top-2 left-3">
                      <NavBadge
                        count={count}
                        className="min-h-4 min-w-4 px-1"
                      />
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.title}</span>
                {active ? (
                  <span
                    aria-hidden
                    className="bg-primary absolute top-0 h-0.5 w-8 rounded-full"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
