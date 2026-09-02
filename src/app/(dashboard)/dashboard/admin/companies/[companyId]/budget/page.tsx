import { notFound } from "next/navigation";

import { TresbeBudgetWorkspace } from "@/components/tresbe-budget/budget-workspace";
import { requireAdmin } from "@/lib/auth/session";
import {
  getBudgetHorizonSummary,
  getBudgetWeekWorkspace,
  resolveTresbeCompany,
} from "@/services/tresbe-budget";

export const dynamic = "force-dynamic";

export default async function TresbeBudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const { week } = await searchParams;
  const company = await resolveTresbeCompany(companyId);
  if (!company) notFound();
  const workspace = await getBudgetWeekWorkspace(company.id, week);
  const horizon = await getBudgetHorizonSummary(company.id);
  return (
    <TresbeBudgetWorkspace
      key={workspace.weekStart}
      company={company}
      weekStart={workspace.weekStart}
      weekNumber={workspace.weekNumber}
      week={workspace.week}
      categories={workspace.categories}
      counterparties={workspace.counterparties}
      movements={workspace.movements}
      assumptions={workspace.assumptions}
      horizon={{ weeks: horizon.weeks, rows: horizon.rows }}
    />
  );
}
