import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type {
  TresbePayroll,
  TresbePayrollEntry,
} from "@/services/tresbe-payroll";
import { getServiceCheckPayAmount } from "@/lib/tresbe-payroll/calculations";
import type { TresbePayrollAnalysisJson } from "@/lib/tresbe-payroll/analysis";

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
    .replace(/[^\u0020-\u00ff]/g, "?");

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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = printable(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function wrapTextWithFirstLineOffset(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  firstLineOffset: number,
) {
  const words = printable(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let firstLine = true;
  for (const word of words) {
    const available = firstLine ? maxWidth - firstLineOffset : maxWidth;
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= available) {
      current = candidate;
    } else {
      lines.push(current);
      firstLine = false;
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

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

function drawTresbeAnalysisPage(
  pdf: PDFDocument,
  bold: PDFFont,
  regular: PDFFont,
  payroll: TresbePayroll,
  companyName: string,
  analysis: TresbePayrollAnalysisJson,
) {
  const page = pdf.addPage([WIDTH, HEIGHT]);

  const bannerHeight = 86;
  page.drawRectangle({
    x: 0,
    y: HEIGHT - bannerHeight,
    width: WIDTH,
    height: bannerHeight,
    color: NAVY,
  });
  page.drawRectangle({
    x: 0,
    y: HEIGHT - bannerHeight - 4,
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
  const subtitle = "NOMINA SEMANAL TRESBE -- ANALISIS DE % SOBRE VENTA";
  page.drawText(subtitle, {
    x: (WIDTH - bold.widthOfTextAtSize(subtitle, 10)) / 2,
    y: HEIGHT - 62,
    size: 10,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = HEIGHT - bannerHeight - 4 - 26;
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

  // Sales summary strip
  const salesCols = [
    { label: "Venta TRESBE + Café con Ce", value: money(analysis.venta.tresbe_cafe_con_ce) },
    { label: "Venta Café con Ce Calle Cerra", value: money(analysis.venta.cafe_con_ce_calle_cerra) },
    { label: "Venta Total", value: money(analysis.venta.total) },
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

  // Section 1: adjustments
  page.drawText("1. Ajuste del total de nómina", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: NAVY,
  });
  y -= 14;
  const table1Cols: AnalysisColumn[] = [
    { label: "Concepto", width: 430, align: "left" },
    { label: "Importe", width: 130, align: "right" },
    { label: "Subtotal", width: 160, align: "right" },
  ];
  const table1Rows: AnalysisRow[] = [
    {
      cells: [
        analysis.ajuste_total_nomina.total_nomina_sinexia.detalle,
        "",
        money(analysis.ajuste_total_nomina.total_nomina_sinexia.subtotal),
      ],
    },
    ...analysis.ajuste_total_nomina.deducciones.map((item, index, all) => ({
      cells: [item.concepto, money(item.importe), money(item.subtotal)],
      bold: index === all.length - 1,
    })),
  ];
  y = drawAnalysisTable(page, bold, regular, y, table1Cols, table1Rows);
  y -= 14;
  const resultLine = `Nómina sin propina de la semana: ${money(analysis.ajuste_total_nomina.nomina_sin_propina_semana)}`;
  page.drawText(resultLine, {
    x: MARGIN,
    y,
    size: 9,
    font: bold,
    color: NAVY,
  });
  y -= 22;

  // Section 2: % sobre venta combinada
  page.drawText("2. % sobre venta combinada (ambos negocios)", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: NAVY,
  });
  y -= 14;
  const table2Cols: AnalysisColumn[] = [
    { label: "", width: 260, align: "left" },
    { label: "Nómina (sin propina)", width: 230, align: "right" },
    { label: "% de venta total", width: 230, align: "right" },
  ];
  const table2Rows: AnalysisRow[] = [
    ...analysis.porcentaje_sobre_venta_combinada.negocios.map((item) => ({
      cells: [
        item.negocio,
        money(item.nomina_sin_propina),
        `${item.porcentaje_venta_total_pts.toFixed(2)} pts`,
      ],
    })),
    {
      cells: [
        "TOTAL",
        money(analysis.porcentaje_sobre_venta_combinada.total.nomina_sin_propina),
        pct(analysis.porcentaje_sobre_venta_combinada.total.porcentaje_venta_total),
      ],
      bold: true,
      redCells: [2],
    },
  ];
  y = drawAnalysisTable(page, bold, regular, y, table2Cols, table2Rows);
  y -= 22;

  // Section 3: % sobre venta propia
  page.drawText("3. % de cada negocio sobre SU PROPIA venta", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: NAVY,
  });
  y -= 14;
  const table3Cols: AnalysisColumn[] = [
    { label: "", width: 195, align: "left" },
    { label: "Venta propia", width: 175, align: "right" },
    { label: "Nómina (sin propina)", width: 175, align: "right" },
    { label: "% propio", width: 175, align: "right" },
  ];
  const table3Rows: AnalysisRow[] = analysis.porcentaje_sobre_venta_propia.negocios.map(
    (item) => ({
      cells: [
        item.negocio,
        money(item.venta_propia),
        money(item.nomina_sin_propina),
        pct(item.porcentaje_propio),
      ],
      bold: true,
      redCells: [3],
    }),
  );
  y = drawAnalysisTable(page, bold, regular, y, table3Cols, table3Rows);
  y -= 20;

  // Comparison note
  const noteText = analysis.nota_ajuste_vs_analisis_anterior?.texto;
  if (noteText) {
    const prefix = "Ajuste vs. análisis anterior: ";
    page.drawText(prefix, { x: MARGIN, y, size: 8, font: bold, color: NAVY });
    const prefixWidth = bold.widthOfTextAtSize(prefix, 8);
    const lines = wrapTextWithFirstLineOffset(
      noteText,
      regular,
      8,
      WIDTH - MARGIN * 2,
      prefixWidth,
    );
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: index === 0 ? MARGIN + prefixWidth : MARGIN,
        y,
        size: 8,
        font: regular,
        color: MUTED,
      });
      y -= 11;
    });
  }

  return page;
}

export async function buildTresbePayrollPdf(params: {
  companyName: string;
  payroll: TresbePayroll;
  entries: TresbePayrollEntry[];
  analysis?: TresbePayrollAnalysisJson | null;
}) {
  const entries = params.entries.filter(hasTresbePayrollValue);
  // Hours/system/adjustments/grand come from the saved payroll header,
  // recalculated by PostgreSQL before preview/send. Servicios is computed
  // here from each entry's real check payout (getServiceCheckPayAmount),
  // which folds tips into the single check for "servicios completos"
  // employees -- matching what actually goes out the door per check. Tips
  // is likewise recomputed excluding those same employees, so their tips
  // aren't counted both there and inside Servicios.
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
  const tipsOutsideServices = entries.reduce(
    (sum, e) =>
      sum +
      (e.payroll_rule_snapshot === "full_services" ? 0 : Number(e.tips)),
    0,
  );
  const visibleTotals = {
    hours: Number(params.payroll.total_weekly_hours),
    system: Number(params.payroll.total_system_pay),
    tips: tipsOutsideServices,
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
    ["Sistema", money(visibleTotals.system)],
    ["Tips", money(visibleTotals.tips)],
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
      size: 6.5,
      font: bold,
      color: MUTED,
    });
    page.drawText(value, {
      x,
      y: y - 13,
      size: index === summary.length - 1 ? 10.5 : 8.5,
      font: bold,
      color: index === summary.length - 1 ? RED : NAVY,
    });
  });
  y -= 42;

  const detailColumns: Column[] = [
    { label: "Empleado", width: 116, value: (e) => e.employee_name_snapshot },
    { label: "Area", width: 48, value: (e) => e.area_snapshot },
    { label: "Horas", width: 38, value: (e) => number(e.total_weekly_hours) },
    { label: "Sistema", width: 68, value: (e) => money(e.system_pay) },
    { label: "Tips", width: 52, value: (e) => money(e.tips) },
    {
      label: "Servicios",
      width: 104,
      value: (e) =>
        Number(e.service_check_amount) > 0
          ? `${money(
              getServiceCheckPayAmount(e.payroll_rule_snapshot, {
                serviceCheckAmount: Number(e.service_check_amount),
                employeeTotal: Number(e.employee_total),
              }),
            )} / ${number(e.service_hours)}h`
          : money(0),
    },
    {
      label: "Motivo / comentario",
      width: 154,
      value: (e) =>
        [
          Number(e.service_check_amount) > 0
            ? (e.service_reason ?? "Otro")
            : null,
          e.comment,
        ]
          .filter(Boolean)
          .join(" - ") || "-",
    },
    { label: "Ajustes", width: 62, value: (e) => money(e.other_adjustments) },
    {
      label: "Total a pagar",
      width: 78,
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

  if (params.analysis) {
    drawTresbeAnalysisPage(
      pdf,
      bold,
      regular,
      params.payroll,
      params.companyName,
      params.analysis,
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
