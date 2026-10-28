import type { Metadata } from "next";

import { CompaniesDirectory } from "@/components/dashboard/companies-directory";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminClientDashboard } from "@/services/admin-client-dashboard";

export const metadata: Metadata = {
  title: "Clientes",
};

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  await requireAdmin();
  const cards = await getAdminClientDashboard();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Todas las empresas que administra Sinexia. Abre una ficha para ver sus facturas, nómina, documentos y reportes."
      />
      <CompaniesDirectory cards={cards} />
    </div>
  );
}
