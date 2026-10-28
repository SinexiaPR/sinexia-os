import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { InvoiceMoreActions } from "@/components/invoices/invoice-more-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatMoneyByCurrency,
  parseStatusFilter,
  summarizeInvoices,
} from "@/lib/invoices/list";
import { getInvoices } from "@/services/invoices";

export const metadata: Metadata = {
  title: "Facturación",
};

export const dynamic = "force-dynamic";

function todayInPuertoRico() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  await requireAdmin();
  const { estado } = await searchParams;
  const invoices = await getInvoices();
  const summary = summarizeInvoices(invoices, todayInPuertoRico());

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facturación"
        description="Crea, emite, descarga y entrega facturas de cualquier cliente."
        action={
          <div className="flex flex-wrap gap-2">
            <InvoiceMoreActions />
            <Button asChild className="h-10">
              <Link href="/dashboard/admin/invoices/new">
                <Plus className="size-4" />
                Nueva factura
              </Link>
            </Button>
          </div>
        }
      />

      <SurfaceCard padding="sm" className="p-0">
        <dl
          aria-label="Resumen de facturación"
          className="divide-border/70 grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          {[
            {
              label: "Total pendiente",
              value: formatMoneyByCurrency(summary.pending),
              hint: "Emitidas y sin pagar",
            },
            {
              label: "Total vencido",
              value: formatMoneyByCurrency(summary.overdue),
              hint: `${summary.overdueCount} ${summary.overdueCount === 1 ? "factura" : "facturas"}`,
            },
            {
              label: "Cobrado este mes",
              value: formatMoneyByCurrency(summary.collectedThisMonth),
              hint: "Facturas marcadas como pagadas",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-baseline justify-between gap-3 px-5 py-3 sm:block sm:py-4"
            >
              <dt className="text-muted-foreground text-xs font-medium">
                {item.label}
              </dt>
              <dd className="sm:mt-1">
                <span className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                  {item.value}
                </span>
                <span className="text-muted-foreground hidden text-xs sm:mt-1 sm:block">
                  {item.hint}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </SurfaceCard>

      <InvoiceList
        invoices={invoices}
        initialStatus={parseStatusFilter(estado)}
      />
    </div>
  );
}
