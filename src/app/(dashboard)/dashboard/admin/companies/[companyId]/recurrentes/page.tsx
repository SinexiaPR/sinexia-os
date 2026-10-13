import { RecurrentesWorkspace } from "@/components/cutmeat-recurrentes/recurrentes-workspace";
import { todayInPuertoRico } from "@/lib/cutmeat-daily/dates";
import {
  getAvailablePeriods,
  getRecurrentesForPeriod,
  requireCutMeatAccess,
} from "@/services/cutmeat-recurrentes";

export const dynamic = "force-dynamic";

function currentPeriod(): string {
  return `${todayInPuertoRico().slice(0, 7)}-01`;
}

export default async function CutMeatRecurrentesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId } = await params;
  const { period } = await searchParams;
  const { company, canWrite } = await requireCutMeatAccess(companyId);

  const selectedPeriod =
    period && /^\d{4}-\d{2}-01$/.test(period) ? period : currentPeriod();

  const [recurrentes, periods] = await Promise.all([
    getRecurrentesForPeriod(company.id, selectedPeriod),
    getAvailablePeriods(company.id),
  ]);

  return (
    <RecurrentesWorkspace
      company={company}
      period={selectedPeriod}
      periods={periods}
      recurrentes={recurrentes}
      canWrite={canWrite}
    />
  );
}
