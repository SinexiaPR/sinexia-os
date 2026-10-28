import { BillingClientsEditor } from "@/components/invoices/billing-clients-editor";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getBillingBatchClients } from "@/services/billing-batch";

export const dynamic = "force-dynamic";

export default async function BillingBatchClientsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [clients, companiesRes] = await Promise.all([
    getBillingBatchClients(),
    supabase.from("companies").select("id,name").order("name"),
  ]);
  if (companiesRes.error) throw companiesRes.error;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Facturación", href: "/dashboard/admin/invoices" },
          { label: "Clientes facturables" },
        ]}
        title="Clientes facturables"
        description='Quiénes entran en "Generar facturas de la semana", con qué monto (fijo o del sistema) y qué descripción de línea. Desactivar en vez de borrar -- nunca se pierde el historial.'
      />
      <BillingClientsEditor
        clients={clients}
        companies={companiesRes.data ?? []}
      />
    </div>
  );
}
