"use client";

import { ClientNavLinks } from "@/components/layout/nav-link-with-badge";
import { clientNavItems } from "@/config/navigation";
import type { ClientReportNotifications } from "@/types/notifications";

type ClientNavProps = {
  companyName?: string | null;
  reportNotifications: ClientReportNotifications;
  className?: string;
  onNavigate?: () => void;
};

export function ClientNav({
  companyName,
  reportNotifications,
  className,
  onNavigate,
}: ClientNavProps) {
  return (
    <ClientNavLinks
      items={clientNavItems}
      reportNotifications={reportNotifications}
      companyName={companyName}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
