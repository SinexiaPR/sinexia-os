"use client";

import { ClientNavLinks } from "@/components/layout/nav-link-with-badge";
import { getClientNavItems } from "@/config/navigation";
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
      items={getClientNavItems({ companySlug, invoicesEnabled })}
      reportNotifications={reportNotifications}
      companyName={companyName}
      className={className}
      onNavigate={onNavigate}
    />
  );
}
