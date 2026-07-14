import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getBillingCompanies, getBillingSettings } from "@/services/invoices";

export const dynamic = "force-dynamic";

function todayPuertoRico() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NewInvoicePage() {
  await requireAdmin();
  const [companies, settings] = await Promise.all([
    getBillingCompanies(),
    getBillingSettings(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturación"
        title="Nueva factura"
        description="El número oficial se asignará únicamente cuando emitas el borrador."
      />
      <InvoiceEditor
        companies={companies}
        settings={settings}
        today={todayPuertoRico()}
      />
    </div>
  );
}
