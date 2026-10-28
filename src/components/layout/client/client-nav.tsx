"use client";

import { ClientNavLinks } from "@/components/layout/nav-link-with-badge";
import {
  clientDocumentsNavItem,
  clientHomeNavItem,
  clientInvoicesNavItem,
  clientReportsNavItem,
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
        clientHomeNavItem,
        clientDocumentsNavItem,
        clientReportsNavItem,
        ...(companySlug === "tresbe" ? [tresbePayrollNavItem] : []),
        ...(invoicesEnabled ? [clientInvoicesNavItem] : []),
      ]}
      reportNotifications={reportNotifications}
      companyName={companyName}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
