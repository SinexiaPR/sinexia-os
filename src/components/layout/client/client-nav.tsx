"use client";

import { ClientNavLinks } from "@/components/layout/nav-link-with-badge";
import {
  clientInvoicesNavItem,
  clientNavItems,
  tresbePayrollNavItem,
} from "@/config/navigation";
import type { ClientReportNotifications } from "@/types/notifications";

type ClientNavProps = {
  companyName?: string | null;
  companySlug?: string | null;
  reportNotifications: ClientReportNotifications;
  invoicesEnabled?: boolean;
  className?: string;
  onNavigate?: () => void;
};

export function ClientNav({
  companyName,
  companySlug,
  reportNotifications,
  invoicesEnabled = false,
  className,
  onNavigate,
}: ClientNavProps) {
  return (
    <ClientNavLinks
      items={[
        clientNavItems[0],
        ...(companySlug === "tresbe" ? [tresbePayrollNavItem] : []),
        ...(invoicesEnabled ? [clientInvoicesNavItem] : []),
        ...clientNavItems.slice(1),
      ]}
      reportNotifications={reportNotifications}
      companyName={companyName}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
