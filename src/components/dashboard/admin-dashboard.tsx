import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { ChecklistRow } from "@/components/dashboard/client-checklist";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { PageHeader } from "@/components/layout/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { summarizeAdminHome } from "@/lib/admin-client-dashboard/home";
import {
  getAdminRecentActivity,
  type AdminActivityItem,
} from "@/services/activity";
import { getAdminClientDashboard } from "@/services/admin-client-dashboard";
import {
  getAdminHomeCounts,
  type AdminHomeCounts,
} from "@/services/admin-home";
import type { ClientDashboardCard } from "@/types/admin-client-dashboard";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export async function AdminDashboard() {
  const [cards, counts, activity] = await Promise.all([
    getAdminClientDashboard(),
    getAdminHomeCounts(),
    getAdminRecentActivity(8),
  ]);
  return <AdminHomeView cards={cards} counts={counts} activity={activity} />;
}

export function AdminHomeView({
  cards,
  counts,
  activity,
}: {
  cards: ClientDashboardCard[];
  counts: AdminHomeCounts;
  activity: AdminActivityItem[];
}) {
  const summary = summarizeAdminHome(cards);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inicio"
        description="Lo que requiere tu atención hoy y el estado de cada cliente."
      />

      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <KpiCard
          label="Clientes con pendientes"
          value={summary.clientsWithPending}
          hint={`de ${cards.length} clientes activos`}
          href="/dashboard/admin/companies"
        />
        <KpiCard
          label="Facturas vencidas"
          value={counts.overdueInvoices}
          hint="según su fecha de vencimiento"
          href="/dashboard/admin/invoices?estado=overdue"
        />
        <KpiCard
          label="Nóminas por aprobar"
          value={summary.payrollsToApprove}
          hint="cargadas y sin cerrar"
          href="#requiere-atencion"
        />
        <KpiCard
          label="Documentos por revisar"
          value={counts.documentsToReview}
          hint="pendientes o en revisión"
          href="/dashboard/inbox?status=received"
        />
      </section>

      <section id="requiere-atencion" aria-labelledby="atencion-titulo">
        <h2
          id="atencion-titulo"
          className="mb-3 text-base font-semibold tracking-tight"
        >
          Requiere tu atención
        </h2>
        {summary.attention.length ? (
          <div className="space-y-3">
            {summary.attention.map(
              ({ card, openItems, pendingCount, inProgressCount }) => (
                <SurfaceCard key={card.company.id} padding="sm" className="p-0">
                  <div className="border-border/70 flex items-center justify-between gap-3 border-b px-5 py-3">
                    <Link
                      href={`/dashboard/admin/companies/${card.company.id}`}
                      className="hover:text-primary focus-visible:ring-ring rounded-sm text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {card.company.name}
                    </Link>
                    <div className="flex flex-wrap justify-end gap-2">
                      {pendingCount > 0 ? (
                        <StatusBadge tone="danger">
                          {plural(pendingCount, "pendiente", "pendientes")}
                        </StatusBadge>
                      ) : null}
                      {inProgressCount > 0 ? (
                        <StatusBadge tone="warning">
                          {plural(inProgressCount, "en proceso", "en proceso")}
                        </StatusBadge>
                      ) : null}
                    </div>
                  </div>
                  <div className="divide-border/60 divide-y px-3 py-1">
                    {openItems.map((item) => (
                      <ChecklistRow key={item.id} item={item} />
                    ))}
                  </div>
                </SurfaceCard>
              ),
            )}
          </div>
        ) : (
          <SurfaceCard padding="sm" className="p-0">
            <EmptyState
              icon={CheckCircle2}
              title="Todo al día"
              description="Ningún cliente tiene tareas pendientes en este momento."
            />
          </SurfaceCard>
        )}
      </section>

      {summary.upToDate.length ? (
        <section aria-labelledby="al-dia-titulo">
          <h2
            id="al-dia-titulo"
            className="mb-3 text-base font-semibold tracking-tight"
          >
            Clientes al día ({summary.upToDate.length})
          </h2>
          <SurfaceCard padding="sm" className="p-0">
            <Accordion type="multiple">
              {summary.upToDate.map((card) => (
                <AccordionItem key={card.company.id} value={card.company.id}>
                  <AccordionTrigger>
                    <span className="min-w-0 flex-1 truncate">
                      {card.company.name}
                    </span>
                    <StatusBadge tone="success">Al día</StatusBadge>
                  </AccordionTrigger>
                  <AccordionContent>
                    {card.items.length ? (
                      <div className="divide-border/60 divide-y">
                        {card.items.map((item) => (
                          <ChecklistRow key={item.id} item={item} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground py-2 text-xs">
                        Sin acciones configuradas.
                      </p>
                    )}
                    <Link
                      href={`/dashboard/admin/companies/${card.company.id}`}
                      className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
                    >
                      Abrir ficha de {card.company.name}
                    </Link>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SurfaceCard>
        </section>
      ) : null}

      <section aria-label="Actividad reciente">
        <SurfaceCard padding="sm" className="p-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="actividad">
              <AccordionTrigger>
                <span className="flex-1">Actividad reciente</span>
              </AccordionTrigger>
              <AccordionContent>
                <RecentActivityFeed items={activity} bare />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SurfaceCard>
      </section>
    </div>
  );
}
