"use client";

import { ClientNavLinks } from "@/components/layout/nav-link-with-badge";
import { clientNavItems, tresbePayrollNavItem } from "@/config/navigation";
import type { ClientReportNotifications } from "@/types/notifications";

type ClientNavProps = {
  companyName?: string | null;
  companySlug?: string | null;
  reportNotifications: ClientReportNotifications;
  className?: string;
  onNavigate?: () => void;
};

export function ClientNav({
  companyName,
  companySlug,
  reportNotifications,
  className,
  onNavigate,
}: ClientNavProps) {
  return (
    <ClientNavLinks
      items={
        companySlug === "tresbe"
          ? [
              clientNavItems[0],
              tresbePayrollNavItem,
              ...clientNavItems.slice(1),
            ]
          : clientNavItems
      }
      reportNotifications={reportNotifications}
      companyName={companyName}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
