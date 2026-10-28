import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { ChecklistRow } from "@/components/dashboard/client-checklist";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  labelFor,
} from "@/lib/labels";
import { getAdminClientDashboard } from "@/services/admin-client-dashboard";
import {
  getAdminCompanyWorkspace,
  getSibaritaRecentActivity,
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

type Workspace = NonNullable<
  Awaited<ReturnType<typeof getAdminCompanyWorkspace>>
>;

function ActivityLink({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="hover:border-primary/40 focus-visible:ring-ring block min-h-11 rounded-lg border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs">{meta}</p>
    </Link>
  );
}

function CategoryCards({
  companyId,
  categories,
}: {
  companyId: string;
  categories: Workspace["categories"];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/dashboard/admin/companies/${companyId}/${category.slug}`}
          className="border-border/80 bg-card hover:border-primary/40 focus-visible:ring-ring rounded-lg border p-4 transition-colors outline-none focus-visible:ring-2"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">{category.label}</h3>
            {category.urgentCount ? (
              <StatusBadge tone="danger">
                {category.urgentCount} urgentes
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {category.count}
          </p>
          <p className="text-muted-foreground text-sm">
            {category.count === 1 ? "archivo" : "archivos"} ·{" "}
            {category.documentCount} documentos · {category.reportCount}{" "}
            reportes
          </p>
          {category.insights.length ? (
            <p className="text-foreground mt-2 text-xs font-medium">
              {category.insights.join(" · ")}
            </p>
          ) : null}
          <p className="text-muted-foreground mt-2 text-xs">
            Última actualización: {formatDate(category.latestAt)}
          </p>
          {category.pendingCount ? (
            <p className="text-warning mt-1 text-xs font-medium">
              {category.pendingCount} pendientes
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export default async function AdminCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const { tab } = await searchParams;
  const workspace = await getAdminCompanyWorkspace(companyId);
  if (!workspace) notFound();
  const { company, summary, categories, activity } = workspace;

  if (tab === "actividad") {
    const sibaritaActivity =
      company.slug === "sibarita"
        ? await getSibaritaRecentActivity(company.id)
        : [];
    const hasActivity = activity.length > 0 || sibaritaActivity.length > 0;
    return (
      <SurfaceCard padding="md" className="space-y-6">
        {hasActivity ? null : (
          <EmptyState
            icon={CalendarClock}
            title="Sin actividad reciente"
            description={`Cuando ${company.name} envíe documentos o se publiquen reportes, aparecerán aquí.`}
          />
        )}
        {sibaritaActivity.length ? (
          <section aria-labelledby="actividad-nomina" className="space-y-3">
            <h2 id="actividad-nomina" className="text-sm font-semibold">
              Nómina
            </h2>
            <div className="space-y-2">
              {sibaritaActivity.map((item) => (
                <ActivityLink
                  key={item.id}
                  href={item.href}
                  title={item.label}
                  meta={formatDate(item.timestamp)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {activity.length ? (
          <section aria-labelledby="actividad-docs" className="space-y-3">
            <h2 id="actividad-docs" className="text-sm font-semibold">
              Documentos y reportes
            </h2>
            <div className="space-y-2">
              {activity.map((item) => (
                <ActivityLink
                  key={item.id}
                  href={item.href}
                  title={item.title}
                  meta={`${item.description} · ${formatDate(item.timestamp)}`}
                />
              ))}
            </div>
          </section>
        ) : null}
      </SurfaceCard>
    );
  }

  const cards = await getAdminClientDashboard();
  const card = cards.find((entry) => entry.company.id === company.id);
  const invoice = summary.invoice;

  return (
    <div className="space-y-5">
      <section aria-labelledby="tareas-titulo">
        <h2
          id="tareas-titulo"
          className="mb-3 text-base font-semibold tracking-tight"
        >
          Tareas de la semana
        </h2>
        <SurfaceCard padding="sm" className="p-0">
          {card?.items.length ? (
            <div className="divide-border/60 divide-y px-3 py-1">
              {card.items.map((item) => (
                <ChecklistRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground px-5 py-6 text-sm">
              Esta empresa no tiene tareas semanales configuradas.
            </p>
          )}
        </SurfaceCard>
      </section>

      <section aria-labelledby="docs-titulo">
        <h2
          id="docs-titulo"
          className="mb-3 text-base font-semibold tracking-tight"
        >
          Documentos y reportes
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard
            label="Documentos"
            value={summary.documents}
            hint={`Último: ${formatDate(summary.lastDocumentAt)}`}
          />
          <MetricCard label="Pendientes" value={summary.pending} />
          <MetricCard label="En revisión" value={summary.reviewing} />
          <MetricCard label="Procesados" value={summary.processed} />
          <MetricCard
            label="Reportes"
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
            <h2 className="text-base font-semibold tracking-tight">
              Última factura
            </h2>
            {invoice.latestNumber ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="text-lg font-semibold">#{invoice.latestNumber}</p>
                <p className="text-sm tabular-nums">
                  {invoice.latestDate ?? "Sin fecha"} ·{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: invoice.latestCurrency,
                  }).format(invoice.latestTotal ?? 0)}
                </p>
                {invoice.latestStatus ? (
                  <StatusBadge
                    tone={
                      INVOICE_STATUS_TONES[
                        invoice.latestStatus as keyof typeof INVOICE_STATUS_TONES
                      ] ?? "neutral"
                    }
                  >
                    {labelFor(INVOICE_STATUS_LABELS, invoice.latestStatus)}
                  </StatusBadge>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                No hay facturas emitidas para esta empresa.
              </p>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              {invoice.unpaidCount} pendientes de pago
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/dashboard/admin/companies/${company.id}/invoices`}>
              Ver facturas
            </Link>
          </Button>
        </div>
      </SurfaceCard>

      {categories.length && company.slug !== "tresbe" ? (
        <SurfaceCard padding="sm" className="p-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="categorias">
              <AccordionTrigger>
                <span className="flex-1">
                  Categorías operativas ({categories.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <CategoryCards companyId={company.id} categories={categories} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
