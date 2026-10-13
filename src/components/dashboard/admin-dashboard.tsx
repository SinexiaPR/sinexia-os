import { AdminClientCards } from "@/components/dashboard/admin-client-cards";
import { PageHeader } from "@/components/layout/page-header";
import { getAdminClientDashboard } from "@/services/admin-client-dashboard";

export async function AdminDashboard() {
  const cards = await getAdminClientDashboard();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin workspace"
        title="Dashboard"
        description="Estado de cada cliente activo: nómina, facturación y el resto de sus acciones principales."
      />
      <AdminClientCards cards={cards} />
    </div>
  );
}
