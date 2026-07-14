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

export async function buildTresbePayrollPdf(params: {
  companyName: string;
  payroll: TresbePayroll;
  entries: TresbePayrollEntry[];
}) {
  const entries = params.entries.filter(hasTresbePayrollValue);
  // Monetary totals come from the saved payroll header, which is recalculated
  // by PostgreSQL before preview/send. The PDF never creates a second total.
  const visibleTotals = {
    hours: Number(params.payroll.total_weekly_hours),
    system: Number(params.payroll.total_system_pay),
    tips: Number(params.payroll.total_tips),
    services: Number(params.payroll.total_service_checks),
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
          ? `${money(e.service_check_amount)} / ${number(e.service_hours)}h`
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
