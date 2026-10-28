import { notFound } from "next/navigation";

import { LeaveAccrualReport } from "@/components/leave-accrual/leave-accrual-report";
import { TresbePayrollAdminWorkspace } from "@/components/tresbe-payroll/admin-workspace";
import { requireAdmin } from "@/lib/auth/session";
import {
  getLeaveAccrualSettings,
  getTresbeReportRows,
} from "@/services/leave-accrual";
import {
  getTresbeAdminWorkspace,
  resolveTresbeCompany,
} from "@/services/tresbe-payroll";

export const dynamic = "force-dynamic";

export default async function TresbeAdminPayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ payroll?: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const { payroll } = await searchParams;
  const company = await resolveTresbeCompany(companyId);
  if (!company) notFound();
  const workspace = await getTresbeAdminWorkspace(company.id, payroll);
  const [leaveRows, leaveSettings] = await Promise.all([
    getTresbeReportRows(),
    getLeaveAccrualSettings(company.id),
  ]);
  return (
    <div className="space-y-8">
      <TresbePayrollAdminWorkspace
        key={workspace.selected?.id ?? "none"}
        company={company}
        {...workspace}
      />
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Vacaciones y enfermedad</h2>
          <p className="text-muted-foreground text-sm">
            Balance de acumulación para empleados W2 de {company.name}.
          </p>
        </div>
        <LeaveAccrualReport
          rows={leaveRows}
          companySettings={[
            {
              companyId: company.id,
              companyName: company.name,
              sickBalanceCapHours: leaveSettings.sickBalanceCapHours,
            },
          ]}
        />
      </section>
    </div>
  );
}
