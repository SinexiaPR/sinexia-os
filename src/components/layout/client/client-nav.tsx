"use client";

import { ClientNavLinks } from "@/components/layout/nav-link-with-badge";
import { clientNavItems } from "@/config/navigation";
import type { ClientReportNotifications } from "@/types/notifications";

type ClientNavProps = {
  companyName?: string | null;
  inboxCount: number;
  reportNotifications: ClientReportNotifications;
  className?: string;
  onNavigate?: () => void;
};

export function ClientNav({
  companyName,
  inboxCount,
  reportNotifications,
  className,
  onNavigate,
}: ClientNavProps) {
  return (
    <ClientNavLinks
      items={clientNavItems}
      inboxCount={inboxCount}
      reportNotifications={reportNotifications}
      companyName={companyName}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
