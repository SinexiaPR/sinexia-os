"use client";

import Link from "next/link";
import { AlertCircle, BarChart3, FileText } from "lucide-react";

import { useUnreadReportsCount } from "@/hooks/use-unread-reports";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

type ClientNotificationAlertsProps = {
  profileId: string;
  pendingCount: number;
  receivedCount: number;
  reportCreatedAts: string[];
  className?: string;
};

function AlertCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof FileText;
}) {
  return (
    <Link href={href} className="block">
      <SurfaceCard
        padding="md"
        className="border-red-500/15 bg-red-500/[0.03] transition-colors hover:border-red-500/25 hover:bg-red-500/[0.05]"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{title}</p>
              <span className="size-2 shrink-0 rounded-full bg-red-500/90" />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500/70" />
        </div>
      </SurfaceCard>
    </Link>
  );
}

export function ClientNotificationAlerts({
  profileId,
  pendingCount,
  receivedCount,
  reportCreatedAts,
  className,
}: ClientNotificationAlertsProps) {
  const unreadReportsCount = useUnreadReportsCount(profileId, reportCreatedAts);

  const hasAlerts =
    receivedCount > 0 || pendingCount > 0 || unreadReportsCount > 0;

  if (!hasAlerts) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {receivedCount > 0 ? (
        <AlertCard
          title="Documento recibido"
          description={
            receivedCount === 1
              ? "Sinexia recibió su documento y lo revisará pronto."
              : `Sinexia recibió ${receivedCount} documentos y los revisará pronto.`
          }
          href="/dashboard/inbox"
          icon={FileText}
        />
      ) : null}

      {pendingCount > 0 ? (
        <AlertCard
          title="Pendiente de revisión"
          description={
            pendingCount === 1
              ? "Tiene 1 documento en revisión por Sinexia."
              : `Tiene ${pendingCount} documentos en revisión por Sinexia.`
          }
          href="/dashboard/inbox"
          icon={FileText}
        />
      ) : null}

      {unreadReportsCount > 0 ? (
        <AlertCard
          title="Nuevo reporte disponible"
          description={
            unreadReportsCount === 1
              ? "Sinexia publicó un reporte nuevo para su empresa."
              : `Sinexia publicó ${unreadReportsCount} reportes nuevos para su empresa.`
          }
          href="/dashboard/reports"
          icon={BarChart3}
        />
      ) : null}
    </div>
  );
}
