import { PageHeader } from "@/components/layout/page-header";
import { WeeklyBatchGenerator } from "@/components/invoices/weekly-batch-generator";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function WeeklyInvoiceBatchPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Generar facturas de la semana"
        description="Vista previa antes de crear nada. Cada cliente facturable activo entra en la lista; podés ajustar montos puntuales o excluir clientes antes de confirmar."
      />
      <WeeklyBatchGenerator />
    </div>
  );
}
