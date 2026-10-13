import Link from "next/link";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { getInvoices } from "@/services/invoices";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  await requireAdmin();
  const invoices = await getInvoices();
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
      <InvoiceList invoices={invoices} />
    </div>
  );
}
