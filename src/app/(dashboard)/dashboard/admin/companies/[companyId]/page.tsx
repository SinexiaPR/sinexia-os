import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FileText, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import {
  getAdminCompanyWorkspace,
  getSibaritaPayrollHistory,
} from "@/services/company-workspace";

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

const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const weekRangeFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  timeZone: "America/Puerto_Rico",
});
function formatWeekRange(weekStart: string, weekEnd: string) {
  return `${weekRangeFormat.format(new Date(`${weekStart}T12:00:00`))} – ${weekRangeFormat.format(new Date(`${weekEnd}T12:00:00`))}`;
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
  const payrollHistory =
    company.slug === "sibarita"
      ? await getSibaritaPayrollHistory(company.id)
      : null;

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

      {payrollHistory ? (
        <section aria-labelledby="historial-nomina">
          <h2 id="historial-nomina" className="text-lg font-semibold">
            Historial de nómina (archivo)
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Cargado desde las planillas semanales de Sibarita en Google
            Drive. Solo de referencia, no editable desde acá.
          </p>
          {payrollHistory.length ? (
            <div className="mt-4 space-y-4">
              {payrollHistory.map((week) => (
                <SurfaceCard key={week.weekStart}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">
                      {formatWeekRange(week.weekStart, week.weekEnd)}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {currencyFormat.format(week.totalPay)} total ·{" "}
                      {currencyFormat.format(week.totalTips)} propinas ·{" "}
                      {week.totalHours.toFixed(2)}h
                    </p>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                          <th className="py-1.5 pr-3 font-medium">
                            Empleado
                          </th>
                          <th className="py-1.5 pr-3 font-medium">
                            Sección
                          </th>
                          <th className="py-1.5 pr-3 text-right font-medium">
                            Horas
                          </th>
                          <th className="py-1.5 pr-3 text-right font-medium">
                            Propinas
                          </th>
                          <th className="py-1.5 text-right font-medium">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {week.rows.map((row) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">
                              {row.employee_name}
                            </td>
                            <td className="text-muted-foreground py-1.5 pr-3">
                              {row.section ?? "—"}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">
                              {Number(row.total_hours).toFixed(2)}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">
                              {currencyFormat.format(
                                Number(row.tips) + Number(row.other_pay),
                              )}
                            </td>
                            <td className="py-1.5 text-right font-medium tabular-nums">
                              {currencyFormat.format(row.weekly_payroll)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          ) : (
            <SurfaceCard className="mt-4">
              <p className="text-muted-foreground text-sm">
                Todavía no hay nóminas cargadas en el historial.
              </p>
            </SurfaceCard>
          )}
        </section>
      ) : null}

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
