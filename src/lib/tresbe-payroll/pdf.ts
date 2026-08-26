import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type {
  TresbePayroll,
  TresbePayrollDailyEntry,
  TresbePayrollEntry,
  TresbePayrollShiftPool,
  TresbeShift,
} from "@/services/tresbe-payroll";
import { getServiceCheckPayAmount } from "@/lib/tresbe-payroll/calculations";
import {
  CALLE_CERRA_AREA,
  computeAreaHoursTips,
  computeAreaPay,
  computeTresbeAreaPercentages,
} from "@/lib/tresbe-payroll/area-report";

const WIDTH = 792;
const HEIGHT = 612;
const MARGIN = 36;
const NAVY = rgb(0.055, 0.12, 0.2);
const RED = rgb(0.72, 0.12, 0.14);
const MUTED = rgb(0.38, 0.42, 0.47);
const BORDER = rgb(0.82, 0.84, 0.87);
const ALT = rgb(0.965, 0.97, 0.975);

const printable = (value: string) =>
  value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^ -ÿ]/g, "?");

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));

const number = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

const date = (value: string) =>
  new Intl.DateTimeFormat("es-PR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));

const pct = (value: number) => `${value.toFixed(2)}%`;

export function hasTresbePayrollValue(entry: TresbePayrollEntry) {
  return [
    entry.system_pay,
    entry.tips,
    entry.service_check_amount,
    entry.other_adjustments,
    entry.employee_total,
  ].some((value) => Number(value) !== 0);
}

function fit(value: string, font: PDFFont, size: number, width: number) {
  const clean = printable(value);
  if (font.widthOfTextAtSize(clean, size) <= width) return clean;
  let short = clean;
  while (
    short.length > 1 &&
    font.widthOfTextAtSize(`${short}...`, size) > width
  )
    short = short.slice(0, -1);
  return `${short.trim()}...`;
}

function paymentTypeLabel(entry: TresbePayrollEntry) {
  const hasSystem = Number(entry.system_pay) > 0;
  const hasService = Number(entry.service_check_amount) > 0;
  if (hasSystem && hasService) return "Sistema + Servicios";
  if (hasService) return "Servicios";
  if (hasSystem) return "Sistema";
  return "-";
}

function drawHeader(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  payroll: TresbePayroll,
  companyName: string,
  continuation: boolean,
) {
  page.drawRectangle({
    x: 0,
    y: HEIGHT - 72,
    width: WIDTH,
    height: 72,
    color: NAVY,
  });
  page.drawRectangle({
    x: 0,
    y: HEIGHT - 76,
    width: WIDTH,
    height: 4,
    color: RED,
  });
  page.drawText("SINEXIA", {
    x: MARGIN,
    y: HEIGHT - 43,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    continuation ? "NOMINA TRESBE - CONTINUACION" : "NOMINA SEMANAL TRESBE",
    {
      x: 500,
      y: HEIGHT - 40,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    },
  );
  page.drawText(`Empresa: ${printable(companyName)}`, {
    x: MARGIN,
    y: HEIGHT - 101,
    size: 9,
    font: regular,
    color: MUTED,
  });
  page.drawText(
    `Periodo: ${date(payroll.week_start)} al ${date(payroll.week_end)}`,
    { x: 245, y: HEIGHT - 101, size: 9, font: regular, color: MUTED },
  );
  const statuses: Record<TresbePayroll["status"], string> = {
    draft: "Borrador",
    calculated: "Calculada",
    sent: "Enviada",
    viewed: "Vista por cliente",
    corrected: "Corregida",
    cancelled: "Cancelada",
  };
  page.drawText(`Estado: ${statuses[payroll.status]}`, {
    x: 610,
    y: HEIGHT - 101,
    size: 8,
    font: bold,
    color: NAVY,
  });
  if (payroll.sent_at)
    page.drawText(
      `Enviada: ${new Date(payroll.sent_at).toLocaleDateString("es-PR", { timeZone: "UTC" })}`,
      { x: 610, y: HEIGHT - 114, size: 7, font: regular, color: MUTED },
    );
}

type Column = {
  label: string;
  width: number;
  value: (entry: TresbePayrollEntry) => string;
};

function drawTableHeader(
  page: PDFPage,
  bold: PDFFont,
  y: number,
  columns: Column[],
) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 19,
    width: WIDTH - MARGIN * 2,
    height: 19,
    color: NAVY,
  });
  let x = MARGIN;
  for (const column of columns) {
    page.drawText(column.label, {
      x: x + 4,
      y: y - 13,
      size: 7.2,
      font: bold,
      color: rgb(1, 1, 1),
    });
    x += column.width;
  }
  return y - 19;
}

function drawCompactTableRow(
  page: PDFPage,
  regular: PDFFont,
  y: number,
  columns: Column[],
  entry: TresbePayrollEntry,
  alternate: boolean,
  rowHeight: number,
) {
  const fontSize = rowHeight <= 9 ? 5.8 : rowHeight <= 11 ? 6.3 : 7;
  if (alternate)
    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: WIDTH - MARGIN * 2,
      height: rowHeight,
      color: ALT,
    });
  let x = MARGIN;
  for (const column of columns) {
    page.drawText(
      fit(column.value(entry), regular, fontSize, column.width - 6),
      {
        x: x + 3,
        y: y - rowHeight + Math.max(2, (rowHeight - fontSize) / 2),
        size: fontSize,
        font: regular,
        color: NAVY,
      },
    );
    x += column.width;
  }
  page.drawLine({
    start: { x: MARGIN, y: y - rowHeight },
    end: { x: WIDTH - MARGIN, y: y - rowHeight },
    thickness: 0.25,
    color: BORDER,
  });
  return y - rowHeight;
}

type AnalysisColumn = { label: string; width: number; align: "left" | "right" };
type AnalysisRow = { cells: string[]; bold?: boolean; redCells?: number[] };

function drawAnalysisTable(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  yStart: number,
  columns: AnalysisColumn[],
  rows: AnalysisRow[],
) {
  const rowHeight = 18;
  let y = yStart;
  page.drawRectangle({
    x: MARGIN,
    y: y - rowHeight,
    width: WIDTH - MARGIN * 2,
    height: rowHeight,
    color: NAVY,
  });
  let x = MARGIN;
  for (const column of columns) {
    if (column.label) {
      const w = bold.widthOfTextAtSize(column.label, 7.5);
      const tx =
        column.align === "right" ? x + column.width - w - 6 : x + 6;
      page.drawText(column.label, {
        x: tx,
        y: y - 12.5,
        size: 7.5,
        font: bold,
        color: rgb(1, 1, 1),
      });
    }
    x += column.width;
  }
  y -= rowHeight;

  rows.forEach((row, rowIndex) => {
    if (rowIndex % 2 === 1)
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: WIDTH - MARGIN * 2,
        height: rowHeight,
        color: ALT,
      });
    let cx = MARGIN;
    row.cells.forEach((cell, cellIndex) => {
      const font = row.bold ? bold : regular;
      const color = row.redCells?.includes(cellIndex) ? RED : NAVY;
      const w = font.widthOfTextAtSize(cell, 8);
      const column = columns[cellIndex];
      const tx = column.align === "right" ? cx + column.width - w - 6 : cx + 6;
      page.drawText(cell, {
        x: tx,
        y: y - rowHeight + 5.5,
        size: 8,
        font,
        color,
      });
      cx += column.width;
    });
    y -= rowHeight;
  });

  page.drawRectangle({
    x: MARGIN,
    y,
    width: WIDTH - MARGIN * 2,
    height: yStart - y,
    borderColor: BORDER,
    borderWidth: 0.5,
  });
  return y;
}

const BANNER_HEIGHT = 86;

function drawCenteredBanner(page: PDFPage, bold: PDFFont, subtitle: string) {
  page.drawRectangle({
    x: 0,
    y: HEIGHT - BANNER_HEIGHT,
    width: WIDTH,
    height: BANNER_HEIGHT,
    color: NAVY,
  });
  page.drawRectangle({
    x: 0,
    y: HEIGHT - BANNER_HEIGHT - 4,
    width: WIDTH,
    height: 4,
    color: RED,
  });
  const title = "SINEXIA";
  page.drawText(title, {
    x: (WIDTH - bold.widthOfTextAtSize(title, 20)) / 2,
    y: HEIGHT - 40,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(subtitle, {
    x: (WIDTH - bold.widthOfTextAtSize(subtitle, 10)) / 2,
    y: HEIGHT - 62,
    size: 10,
    font: bold,
    color: rgb(1, 1, 1),
  });
}

// -- "% de nomina" page: computed live from area_snapshot / e.area, never
// from a hand-typed record. See src/lib/tresbe-payroll/area-report.ts for
// the formulas and why weekly pay groups by tresbe_employees.area while
// hours/tips group by the daily area_snapshot.
function drawTresbeAreaPercentagesPage(
  pdf: PDFDocument,
  bold: PDFFont,
  regular: PDFFont,
  payroll: TresbePayroll,
  companyName: string,
  entries: TresbePayrollEntry[],
  employeeAreas: { id: string; area: string }[],
) {
  const areaPay = computeAreaPay(entries, employeeAreas);
  const percentages = computeTresbeAreaPercentages(payroll, areaPay);
  const salesTresbe = Number(payroll.sales_tresbe);
  const salesCalleCerra = Number(payroll.sales_cafe_con_ce_calle_cerra);

  const page = pdf.addPage([WIDTH, HEIGHT]);
  drawCenteredBanner(page, bold, "NOMINA SEMANAL TRESBE -- % DE NOMINA");

  let y = HEIGHT - BANNER_HEIGHT - 4 - 26;
  page.drawText(`Empresa: ${printable(companyName)}`, {
    x: MARGIN,
    y,
    size: 9,
    font: regular,
    color: MUTED,
  });
  page.drawText(
    `Periodo: ${date(payroll.week_start)} al ${date(payroll.week_end)}`,
    { x: 200, y, size: 9, font: regular, color: MUTED },
  );
  y -= 24;

  const salesCols = [
    { label: "Venta Tresbe", value: money(salesTresbe) },
    { label: "Venta Cafe con Ce Calle Cerra", value: money(salesCalleCerra) },
  ];
  const salesColWidth = (WIDTH - MARGIN * 2) / salesCols.length;
  const salesHeaderH = 20;
  const salesValueH = 28;
  page.drawRectangle({
    x: MARGIN,
    y: y - salesHeaderH,
    width: WIDTH - MARGIN * 2,
    height: salesHeaderH,
    color: ALT,
  });
  salesCols.forEach((col, i) => {
    const cx = MARGIN + i * salesColWidth;
    const labelW = bold.widthOfTextAtSize(col.label, 8);
    page.drawText(col.label, {
      x: cx + (salesColWidth - labelW) / 2,
      y: y - 14,
      size: 8,
      font: bold,
      color: NAVY,
    });
    const valW = bold.widthOfTextAtSize(col.value, 11);
    page.drawText(col.value, {
      x: cx + (salesColWidth - valW) / 2,
      y: y - salesHeaderH - 18,
      size: 11,
      font: bold,
      color: NAVY,
    });
    if (i > 0)
      page.drawLine({
        start: { x: cx, y },
        end: { x: cx, y: y - salesHeaderH - salesValueH },
        thickness: 0.5,
        color: BORDER,
      });
  });
  page.drawRectangle({
    x: MARGIN,
    y: y - salesHeaderH - salesValueH,
    width: WIDTH - MARGIN * 2,
    height: salesHeaderH + salesValueH,
    borderColor: BORDER,
    borderWidth: 0.5,
  });
  y -= salesHeaderH + salesValueH + 22;

  page.drawText(
    `% de nomina TRESBE (sin Calle Cerra, sobre venta Tresbe): ${
      percentages.nominaTresbePct == null ? "—" : pct(percentages.nominaTresbePct)
    }`,
    { x: MARGIN, y, size: 10.5, font: bold, color: RED },
  );
  y -= 12;
  page.drawText(
    `Pagado sin propina (sin Calle Cerra): ${money(percentages.nonCalleCerraPaidNoTip)}`,
    { x: MARGIN, y, size: 8, font: regular, color: MUTED },
  );
  y -= 26;

  page.drawText("Incidencia de cada area sobre venta", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: NAVY,
  });
  y -= 14;
  const incidenciaCols: AnalysisColumn[] = [
    { label: "Area", width: 260, align: "left" },
    { label: "Pagado (sin propina)", width: 230, align: "right" },
    { label: "% de venta", width: 230, align: "right" },
  ];
  const incidenciaRows: AnalysisRow[] = percentages.incidencia.map((row) => ({
    cells: [
      row.area === CALLE_CERRA_AREA ? "Cafe con Ce Calle Cerra" : row.area,
      money(areaPay.find((a) => a.area === row.area)?.paidNoTip ?? 0),
      row.pct == null ? "—" : pct(row.pct),
    ],
    bold: row.area === CALLE_CERRA_AREA,
    redCells: [2],
  }));
  y = drawAnalysisTable(page, bold, regular, y, incidenciaCols, incidenciaRows);
  y -= 12;
  page.drawText(
    "Nota: Cafe con Ce Calle Cerra se mide sobre SU PROPIA venta (Venta Cafe con Ce Calle Cerra), el resto sobre venta Tresbe.",
    { x: MARGIN, y, size: 7, font: regular, color: MUTED },
  );
  y -= 24;

  page.drawText(
    `% de nomina de Cafe con Ce Calle Cerra: ${
      percentages.calleCerraNominaPct == null
        ? "— (sin venta cargada)"
        : pct(percentages.calleCerraNominaPct)
    }`,
    { x: MARGIN, y, size: 9.5, font: bold, color: NAVY },
  );
  y -= 26;

  page.drawText("Calculo final (peor caso, sin propina)", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: NAVY,
  });
  y -= 14;
  const worstCaseCols: AnalysisColumn[] = [
    { label: "", width: 430, align: "left" },
    { label: "", width: 290, align: "right" },
  ];
  const worstCaseRows: AnalysisRow[] = [
    {
      cells: [
        "Todas las areas pagadas, sin propina (incl. Calle Cerra)",
        money(percentages.allAreasPaidNoTip),
      ],
    },
    {
      cells: ["Venta Tresbe (sin sumar Calle Cerra)", money(salesTresbe)],
    },
    {
      cells: [
        "% peor caso",
        percentages.worstCasePct == null ? "—" : pct(percentages.worstCasePct),
      ],
      bold: true,
      redCells: [1],
    },
  ];
  y = drawAnalysisTable(page, bold, regular, y, worstCaseCols, worstCaseRows);

  return page;
}

const DAY_LABEL = new Intl.DateTimeFormat("es-PR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function weekDatesList(weekStart: string) {
  const dates: string[] = [];
  const base = new Date(`${weekStart}T12:00:00Z`);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

type DailyRow = {
  name: string;
  area: string;
  hours: number;
  tip: number;
  isProportional: boolean;
};

// Compact layout: AM and PM side by side (half page width each) instead of
// stacked, so a full week fits in one or two pages instead of three-plus.
const DAILY_ROW_HEIGHT = 9;
const DAILY_HEADER_HEIGHT = 11;
const DAILY_BOTTOM_LIMIT = 46;
const DAILY_GAP = 16;
const DAILY_HALF_WIDTH = (WIDTH - MARGIN * 2 - DAILY_GAP) / 2;
const DAILY_COLUMNS = [
  { label: "Empleado", width: 148 },
  { label: "Area", width: 58 },
  { label: "Horas", width: 45 },
  { label: "Propina", width: 85 },
];

function drawDailyHalfBlock(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  x: number,
  yStart: number,
  shift: TresbeShift,
  poolAmount: number,
  rows: DailyRow[],
) {
  let y = yStart;
  const label = `Turno ${shift}${poolAmount > 0 ? ` -- Pote: ${money(poolAmount)}` : ""}`;
  page.drawText(label, { x, y, size: 7, font: bold, color: NAVY });
  y -= DAILY_HEADER_HEIGHT;

  page.drawRectangle({
    x,
    y: y - DAILY_HEADER_HEIGHT,
    width: DAILY_HALF_WIDTH,
    height: DAILY_HEADER_HEIGHT,
    color: rgb(0.9, 0.92, 0.94),
  });
  let cx = x;
  for (const column of DAILY_COLUMNS) {
    page.drawText(column.label, {
      x: cx + 3,
      y: y - DAILY_HEADER_HEIGHT + 3,
      size: 5.5,
      font: bold,
      color: NAVY,
    });
    cx += column.width;
  }
  y -= DAILY_HEADER_HEIGHT;

  rows.forEach((row) => {
    const cells = [
      row.name,
      row.area,
      number(row.hours),
      `${money(row.tip)}${row.isProportional ? " (p)" : ""}`,
    ];
    let rx = x;
    cells.forEach((cell, index) => {
      page.drawText(fit(cell, regular, 5.2, DAILY_COLUMNS[index].width - 4), {
        x: rx + 3,
        y: y - DAILY_ROW_HEIGHT + 2.5,
        size: 5.2,
        font: regular,
        color: NAVY,
      });
      rx += DAILY_COLUMNS[index].width;
    });
    page.drawLine({
      start: { x, y: y - DAILY_ROW_HEIGHT },
      end: { x: x + DAILY_HALF_WIDTH, y: y - DAILY_ROW_HEIGHT },
      thickness: 0.2,
      color: BORDER,
    });
    y -= DAILY_ROW_HEIGHT;
  });

  return y;
}

// BOH and Seguridad never split tips, so their $0.00 rows in this
// per-shift breakdown were just noise -- this only hides them from this
// one table; pay/hours for those areas are untouched everywhere else.
const TIP_PARTICIPATING_AREAS = new Set(["FOH", "CAFE CON CE", CALLE_CERRA_AREA]);

function drawTresbeDailyEntriesPages(
  pdf: PDFDocument,
  bold: PDFFont,
  regular: PDFFont,
  payroll: TresbePayroll,
  companyName: string,
  employees: { id: string; display_name: string }[],
  allDailyEntries: TresbePayrollDailyEntry[],
  shiftPools: TresbePayrollShiftPool[],
) {
  const dailyEntries = allDailyEntries.filter((entry) =>
    TIP_PARTICIPATING_AREAS.has(entry.area_snapshot),
  );
  const employeeNames = new Map(employees.map((e) => [e.id, e.display_name]));
  const poolByKey = new Map(
    shiftPools.map((pool) => [`${pool.work_date}|${pool.shift}`, pool]),
  );
  const entriesByKey = new Map<string, TresbePayrollDailyEntry[]>();
  for (const entry of dailyEntries) {
    const key = `${entry.work_date}|${entry.shift}`;
    const list = entriesByKey.get(key) ?? [];
    list.push(entry);
    entriesByKey.set(key, list);
  }

  const shifts: TresbeShift[] = ["AM", "PM"];
  const dates = weekDatesList(payroll.week_start).filter((workDate) =>
    shifts.some(
      (shift) => (entriesByKey.get(`${workDate}|${shift}`) ?? []).length > 0,
    ),
  );
  if (!dates.length) return;

  let page = pdf.addPage([WIDTH, HEIGHT]);
  drawCenteredBanner(page, bold, "NOMINA SEMANAL TRESBE -- CARGA DIARIA");
  let y = HEIGHT - BANNER_HEIGHT - 4 - 20;
  page.drawText(`Empresa: ${printable(companyName)}`, {
    x: MARGIN,
    y,
    size: 8,
    font: regular,
    color: MUTED,
  });
  page.drawText(
    `Periodo: ${date(payroll.week_start)} al ${date(payroll.week_end)}`,
    { x: 200, y, size: 8, font: regular, color: MUTED },
  );
  y -= 18;

  const newContinuationPage = () => {
    page = pdf.addPage([WIDTH, HEIGHT]);
    drawHeader(page, bold, regular, payroll, companyName, true);
    y = HEIGHT - 108;
  };

  const toRows = (dayEntries: TresbePayrollDailyEntry[]): DailyRow[] =>
    dayEntries.map((entry) => ({
      name: employeeNames.get(entry.employee_id) ?? "(empleado eliminado)",
      area: entry.area_snapshot,
      hours: Number(entry.hours),
      tip: entry.receives_proportional_tips_snapshot
        ? Number(entry.tip_proportional)
        : Number(entry.tip_cafe_manual),
      isProportional: entry.receives_proportional_tips_snapshot,
    }));

  for (const workDate of dates) {
    const amEntries = entriesByKey.get(`${workDate}|AM`) ?? [];
    const pmEntries = entriesByKey.get(`${workDate}|PM`) ?? [];
    if (!amEntries.length && !pmEntries.length) continue;

    const maxRows = Math.max(amEntries.length, pmEntries.length);
    const blockHeight =
      11 + DAILY_HEADER_HEIGHT * 2 + maxRows * DAILY_ROW_HEIGHT + 6;
    if (y - blockHeight < DAILY_BOTTOM_LIMIT) newContinuationPage();

    const label = capitalizeFirst(
      DAY_LABEL.format(new Date(`${workDate}T12:00:00Z`)),
    );
    page.drawText(printable(label), {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: NAVY,
    });
    y -= 11;

    const amPool = poolByKey.get(`${workDate}|AM`);
    const pmPool = poolByKey.get(`${workDate}|PM`);
    const rightX = MARGIN + DAILY_HALF_WIDTH + DAILY_GAP;
    const yAfterAm = amEntries.length
      ? drawDailyHalfBlock(
          page,
          bold,
          regular,
          MARGIN,
          y,
          "AM",
          Number(amPool?.tip_pool_amount ?? 0),
          toRows(amEntries),
        )
      : y;
    const yAfterPm = pmEntries.length
      ? drawDailyHalfBlock(
          page,
          bold,
          regular,
          rightX,
          y,
          "PM",
          Number(pmPool?.tip_pool_amount ?? 0),
          toRows(pmEntries),
        )
      : y;
    y = Math.min(yAfterAm, yAfterPm) - 6;
  }
}

export async function buildTresbePayrollPdf(params: {
  companyName: string;
  payroll: TresbePayroll;
  entries: TresbePayrollEntry[];
  dailyEntries?: TresbePayrollDailyEntry[];
  shiftPools?: TresbePayrollShiftPool[];
  employees?: { id: string; display_name: string; area: string }[];
}) {
  const entries = params.entries.filter(hasTresbePayrollValue);
  const dailyEntries = params.dailyEntries ?? [];
  const employees = params.employees ?? [];
  // Hours/system/adjustments/grand come from the saved payroll header,
  // recalculated by PostgreSQL before preview/send. Servicios is computed
  // here from each entry's real check payout (getServiceCheckPayAmount),
  // which folds tips into the single check for "servicios completos"
  // employees -- matching what actually goes out the door per check.
  const servicePayoutTotal = entries.reduce((sum, e) => {
    if (Number(e.service_check_amount) <= 0) return sum;
    return (
      sum +
      getServiceCheckPayAmount(e.payroll_rule_snapshot, {
        serviceCheckAmount: Number(e.service_check_amount),
        employeeTotal: Number(e.employee_total),
      })
    );
  }, 0);

  const areaHoursTips = computeAreaHoursTips(dailyEntries);
  const tipsTresbe = round2(
    areaHoursTips
      .filter((a) => a.area === "BOH" || a.area === "FOH")
      .reduce((sum, a) => sum + a.tips, 0),
  );
  const tipsCafeConCe =
    areaHoursTips.find((a) => a.area === "CAFE CON CE")?.tips ?? 0;
  const tipsCalleCerra =
    areaHoursTips.find((a) => a.area === CALLE_CERRA_AREA)?.tips ?? 0;

  const visibleTotals = {
    hours: Number(params.payroll.total_weekly_hours),
    system: Number(params.payroll.total_system_pay),
    services: servicePayoutTotal,
    adjustments: Number(params.payroll.total_adjustments),
    grand: Number(params.payroll.grand_total),
  };
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Nomina Tresbe ${params.payroll.week_start}`);
  pdf.setAuthor("Sinexia OS");
  pdf.setSubject("Resumen semanal de nomina Tresbe");

  const page = pdf.addPage([WIDTH, HEIGHT]);
  drawHeader(page, bold, regular, params.payroll, params.companyName, false);
  let y = HEIGHT - 126;

  const salesTresbe = Number(params.payroll.sales_tresbe);
  const salesCafeConCe = Number(params.payroll.sales_cafe_con_ce);
  const salesCalleCerra = Number(
    params.payroll.sales_cafe_con_ce_calle_cerra,
  );
  const salesTotal = salesTresbe + salesCafeConCe + salesCalleCerra;
  if (salesTotal > 0) {
    page.drawText(
      `VENTA DE LA SEMANA -- Tresbe + Cafe con Ce: ${money(
        salesTresbe + salesCafeConCe,
      )}   |   Cafe con Ce Calle Cerra: ${money(salesCalleCerra)}   |   Total: ${money(salesTotal)}`,
      { x: MARGIN, y, size: 8, font: bold, color: NAVY },
    );
    y -= 15;
  }

  page.drawText("RESUMEN DE PAGOS DE LA SEMANA", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: NAVY,
  });
  y -= 16;
  const summary = [
    ["Empleados", String(entries.length)],
    ["Horas", number(visibleTotals.hours)],
    ["Sistema (+ impuestos)", money(visibleTotals.system)],
    ["Tips Tresbe", money(tipsTresbe)],
    ["Tips Cafe con Ce", money(tipsCafeConCe)],
    ["Tips Calle Cerra", money(tipsCalleCerra)],
    ["Servicios", money(visibleTotals.services)],
    ["Ajustes", money(visibleTotals.adjustments)],
    ["TOTAL A PAGAR", money(visibleTotals.grand)],
  ];
  summary.forEach(([label, value], index) => {
    const cellWidth = (WIDTH - MARGIN * 2) / summary.length;
    const x = MARGIN + index * cellWidth;
    page.drawText(label, {
      x,
      y,
      size: 6.2,
      font: bold,
      color: MUTED,
    });
    page.drawText(value, {
      x,
      y: y - 13,
      size: index === summary.length - 1 ? 10 : 8,
      font: bold,
      color: index === summary.length - 1 ? RED : NAVY,
    });
  });
  y -= 42;

  const areaByEmployeeId = new Map(employees.map((e) => [e.id, e.area]));
  const detailColumns: Column[] = [
    {
      label: "Empleado (area)",
      width: 260,
      value: (e) => {
        const area = areaByEmployeeId.get(e.employee_id) ?? e.area_snapshot;
        return `${e.employee_name_snapshot} (${area})`;
      },
    },
    { label: "Tipo de pago", width: 130, value: (e) => paymentTypeLabel(e) },
    { label: "Horas", width: 60, value: (e) => number(e.total_weekly_hours) },
    { label: "Tips", width: 90, value: (e) => money(e.tips) },
    {
      label: "Total",
      width: 100,
      value: (e) => money(e.employee_total),
    },
  ];
  page.drawText("EMPLEADOS CON PAGO", {
    x: MARGIN,
    y,
    size: 9,
    font: bold,
    color: NAVY,
  });
  y -= 8;
  y = drawTableHeader(page, bold, y, detailColumns);
  const rowHeight = Math.min(
    16,
    Math.max(8, (y - 58) / Math.max(entries.length, 1)),
  );
  entries.forEach((entry, index) => {
    y = drawCompactTableRow(
      page,
      regular,
      y,
      detailColumns,
      entry,
      index % 2 === 1,
      rowHeight,
    );
  });

  if (params.payroll.client_note) {
    page.drawText("Mensaje al cliente:", {
      x: MARGIN,
      y: 38,
      size: 7,
      font: bold,
      color: NAVY,
    });
    page.drawText(
      fit(params.payroll.client_note, regular, 7, WIDTH - MARGIN * 2 - 90),
      { x: MARGIN + 90, y: 38, size: 7, font: regular, color: MUTED },
    );
  }

  if (dailyEntries.length) {
    drawTresbeDailyEntriesPages(
      pdf,
      bold,
      regular,
      params.payroll,
      params.companyName,
      employees,
      dailyEntries,
      params.shiftPools ?? [],
    );
  }

  if (salesTresbe > 0 || salesCalleCerra > 0) {
    drawTresbeAreaPercentagesPage(
      pdf,
      bold,
      regular,
      params.payroll,
      params.companyName,
      entries,
      employees,
    );
  }

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText(
      `Sinexia OS - Tresbe - Pagina ${index + 1} de ${pages.length}`,
      { x: MARGIN, y: 20, size: 7.5, font: regular, color: MUTED },
    );
    current.drawText(
      "Preparacion administrativa de nomina; no es software contable.",
      { x: 480, y: 20, size: 7, font: regular, color: MUTED },
    );
  });
  return pdf.save();
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
