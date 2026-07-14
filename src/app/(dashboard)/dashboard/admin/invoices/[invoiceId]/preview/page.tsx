import { notFound } from "next/navigation";

import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getBillingSettings, getInvoice } from "@/services/invoices";

export const dynamic = "force-dynamic";

export default async function InvoicePreviewPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  await requireAdmin();
  const { invoiceId } = await params;
  const [{ invoice, items }, settings] = await Promise.all([
    getInvoice(invoiceId),
    getBillingSettings(),
  ]);
  if (!invoice) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturación"
        title="Vista previa"
        description="Representación visual antes de descargar el PDF final."
      />
      <InvoicePreview invoice={invoice} items={items} settings={settings} />
    </div>
  );
}
