import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/session";
import { checkWeekCompleteness } from "@/lib/tresbe-budget/completeness";
import { buildTresbeBudgetPdf } from "@/lib/tresbe-budget/pdf";
import {
  getBudgetCreditLineStatus,
  getBudgetHorizonSummary,
  getBudgetWeekWorkspace,
  resolveTresbeCompany,
} from "@/services/tresbe-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  // El presupuesto es un módulo interno: sin excepción para el portal cliente.
  await requireAdmin();
  const { companyId } = await context.params;
  const company = await resolveTresbeCompany(companyId);
  if (!company)
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );

  const week = new URL(request.url).searchParams.get("week");
  const workspace = await getBudgetWeekWorkspace(company.id, week);
  const horizon = await getBudgetHorizonSummary(company.id);
  const creditLineStatus = await getBudgetCreditLineStatus(
    company.id,
    workspace.weekStart,
  );
  const warnings = checkWeekCompleteness({
    dates: workspace.weekDates,
    categories: workspace.categories,
    movements: workspace.movements,
    closedDays: workspace.closedDays,
    cashControl: workspace.cashControl,
  });

  const bytes = await buildTresbeBudgetPdf({
    companyName: company.name,
    weekStart: workspace.weekStart,
    weekNumber: workspace.weekNumber,
    view: workspace.week,
    horizon: { weeks: horizon.weeks, rows: horizon.rows },
    creditLineStatus,
    warnings,
    closedDays: workspace.closedDays,
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="presupuesto-tresbe-${workspace.weekStart}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
