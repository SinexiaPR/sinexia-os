import { notFound } from "next/navigation";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCompanyWorkspace } from "@/services/company-workspace";
import { getInvoices } from "@/services/invoices";

export const dynamic = "force-dynamic";

export default async function AdminCompanyInvoicesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const [workspace, invoices] = await Promise.all([
    getAdminCompanyWorkspace(companyId),
    getInvoices(companyId),
  ]);
  if (!workspace) notFound();

  return <InvoiceList invoices={invoices} />;
}
