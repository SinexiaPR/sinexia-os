"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  countUnreadReports,
  getReportsLastSeenAt,
} from "@/lib/notifications/viewed-reports";
import { cn } from "@/lib/utils";
import type { ReportWithCompany } from "@/types";

type ClientReportCardViewProps = {
  report: ReportWithCompany;
  profileId: string;
  signedUrl: string | null;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("sinexia:reports-seen", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("sinexia:reports-seen", onStoreChange);
  };
}

export function ClientReportCardView({
  report,
  profileId,
  signedUrl,
}: ClientReportCardViewProps) {
  const lastSeenAt = useSyncExternalStore(
    subscribe,
    () => getReportsLastSeenAt(profileId),
    () => null,
  );

  const isNew = countUnreadReports([report.created_at], lastSeenAt) > 0;

  return (
    <SurfaceCard
      padding="lg"
      className={cn(
        isNew && "border-primary/25 bg-navy-soft/30 ring-1 ring-primary/10",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ReportCategoryDisplay category={report.category} variant="client" />
            {isNew ? (
              <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary-foreground uppercase">
                Nuevo
              </span>
            ) : null}
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {report.title}
          </h2>
          <dl className="space-y-1 text-sm text-muted-foreground">
            <div>
              <dt className="sr-only">Periodo</dt>
              <dd>Periodo: {report.period}</dd>
            </div>
            <div>
              <dt className="sr-only">Fecha de publicación</dt>
              <dd>Publicado el {formatDate(report.created_at)}</dd>
            </div>
          </dl>
          {report.notes ? (
            <p className="border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">
              {report.notes}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          {signedUrl ? (
            <Link
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground sm:h-11 sm:w-auto sm:min-w-[132px]"
            >
              Descargar
            </Link>
          ) : (
            <span className="inline-flex h-11 w-full items-center justify-center text-sm text-muted-foreground sm:w-auto">
              No disponible
            </span>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
