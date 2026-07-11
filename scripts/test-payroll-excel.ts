import {
  computeClockPairHours,
  extractPayrollFromExcelBuffer,
  normalizeWorkedHoursValue,
} from "@/lib/intelligence/extractors/payroll-excel";
import XLSX from "xlsx";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildDailySheetRows(
  rows: unknown[][],
  sheetName = "Carga Diaria",
): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function buildWorkbookWithSheets(
  sheets: Array<{ name: string; rows: unknown[][] }>,
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheetDef of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(sheetDef.rows);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetDef.name);
  }
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

const HEADERS = [
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
];

function runHourHelperTests() {
  assert(normalizeWorkedHoursValue(8.5) === 8.5, "decimal hours stay 8.5");
  assert(
    Math.abs((normalizeWorkedHoursValue(0.354166) ?? 0) - 8.5) < 0.01,
    "excel duration converts to ~8.5",
  );
  assert(
    computeClockPairHours("08:00", "17:00", 1) === 8,
    "clock pair with 1-hour break equals 8",
  );
}

function runRepeatedEmployeeTest() {
  const buffer = buildDailySheetRows([
    HEADERS,
    ["2026-07-01", "AM", "GARCIA, MARIA", "Salon", 8, 0, 0, 8, 0, 0, ""],
    ["2026-07-02", "PM", "GARCIA, MARIA", "Salon", 6, 0, 0, 6, 0, 0, ""],
  ]);
  const profile = extractPayrollFromExcelBuffer(buffer, {
    titleHint: "test",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });
  assert(profile?.structuredData.employee_count === 1, "one unique employee");
  assert(profile?.structuredData.total_hours === 14, "hours summed across days");
}

function runDuplicateShiftTest() {
  const duplicateRow = [
    "2026-07-01",
    "AM",
    "GARCIA, MARIA",
    "Salon",
    8,
    0,
    0,
    8,
    0,
    0,
    "",
  ];
  const buffer = buildDailySheetRows([HEADERS, duplicateRow, duplicateRow]);
  const profile = extractPayrollFromExcelBuffer(buffer, {
    titleHint: "test",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });
  const diagnostics = profile?.structuredData.extraction_diagnostics as
    | { rows_deduplicated?: number; total_hours?: number }
    | undefined;
  assert((diagnostics?.rows_deduplicated ?? 0) >= 1, "duplicate shift skipped");
  assert(profile?.structuredData.total_hours === 8, "duplicate row not double-counted");
}

function runDetailVsWeeklyTotalTest() {
  const buffer = buildDailySheetRows([
    HEADERS,
    ["2026-07-01", "AM", "GARCIA, MARIA", "Salon", 8, 0, 0, 8, 0, 0, ""],
    ["2026-07-02", "PM", "GARCIA, MARIA", "Salon", 6, 0, 0, 6, 0, 0, ""],
    ["", "", "GARCIA, MARIA", "Salon", 14, 0, 0, 14, 0, 0, "weekly total row"],
  ]);
  const profile = extractPayrollFromExcelBuffer(buffer, {
    titleHint: "test",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });
  assert(
    profile?.structuredData.total_hours === 14,
    "weekly total row without date is excluded",
  );
}

function runMultipleSheetsDuplicateTest() {
  const row = [
    "2026-07-01",
    "AM",
    "GARCIA, MARIA",
    "Salon",
    8,
    0,
    0,
    8,
    0,
    0,
    "",
  ];
  const buffer = buildWorkbookWithSheets([
    { name: "Carga Diaria", rows: [HEADERS, row] },
    { name: "Resumen", rows: [HEADERS, row] },
  ]);
  const profile = extractPayrollFromExcelBuffer(buffer, {
    titleHint: "test",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });
  const diagnostics = profile?.structuredData.extraction_diagnostics as
    | { sheets_processed?: string[]; total_hours?: number }
    | undefined;
  assert(
    (diagnostics?.sheets_processed ?? []).length === 1,
    "summary duplicate sheet skipped when detail exists",
  );
  assert(profile?.structuredData.total_hours === 8, "hours not doubled across sheets");
}

function runTotalsExcludedTest() {
  const buffer = buildDailySheetRows([
    HEADERS,
    ["2026-07-01", "AM", "GARCIA, MARIA", "Salon", 8, 0, 0, 8, 0, 0, ""],
    ["TOTAL", "", "", "", 8, "", "", "", "", 0, ""],
  ]);
  const profile = extractPayrollFromExcelBuffer(buffer, {
    titleHint: "test",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });
  assert(profile?.structuredData.total_hours === 8, "TOTAL row excluded");
}

function runSampleWorkbookTest() {
  const buffer = buildDailySheetRows([
    HEADERS,
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
  ]);

  const profile = extractPayrollFromExcelBuffer(buffer, {
    titleHint: "Carga Diaria Julio",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });

  assert(profile?.structuredData.employee_count === 3, "sample workbook employees");
  assert(profile?.structuredData.total_hours === 34.5, "sample workbook hours");
  assert(
    profile?.structuredData.total_payroll == null,
    "sample workbook has no payroll amount",
  );
}

function main() {
  runHourHelperTests();
  runRepeatedEmployeeTest();
  runDuplicateShiftTest();
  runDetailVsWeeklyTotalTest();
  runMultipleSheetsDuplicateTest();
  runTotalsExcludedTest();
  runSampleWorkbookTest();
  console.log("ALL PAYROLL HOUR TESTS PASS");
}

main();
