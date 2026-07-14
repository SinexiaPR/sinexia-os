import Link from "next/link";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { RecurringBilling } from "@/components/invoices/recurring-billing";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import {
  getBillingCompanies,
  getInvoices,
  getRecurringInvoiceProfiles,
} from "@/services/invoices";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  await requireAdmin();
  const [invoices, recurringProfiles, companies] = await Promise.all([
    getInvoices(),
    getRecurringInvoiceProfiles(),
    getBillingCompanies(),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Facturación"
        description="Crea, emite, descarga y entrega facturas para cualquier compañía desde una secuencia global segura."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/admin/settings/billing">
                Configuración
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/admin/invoices/new">Nueva factura</Link>
            </Button>
          </div>
        }
      />
      <RecurringBilling
        profiles={recurringProfiles}
        companies={companies}
        today={today}
      />
      <InvoiceList invoices={invoices} />
    </div>
  );
}
