import { extractPayrollFromExcelBuffer } from "@/lib/intelligence/extractors/payroll-excel";
import { detectQueryIntent } from "@/lib/intelligence/intents";
import XLSX from "xlsx";

function buildSampleWorkbook(): Buffer {
  const rows = [
    [
      "Fecha",
      "Turno",
      "Empleado",
      "Área Día",
      "Horas",
      "Tip Café Manual",
      "Tip Turno",
      "Total Horas Turno",
      "Tip Proporcional Calc",
      "Tips Total",
      "Notas",
    ],
    [
      "2026-07-01",
      "AM",
      "CUADRADO, ADALBERTO J.",
      "Cocina",
      8,
      5,
      10,
      8,
      12.5,
      22.5,
      "",
    ],
    ["", "", "", "", "", "", "", "", "", "", ""],
    [
      "2026-07-02",
      "PM",
      "CUADRADO, ADALBERTO J.",
      "Cocina",
      6,
      0,
      8,
      6,
      10,
      18,
      "",
    ],
    [
      "2026-07-01",
      "AM",
      "GARCIA, MARIA",
      "Salon",
      7.5,
      3,
      6,
      7.5,
      9,
      15,
      "",
    ],
    [
      "2026-07-03",
      "AM",
      "GARCIA, MARIA",
      "Salon",
      8,
      4,
      7,
      8,
      11,
      18,
      "",
    ],
    [
      "2026-07-04",
      "PM",
      "  garcia,   maria  ",
      "Salon",
      5,
      2,
      4,
      5,
      6,
      10,
      "",
    ],
    ["TOTAL", "", "", "", 34.5, "", "", "", "", 83.5, ""],
    [
      "Fecha",
      "Turno",
      "Empleado",
      "Área Día",
      "Horas",
      "Tip Café Manual",
      "Tip Turno",
      "Total Horas Turno",
      "Tip Proporcional Calc",
      "Tips Total",
      "Notas",
    ],
    [
      "2026-07-05",
      "AM",
      "RODRIGUEZ, PEDRO",
      "Bar",
      "#NAME?",
      0,
      5,
      0,
      0,
      5,
      "formula error",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Carga Diaria");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

async function main() {
  const buffer = buildSampleWorkbook();
  const profile = extractPayrollFromExcelBuffer(buffer, {
    titleHint: "Carga Diaria Julio",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });

  if (!profile) {
    console.error("FAIL: profile is null");
    process.exit(1);
  }

  const data = profile.structuredData;
  console.log("employee_count:", data.employee_count);
  console.log("total_payroll:", data.total_payroll);
  console.log("total_hours:", data.total_hours);
  console.log("total_tips:", data.total_tips);
  console.log("employees:", JSON.stringify(data.employees, null, 2));
  console.log("summary:", profile.summary);

  if (data.employee_count !== 3) {
    console.error(`FAIL: expected 3 employees, got ${data.employee_count}`);
    process.exit(1);
  }

  const adalberto = (data.employees as Array<{ name: string; shifts_count: number; total_hours: number | null }>).find(
    (e) => e.name.includes("ADALBERTO"),
  );
  if (!adalberto || adalberto.shifts_count !== 2 || adalberto.total_hours !== 14) {
    console.error("FAIL: ADALBERTO shifts/hours", adalberto);
    process.exit(1);
  }

  if (data.total_payroll != null) {
    console.error("FAIL: total_payroll should be null for hours/tips sheet");
    process.exit(1);
  }

  const countIntent = detectQueryIntent("¿Cuántos empleados aparecen?");
  const hoursIntent = detectQueryIntent("¿Quién trabajó más horas?");
  console.log("intents:", countIntent, hoursIntent);

  const mockAnswerCount = profile.summary;
  const topEmployee = (data.employees as Array<{ name: string; total_hours: number | null }>)
    .slice()
    .sort((a, b) => (b.total_hours ?? 0) - (a.total_hours ?? 0))[0];
  console.log("expected top hours:", topEmployee?.name, topEmployee?.total_hours);

  console.log("PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
