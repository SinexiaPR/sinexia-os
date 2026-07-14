import { BillingSettingsWorkspace } from "@/components/invoices/billing-settings";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getBillingCompanies, getBillingSettings } from "@/services/invoices";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  await requireAdmin();
  const [{ companyId }, settings, companies] = await Promise.all([
    searchParams,
    getBillingSettings(),
    getBillingCompanies(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturación"
        title="Configuración de facturación"
        description="Administra el emisor, información de pago y perfiles de clientes sin hardcodear datos en la interfaz."
      />
      <BillingSettingsWorkspace
        settings={settings}
        companies={companies}
        initialCompanyId={companyId}
      />
    </div>
  );
}
