import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth/session";
import { buildPayrollPdf, type PayrollPdfEntry } from "@/lib/payroll/pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ payrollId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { payrollId } = await context.params;
  const supabase = await createClient();
  const { data: payroll, error: payrollError } = await supabase
    .from("weekly_payrolls")
    .select("id,company_id,week_start,week_end,status,submitted_at")
    .eq("id", payrollId)
    .maybeSingle();

  if (payrollError || !payroll) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (profile.role === "client" && profile.company_id !== payroll.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (payroll.status === "draft") {
    return NextResponse.json(
      { error: "The payroll must be submitted before generating its PDF" },
      { status: 409 },
    );
  }

  const [
    { data: company, error: companyError },
    { data: entries, error: entriesError },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name,slug")
      .eq("id", payroll.company_id)
      .maybeSingle(),
    supabase
      .from("weekly_payroll_entries")
      .select(
        "employee_name_snapshot,section_snapshot,compensation_type_snapshot,regular_rate_snapshot,training_rate_snapshot,fixed_salary_snapshot,regular_hours,training_hours,other_payments,comment",
      )
      .eq("payroll_id", payroll.id)
      .order("section_snapshot")
      .order("employee_name_snapshot"),
  ]);

  if (companyError || !company || company.slug !== "sibarita" || entriesError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await buildPayrollPdf({
    companyName: company.name,
    weekStart: payroll.week_start,
    weekEnd: payroll.week_end,
    status: payroll.status as "submitted" | "approved",
    submittedAt: payroll.submitted_at,
    entries: (entries ?? []) as PayrollPdfEntry[],
  });
  const filename = `nomina-sibarita-${payroll.week_start}.pdf`;

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
