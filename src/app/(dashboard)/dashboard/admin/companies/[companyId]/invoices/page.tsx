import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCompanyWorkspace } from "@/services/company-workspace";
import { getInvoices } from "@/services/invoices";
import type { Invoice, InvoiceStatus } from "@/types/invoices";

export const dynamic = "force-dynamic";

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  issued: "Emitida",
  sent: "Enviada",
  viewed: "Vista",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

const emailLabels = {
  pending: "Pendiente",
  sent: "Enviado",
  failed: "Falló",
  not_configured: "No configurado",
} as const;

function money(invoice: Invoice) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: invoice.currency,
  }).format(Number(invoice.total));
}

export default async function AdminCompanyInvoicesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const [workspace, companyInvoices] = await Promise.all([
    getAdminCompanyWorkspace(companyId),
    getInvoices(companyId),
  ]);
  if (!workspace) notFound();
  const invoices = companyInvoices
    .filter((invoice) => !invoice.is_legacy_import)
    .sort(
      (left, right) =>
        (right.invoice_number ?? -1) - (left.invoice_number ?? -1) ||
        right.created_at.localeCompare(left.created_at),
    );

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href={`/dashboard/admin/companies/${companyId}`}>
          <ArrowLeft className="size-4" />
          Volver a {workspace.company.name}
        </Link>
      </Button>
      <PageHeader
        eyebrow={workspace.company.name}
        title="Facturas"
        description="Facturas generadas para esta empresa."
      />
      <SurfaceCard padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-muted-foreground border-b text-xs uppercase">
              <tr>
                <th className="px-3 py-3">Factura</th>
                <th>Fecha</th>
                <th>Vence</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Correo</th>
                <th>Enviada</th>
                <th>Pagada</th>
                <th>Vista</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b last:border-0">
                  <td className="px-3 py-4 font-medium">
                    {invoice.invoice_number
                      ? `#${invoice.invoice_number}`
                      : "Borrador"}
                  </td>
                  <td>{invoice.invoice_date ?? "—"}</td>
                  <td>{invoice.due_date ?? "—"}</td>
                  <td className="font-medium">{money(invoice)}</td>
                  <td>{statusLabels[invoice.status]}</td>
                  <td>
                    {invoice.email_status
                      ? emailLabels[invoice.email_status]
                      : "—"}
                  </td>
                  <td>{invoice.sent_at?.slice(0, 10) ?? "—"}</td>
                  <td>{invoice.paid_at?.slice(0, 10) ?? "—"}</td>
                  <td>
                    {invoice.viewed_at
                      ? `Vista · ${invoice.viewed_at.slice(0, 16).replace("T", " ")}`
                      : "No vista"}
                  </td>
                  <td className="space-x-2 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/admin/invoices/${invoice.id}`}>
                        Ver
                      </Link>
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
              No hay facturas generadas para esta empresa.
            </p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
