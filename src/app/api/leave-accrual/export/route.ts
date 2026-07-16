import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth/session";
import { getLeaveAccrualReport } from "@/services/leave-accrual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getLeaveAccrualReport();

  // Dynamic require matches the working Excel path used elsewhere in this
  // codebase (src/lib/intelligence/extraction/excel.ts) on serverless.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");

  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Empleado: row.employeeName,
      Sistema: row.sourceSystem,
      "Fecha de contratación": row.hiringDate ?? "",
      "Años de servicio": row.yearsOfService ?? "",
      "Horas del mes actual": row.currentMonthHours,
      "Califica este mes": row.currentMonthQualifies ? "Sí" : "No",
      "Balance de vacaciones (h)": row.vacationBalanceHours,
      "Balance de enfermedad (h)": row.sickBalanceHours,
      "Última nómina procesada": row.lastPayrollProcessedAt ?? "",
    })),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vacaciones y enfermedad");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="balance-vacaciones-enfermedad-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
