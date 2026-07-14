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
  shouldShowCompanyInvoices,
} from "@/services/invoices";
import type { InvoiceStatus } from "@/types/invoices";

export const dynamic = "force-dynamic";

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  issued: "Pendiente de pago",
  sent: "Pendiente de pago",
  viewed: "Pendiente de pago",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

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
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portal del cliente"
        title="Facturas"
        description="Consulta y descarga las facturas publicadas para tu compañía."
      />
      <SurfaceCard padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-muted-foreground border-b text-xs uppercase">
              <tr>
                <th className="px-3 py-3">Factura</th>
                <th>Fecha</th>
                <th>Vence</th>
                <th>Total</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b last:border-0">
                  <td className="px-3 py-4 font-medium">
                    #{invoice.invoice_number}
                  </td>
                  <td>{invoice.invoice_date ?? "—"}</td>
                  <td>{invoice.due_date ?? "—"}</td>
                  <td className="font-medium">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: invoice.currency,
                    }).format(Number(invoice.total))}
                  </td>
                  <td>{statusLabels[invoice.status]}</td>
                  <td className="space-x-2 text-right">
                    <Button asChild size="sm" variant="outline">
                      <a href={`/dashboard/invoices?invoiceId=${invoice.id}`}>
                        Ver factura
                      </a>
                    </Button>
                    {invoice.pdf_storage_path ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/invoices/${invoice.id}/download`}>
                          Descargar PDF
                        </a>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!invoices.length ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No tienes facturas disponibles.
            </p>
          ) : null}
        </div>
      </SurfaceCard>
      {selected?.invoice ? (
        <div className="space-y-4">
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
        </div>
      ) : null}
    </div>
  );
}
