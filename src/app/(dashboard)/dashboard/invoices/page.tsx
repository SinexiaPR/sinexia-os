import { notFound } from "next/navigation";

import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { InvoiceViewTracker } from "@/components/invoices/invoice-view-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireClient } from "@/lib/auth/session";
import {
  getBillingSettings,
  getInvoice,
  getInvoices,
  isCompanyInvoicingEnabled,
} from "@/services/invoices";

export const dynamic = "force-dynamic";

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const profile = await requireClient();
  if (
    !profile.company_id ||
    !(await isCompanyInvoicingEnabled(profile.company_id))
  )
    notFound();
  const { invoiceId } = await searchParams;
  const invoices = await getInvoices(profile.company_id);
  const selectedId = invoiceId ?? invoices[0]?.id;
  const selected = selectedId ? await getInvoice(selectedId) : null;
  const settings = selected?.invoice ? await getBillingSettings() : null;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portal del cliente"
        title="Facturas"
        description="Consulta y descarga las facturas publicadas para tu compañía."
      />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <SurfaceCard padding="sm">
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <a
                key={invoice.id}
                href={`/dashboard/invoices?invoiceId=${invoice.id}`}
                className={`block rounded-lg border p-3 text-sm ${invoice.id === selectedId ? "border-primary bg-muted" : ""}`}
              >
                <div className="flex justify-between gap-2">
                  <strong>#{invoice.invoice_number}</strong>
                  <span>{invoice.status}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {invoice.invoice_date ?? "Sin fecha"} ·{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: invoice.currency,
                  }).format(Number(invoice.total))}
                </p>
              </a>
            ))}
            {!invoices.length ? (
              <p className="text-muted-foreground p-3 text-sm">
                No hay facturas publicadas.
              </p>
            ) : null}
          </div>
        </SurfaceCard>
        <div className="space-y-4">
          {selected?.invoice ? (
            <>
              <InvoiceViewTracker invoiceId={selected.invoice.id} />
              {selected.invoice.pdf_storage_path ? (
                <Button asChild>
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
