import { LeaveAccrualReport } from "@/components/leave-accrual/leave-accrual-report";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { resolveSibaritaCompany } from "@/services/payroll";
import { getLeaveAccrualReport, getLeaveAccrualSettings } from "@/services/leave-accrual";
import { resolveTresbeCompany } from "@/services/tresbe-payroll";

export const dynamic = "force-dynamic";

export default async function LeaveAccrualPage() {
  await requireAdmin();

  const [rows, sibaritaCompany, tresbeCompany] = await Promise.all([
    getLeaveAccrualReport(),
    resolveSibaritaCompany(),
    resolveTresbeCompany(),
  ]);

  const companySettings = await Promise.all(
    [sibaritaCompany, tresbeCompany]
      .filter((company): company is NonNullable<typeof company> => company != null)
      .map(async (company) => ({
        companyId: company.id,
        companyName: company.name,
        sickBalanceCapHours: (await getLeaveAccrualSettings(company.id))
          .sickBalanceCapHours,
      })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Vacaciones y enfermedad"
        description="Balance de acumulación de vacaciones y enfermedad para empleados W2 de nómina, calculado automáticamente desde las nóminas semanales de Sibarita y Tresbe."
      />
      <LeaveAccrualReport rows={rows} companySettings={companySettings} />
    </div>
  );
}
