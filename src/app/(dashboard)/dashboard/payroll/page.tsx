import { notFound } from "next/navigation";

import { LeaveAccrualReport } from "@/components/leave-accrual/leave-accrual-report";
import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { TresbeClientPayrolls } from "@/components/tresbe-payroll/client-payrolls";
import { requireAuth } from "@/lib/auth/session";
import {
  getLeaveAccrualSettings,
  getSibaritaReportRows,
} from "@/services/leave-accrual";
import {
  getPayrollWorkspace,
  resolveSibaritaCompany,
} from "@/services/payroll";
import {
  getTresbeClientWorkspace,
  resolveTresbeCompany,
} from "@/services/tresbe-payroll";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; payroll?: string }>;
}) {
  const profile = await requireAuth();
  const params = await searchParams;
  if (profile.role === "client" && profile.company_id) {
    const tresbe = await resolveTresbeCompany(profile.company_id);
    if (tresbe) {
      const workspace = await getTresbeClientWorkspace(
        tresbe.id,
        params.payroll,
      );
      return <TresbeClientPayrolls {...workspace} />;
    }
  }
  const requestedId =
    profile.role === "admin" ? params.company : profile.company_id;
  if (!requestedId) notFound();
  const company = await resolveSibaritaCompany(requestedId);
  if (
    !company ||
    (profile.role === "client" && company.id !== profile.company_id)
  )
    notFound();
  const data = await getPayrollWorkspace(company.id, params.payroll);
  const isAdmin = profile.role === "admin";
  const leaveAccrual = isAdmin
    ? await Promise.all([
        getSibaritaReportRows(),
        getLeaveAccrualSettings(company.id),
      ])
    : null;
  return (
    <div className="space-y-8">
      <PayrollWorkspace
        key={data.selected?.id}
        company={company}
        isAdmin={isAdmin}
        {...data}
      />
      {leaveAccrual ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Vacaciones y enfermedad</h2>
            <p className="text-muted-foreground text-sm">
              Balance de acumulación para empleados W2 de {company.name}.
            </p>
          </div>
          <LeaveAccrualReport
            rows={leaveAccrual[0]}
            companySettings={[
              {
                companyId: company.id,
                companyName: company.name,
                sickBalanceCapHours: leaveAccrual[1].sickBalanceCapHours,
              },
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}
