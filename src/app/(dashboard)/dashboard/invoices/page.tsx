import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";

import { ClientInvoiceList } from "@/components/invoices/client-invoice-list";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { InvoiceViewTracker } from "@/components/invoices/invoice-view-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireClient } from "@/lib/auth/session";
import { formatMoneyByCurrency, summarizeInvoices } from "@/lib/invoices/list";
import {
  getBillingSettings,
  getInvoice,
  getInvoices,
  shouldShowCompanyInvoices,
} from "@/services/invoices";

export const metadata: Metadata = {
  title: "Facturas",
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

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const profile = await requireClient();
  if (
    !profile.company_id ||
    !(await shouldShowCompanyInvoices(profile.company_id))
  )
    notFound();
  const { invoiceId } = await searchParams;
  const invoices = await getInvoices(profile.company_id);
  const selectedId = invoiceId;
  const selected = selectedId ? await getInvoice(selectedId) : null;
  const settings = selected?.invoice ? await getBillingSettings() : null;
  const summary = summarizeInvoices(invoices, todayInPuertoRico());
  const pendingCount = invoices.filter((invoice) =>
    ["issued", "sent", "viewed", "overdue"].includes(invoice.status),
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facturas"
        description="Consulte y descargue las facturas que Sinexia le ha emitido."
      />

      {invoices.length ? (
        <>
          <SurfaceCard padding="sm">
            <p className="text-muted-foreground text-xs font-medium">
              Pendiente de pago
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatMoneyByCurrency(summary.pending)}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {pendingCount} {pendingCount === 1 ? "factura" : "facturas"}
            </p>
          </SurfaceCard>
          <ClientInvoiceList invoices={invoices} selectedId={selectedId} />
        </>
      ) : (
        <SurfaceCard padding="sm" className="p-0">
          <EmptyState
            icon={Receipt}
            title="No tienes facturas disponibles."
            description="Cuando Sinexia emita una factura para su empresa, aparecerá aquí."
          />
        </SurfaceCard>
      )}

      {selected?.invoice ? (
        <section id="factura" className="scroll-mt-20 space-y-4">
          <InvoiceViewTracker invoiceId={selected.invoice.id} />
          {selected.invoice.pdf_storage_path ? (
            <Button asChild className="h-11">
              <a href={`/api/invoices/${selected.invoice.id}/download`}>
                Descargar PDF
              </a>
            </Button>
          ) : null}
          <InvoicePreview
            invoice={selected.invoice}
            items={selected.items}
            settings={settings}
          />
        </section>
      ) : null}
    </div>
  );
}
