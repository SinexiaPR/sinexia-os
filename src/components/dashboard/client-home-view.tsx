import Link from "next/link";
import { AlertCircle, ArrowRight, Sparkles, Upload } from "lucide-react";

import { ClientRecentActivity } from "@/components/dashboard/client-recent-activity";
import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import type {
  ClientActivityItem,
  ClientDashboardStats,
} from "@/services/client-dashboard";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function ClientHomeView({
  firstName,
  companyName,
  stats,
  activity,
}: {
  firstName: string;
  companyName: string;
  stats: ClientDashboardStats;
  activity: ClientActivityItem[];
}) {
  const summary = [
    {
      label: "Reportes publicados",
      value: stats.publishedReports,
      href: "/dashboard/reports",
    },
    {
      label: "Documentos pendientes",
      value: stats.pendingDocuments,
      href: "/dashboard/inbox?status=pending",
    },
    {
      label: "Analizados por SinexIA",
      value: stats.analyzedDocuments,
      href: "/dashboard/inbox?status=processed",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{companyName}</p>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Hola, {firstName}
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Así va su empresa con Sinexia.
          </p>
        </div>
        <Button asChild size="lg" className="h-11 w-full sm:w-auto">
          <Link href="/dashboard/inbox#upload">
            <Upload className="size-4" />
            Subir documento
          </Link>
        </Button>
      </header>

      {stats.needsInfoDocuments > 0 ? (
        <Link
          href="/dashboard/inbox?status=rejected"
          className="border-warning/30 bg-warning-soft text-warning focus-visible:ring-ring flex items-start gap-3 rounded-lg border px-4 py-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">
              {stats.needsInfoDocuments === 1
                ? "1 documento necesita más información."
                : `${stats.needsInfoDocuments} documentos necesitan más información.`}
            </strong>{" "}
            Revíselos para que Sinexia pueda procesarlos.
          </span>
          <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0" />
        </Link>
      ) : null}

      <SurfaceCard padding="sm" className="p-0">
        <dl className="divide-border/70 grid grid-cols-3 divide-x">
          {summary.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="hover:bg-muted/40 focus-visible:ring-ring block px-4 py-4 transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            >
              <dt className="text-muted-foreground text-xs leading-snug">
                {item.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {item.value}
              </dd>
            </Link>
          ))}
        </dl>
        {stats.lastUpdate ? (
          <p className="text-muted-foreground border-border/70 border-t px-4 py-2.5 text-xs">
            Última actualización: {formatDateTime(stats.lastUpdate)}
          </p>
        ) : null}
      </SurfaceCard>

      <SurfaceCard padding="md">
        <h2 className="text-base font-semibold tracking-tight">
          Último reporte
        </h2>
        {stats.lastReport ? (
          <div className="mt-4 space-y-3">
            <ReportCategoryDisplay
              category={stats.lastReport.category}
              variant="client"
            />
            <div>
              <p className="text-foreground text-lg font-semibold tracking-tight">
                {stats.lastReport.title}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Periodo {stats.lastReport.period} · Publicado el{" "}
                {formatDate(stats.lastReport.createdAt)}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Button asChild className="h-11">
                <Link href="/dashboard/reports">Ver reportes</Link>
              </Button>
              <Button asChild variant="outline" className="h-11">
                <Link href={`/dashboard/sia?reportId=${stats.lastReport.id}`}>
                  <Sparkles className="size-4" />
                  Preguntar a SinexIA
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            Sinexia publicará sus reportes aquí cuando estén listos.
          </p>
        )}
      </SurfaceCard>

      <ClientRecentActivity items={activity} />
    </div>
  );
}
