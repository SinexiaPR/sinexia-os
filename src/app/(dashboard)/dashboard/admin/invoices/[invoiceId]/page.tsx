import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import {
  getBillingCompanies,
  getBillingSettings,
  getInvoice,
} from "@/services/invoices";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { invoiceId } = await params;
  const { edit } = await searchParams;
  const [{ invoice, items, deliveries, events }, settings, companies] =
    await Promise.all([
      getInvoice(invoiceId),
      getBillingSettings(),
      getBillingCompanies(),
    ]);
  if (!invoice) notFound();
  const title = invoice.invoice_number
    ? `Factura #${invoice.invoice_number}`
    : "Borrador de factura";
  if (edit === "1" && invoice.status === "draft")
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Facturación"
          title={`Editar ${title.toLowerCase()}`}
        />
        <InvoiceEditor
          companies={companies}
          settings={settings}
          today={invoice.invoice_date ?? new Date().toISOString().slice(0, 10)}
          invoice={invoice}
          existingItems={items}
        />
      </div>
    );
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturación"
        title={title}
        description={`${invoice.billing_name_snapshot ?? invoice.companies?.name ?? "Cliente"} · ${invoice.status}`}
        action={
          <Button asChild variant="outline">
            <Link href={`/dashboard/admin/invoices/${invoice.id}/preview`}>
              Vista previa
            </Link>
          </Button>
        }
      />
      <InvoiceActions invoice={invoice} />
      <InvoicePreview invoice={invoice} items={items} settings={settings} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <h2 className="font-semibold">Historial de correo</h2>
          <div className="mt-4 space-y-3 text-sm">
            {deliveries.length ? (
              deliveries.map((delivery) => (
                <div key={delivery.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-3">
                    <strong>{delivery.recipient}</strong>
                    <span>{delivery.delivery_status}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {delivery.created_at}
                  </p>
                  {delivery.error_message ? (
                    <p className="text-destructive mt-2">
                      {delivery.error_message}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Sin entregas.</p>
            )}
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <h2 className="font-semibold">Auditoría</h2>
          <div className="mt-4 space-y-3 text-sm">
            {events.length ? (
              events.map((event) => (
                <div
                  key={event.id}
                  className="flex justify-between gap-3 border-b pb-2"
                >
                  <span>{event.event_type}</span>
                  <span className="text-muted-foreground text-xs">
                    {event.created_at}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Sin eventos adicionales.</p>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
