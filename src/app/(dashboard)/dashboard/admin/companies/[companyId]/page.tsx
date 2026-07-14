import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FileText, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCompanyWorkspace } from "@/services/company-workspace";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Puerto_Rico",
});
function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : "Sin actividad";
}

const invoiceStatusLabels: Record<string, string> = {
  issued: "Emitida",
  sent: "Enviada",
  viewed: "Vista",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

export default async function AdminCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const workspace = await getAdminCompanyWorkspace(companyId);
  if (!workspace) notFound();
  const { company, summary, categories, activity } = workspace;
  const empty = summary.documents === 0 && summary.reports === 0;

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href="/dashboard#empresas">
            <ArrowLeft className="size-4" />
            Volver a Empresas
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Empresa · Admin workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {company.name}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Última actualización: {formatDate(summary.lastUpdatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {company.slug === "tresbe" ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/admin/companies/${company.id}/payroll`}>
                  Nómina
                </Link>
              </Button>
            ) : null}
            {company.slug === "sibarita" ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/payroll?company=${company.id}`}>
                  Nómina semanal
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/dashboard/inbox?company=${company.id}`}>
                <FileText className="size-4" />
                Ver documentos
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/dashboard/reports?company=${company.id}`}>
                Subir reporte
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section aria-labelledby="resumen-operativo">
        <h2 id="resumen-operativo" className="text-lg font-semibold">
          Resumen operativo
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Documentos"
            value={summary.documents}
            hint={`Último: ${formatDate(summary.lastDocumentAt)}`}
          />
          <MetricCard label="Pendientes" value={summary.pending} />
          <MetricCard label="En revisión" value={summary.reviewing} />
          <MetricCard label="Procesados" value={summary.processed} />
          <MetricCard
            label="Reportes publicados"
            value={summary.reports}
            hint={`Último: ${formatDate(summary.lastReportAt)}`}
          />
        </div>
        {summary.lastAnalysisAt ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Último análisis de SinexIA: {formatDate(summary.lastAnalysisAt)}
          </p>
        ) : null}
      </section>

      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Facturas
            </p>
            {summary.invoice.latestNumber ? (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-lg font-semibold">
                  #{summary.invoice.latestNumber}
                </p>
                <p className="text-sm">
                  {summary.invoice.latestDate ?? "Sin fecha"} ·{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: summary.invoice.latestCurrency,
                  }).format(summary.invoice.latestTotal ?? 0)}
                </p>
                <p className="text-muted-foreground text-sm">
                  {invoiceStatusLabels[summary.invoice.latestStatus ?? ""] ??
                    summary.invoice.latestStatus}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                No hay facturas emitidas para esta empresa.
              </p>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              {summary.invoice.unpaidCount} pendientes de pago
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/dashboard/admin/companies/${company.id}/invoices`}>
              Ver facturas
            </Link>
          </Button>
        </div>
      </SurfaceCard>

      <section aria-labelledby="categorias">
        <div className="flex items-center gap-2">
          <FolderOpen className="text-muted-foreground size-5" />
          <h2 id="categorias" className="text-lg font-semibold">
            Categorías operativas
          </h2>
        </div>
        {empty ? (
          <SurfaceCard className="mt-4">
            <p className="text-muted-foreground text-sm">
              Esta empresa todavía no tiene documentos ni reportes publicados.
            </p>
          </SurfaceCard>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/dashboard/admin/companies/${company.id}/${category.slug}`}
                className="border-border/80 bg-card hover:border-primary/40 focus-visible:ring-ring/50 rounded-2xl border p-5 shadow-sm transition outline-none hover:shadow-md focus-visible:ring-[3px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{category.label}</h3>
                  {category.urgentCount ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      {category.urgentCount} urgentes
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-2xl font-semibold tabular-nums">
                  {category.count}
                </p>
                <p className="text-muted-foreground text-sm">
                  {category.count === 1 ? "archivo" : "archivos"} ·{" "}
                  {category.documentCount} documentos · {category.reportCount}{" "}
                  reportes
                </p>
                {category.insights.length ? (
                  <p className="text-foreground mt-3 text-xs font-medium">
                    {category.insights.join(" · ")}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-3 text-xs">
                  Última actualización: {formatDate(category.latestAt)}
                </p>
                {category.pendingCount ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    {category.pendingCount} pendientes
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <SurfaceCard className="lg:col-span-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground size-5" />
            <h2 className="text-lg font-semibold">
              Actividad reciente de {company.name}
            </h2>
          </div>
          <div className="mt-5 space-y-3">
            {activity.length ? (
              activity.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="hover:border-primary/40 block rounded-lg border px-4 py-3 transition"
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {item.description} · {formatDate(item.timestamp)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No hay actividad reciente para esta empresa.
              </p>
            )}
          </div>
        </SurfaceCard>
        <SurfaceCard className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Acceso rápido</h2>
          <div className="mt-4 grid gap-2">
            {company.slug === "tresbe" ? (
              <Button asChild variant="outline" className="justify-start">
                <Link href={`/dashboard/admin/companies/${company.id}/payroll`}>
                  Nómina semanal
                </Link>
              </Button>
            ) : null}
            {company.slug === "sibarita" ? (
              <Button asChild variant="outline" className="justify-start">
                <Link href={`/dashboard/payroll?company=${company.id}`}>
                  Nómina semanal
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="justify-start">
              <Link href={`/dashboard/inbox?company=${company.id}`}>
                <FileText className="size-4" />
                Ver todos los documentos
              </Link>
            </Button>
            {categories.slice(0, 4).map((category) => (
              <Button
                key={category.slug}
                asChild
                variant="outline"
                className="justify-start"
              >
                <Link
                  href={`/dashboard/admin/companies/${company.id}/${category.slug}`}
                >
                  <FolderOpen className="size-4" />
                  Ver {category.label.toLocaleLowerCase("es")}
                </Link>
              </Button>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
