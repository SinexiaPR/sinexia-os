import { notFound } from "next/navigation";

import { LeaveAccrualEmployeeDetail } from "@/components/leave-accrual/leave-accrual-employee-detail";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getEmployeeLeaveDetail } from "@/services/leave-accrual";

export const dynamic = "force-dynamic";

export default async function LeaveAccrualEmployeeDetailPage({
  params,
}: {
  params: Promise<{ system: string; employeeId: string }>;
}) {
  await requireAdmin();
  const { system, employeeId } = await params;
  if (system !== "sibarita" && system !== "tresbe") notFound();

  const detail = await getEmployeeLeaveDetail(system, employeeId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vacaciones y enfermedad"
        title={detail.employeeName}
        description={`${detail.companyName} · Ley 180-1998, según enmendada por la Ley 4-2017`}
      />
      <LeaveAccrualEmployeeDetail detail={detail} />
    </div>
  );
}
