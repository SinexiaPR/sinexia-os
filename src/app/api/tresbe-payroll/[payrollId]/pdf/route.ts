import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildTresbePayrollPdf } from "@/lib/tresbe-payroll/pdf";
import { tresbePayrollAnalysisSchema } from "@/lib/tresbe-payroll/analysis";
import type {
  TresbePayroll,
  TresbePayrollEntry,
} from "@/services/tresbe-payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ payrollId: string }> },
) {
  const profile = await requireAuth();
  const { payrollId } = await context.params;
  const supabase = await createClient();
  const { data: payroll, error } = await supabase
    .from("tresbe_payrolls")
    .select("*")
    .eq("id", payrollId)
    .maybeSingle();
  if (error || !payroll)
    return NextResponse.json(
      { error: "Nómina no encontrada" },
      { status: 404 },
    );
  const typedPayroll = payroll as TresbePayroll;
  if (profile.role === "client") {
    if (
      profile.company_id !== typedPayroll.company_id ||
      !["sent", "viewed", "corrected"].includes(typedPayroll.status)
    )
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [{ data: company }, { data: entries, error: entriesError }, analysisResult] =
    await Promise.all([
      supabase
        .from("companies")
        .select("name,slug")
        .eq("id", typedPayroll.company_id)
        .maybeSingle(),
      supabase
        .from("tresbe_payroll_entries")
        .select("*")
        .eq("payroll_id", typedPayroll.id)
        .order("area_snapshot")
        .order("employee_name_snapshot"),
      profile.role === "client"
        ? Promise.resolve({ data: null })
        : supabase
            .from("tresbe_payroll_analysis")
            .select("data")
            .eq("payroll_id", typedPayroll.id)
            .maybeSingle(),
    ]);
  if (company?.slug !== "tresbe" || entriesError)
    return NextResponse.json(
      { error: "Nómina no encontrada" },
      { status: 404 },
    );
  const analysisParsed = analysisResult.data
    ? tresbePayrollAnalysisSchema.safeParse(analysisResult.data.data)
    : null;

  if (profile.role === "client") {
    await supabase.rpc("mark_tresbe_payroll_viewed", {
      p_payroll_id: typedPayroll.id,
    });
  } else {
    await supabase.from("tresbe_payroll_events").insert({
      payroll_id: typedPayroll.id,
      user_id: profile.id,
      event_type: "pdf_generated",
    });
  }

  const bytes = await buildTresbePayrollPdf({
    companyName: company.name,
    payroll: typedPayroll,
    entries: (entries ?? []) as TresbePayrollEntry[],
    analysis: analysisParsed?.success ? analysisParsed.data : null,
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="nomina-tresbe-${typedPayroll.week_start}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
