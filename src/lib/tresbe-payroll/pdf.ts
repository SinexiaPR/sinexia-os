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

function drawTableRow(
  page: PDFPage,
  regular: PDFFont,
  y: number,
  columns: Column[],
  entry: TresbePayrollEntry,
  alternate: boolean,
) {
  if (alternate)
    page.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: WIDTH - MARGIN * 2,
      height: 18,
      color: ALT,
    });
  let x = MARGIN;
  for (const column of columns) {
    page.drawText(fit(column.value(entry), regular, 7.2, column.width - 8), {
      x: x + 4,
      y: y - 12,
      size: 7.2,
      font: regular,
      color: NAVY,
    });
    x += column.width;
  }
  page.drawLine({
    start: { x: MARGIN, y: y - 18 },
    end: { x: WIDTH - MARGIN, y: y - 18 },
    thickness: 0.3,
    color: BORDER,
  });
  return y - 18;
}

export async function buildTresbePayrollPdf(params: {
  companyName: string;
  payroll: TresbePayroll;
  entries: TresbePayrollEntry[];
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Nomina Tresbe ${params.payroll.week_start}`);
  pdf.setAuthor("Sinexia OS");
  pdf.setSubject("Resumen semanal de nomina Tresbe");

  let page = pdf.addPage([WIDTH, HEIGHT]);
  drawHeader(page, bold, regular, params.payroll, params.companyName, false);
  let y = HEIGHT - 128;

  page.drawText("1. RESUMEN DE NOMINA", {
    x: MARGIN,
    y,
    size: 11,
    font: bold,
    color: NAVY,
  });
  y -= 18;
  const summary = [
    ["Empleados", String(params.payroll.employee_count)],
    ["Total horas", number(params.payroll.total_weekly_hours)],
    ["Nomina en sistema", money(params.payroll.total_system_pay)],
    ["Tips", money(params.payroll.total_tips)],
    ["Cheques de servicios", money(params.payroll.total_service_checks)],
    ["Ajustes", money(params.payroll.total_adjustments)],
    ["TOTAL GENERAL A PAGAR", money(params.payroll.grand_total)],
  ];
  summary.forEach(([label, value], index) => {
    const x = MARGIN + (index % 4) * 180;
    const rowY = y - Math.floor(index / 4) * 42;
    page.drawText(label, {
      x,
      y: rowY,
      size: 7.5,
      font: bold,
      color: MUTED,
    });
    page.drawText(value, {
      x,
      y: rowY - 16,
      size: index === 6 ? 13 : 11,
      font: bold,
      color: index === 6 ? RED : NAVY,
    });
  });
  y -= 92;

  const detailColumns: Column[] = [
    { label: "Empleado", width: 130, value: (e) => e.employee_name_snapshot },
    { label: "Area", width: 62, value: (e) => e.area_snapshot },
    { label: "Horas", width: 50, value: (e) => number(e.total_weekly_hours) },
    { label: "H. sistema", width: 62, value: (e) => number(e.system_hours) },
    { label: "Pago sistema", width: 78, value: (e) => money(e.system_pay) },
    { label: "Tips", width: 62, value: (e) => money(e.tips) },
    { label: "H. servicio", width: 62, value: (e) => number(e.service_hours) },
    { label: "Cheque", width: 70, value: (e) => money(e.service_check_amount) },
    { label: "Ajustes", width: 70, value: (e) => money(e.other_adjustments) },
    { label: "Total", width: 74, value: (e) => money(e.employee_total) },
  ];
  page.drawText("2. DETALLE POR EMPLEADO", {
    x: MARGIN,
    y,
    size: 11,
    font: bold,
    color: NAVY,
  });
  y -= 10;
  y = drawTableHeader(page, bold, y, detailColumns);
  params.entries.forEach((entry, index) => {
    if (y < 70) {
      page = pdf.addPage([WIDTH, HEIGHT]);
      drawHeader(page, bold, regular, params.payroll, params.companyName, true);
      y = HEIGHT - 125;
      y = drawTableHeader(page, bold, y, detailColumns);
    }
    y = drawTableRow(page, regular, y, detailColumns, entry, index % 2 === 1);
  });

  const serviceEntries = params.entries.filter(
    (entry) => Number(entry.service_check_amount) > 0,
  );
  const serviceColumns: Column[] = [
    { label: "Empleado", width: 125, value: (e) => e.employee_name_snapshot },
    { label: "Motivo", width: 105, value: (e) => e.service_reason ?? "Otro" },
    {
      label: "H. total",
      width: 55,
      value: (e) => number(e.total_weekly_hours),
    },
    { label: "H. sistema", width: 55, value: (e) => number(e.system_hours) },
    { label: "H. servicio", width: 55, value: (e) => number(e.service_hours) },
    {
      label: "Tarifa",
      width: 65,
      value: (e) => money(e.service_rate_snapshot),
    },
    { label: "Fijo", width: 65, value: (e) => money(e.fixed_service_amount) },
    {
      label: "Cheque",
      width: 75,
      value: (e) => money(e.service_check_amount),
    },
    { label: "Comentario", width: 120, value: (e) => e.comment ?? "-" },
  ];
  if (y < 150) {
    page = pdf.addPage([WIDTH, HEIGHT]);
    drawHeader(page, bold, regular, params.payroll, params.companyName, true);
    y = HEIGHT - 125;
  } else y -= 25;
  page.drawText("3. CHEQUES DE SERVICIOS", {
    x: MARGIN,
    y,
    size: 11,
    font: bold,
    color: NAVY,
  });
  y -= 10;
  y = drawTableHeader(page, bold, y, serviceColumns);
  if (!serviceEntries.length) {
    page.drawText("No hay cheques de servicios en este periodo.", {
      x: MARGIN + 4,
      y: y - 14,
      size: 8,
      font: regular,
      color: MUTED,
    });
    y -= 25;
  } else {
    serviceEntries.forEach((entry, index) => {
      if (y < 70) {
        page = pdf.addPage([WIDTH, HEIGHT]);
        drawHeader(
          page,
          bold,
          regular,
          params.payroll,
          params.companyName,
          true,
        );
        y = HEIGHT - 125;
        y = drawTableHeader(page, bold, y, serviceColumns);
      }
      y = drawTableRow(
        page,
        regular,
        y,
        serviceColumns,
        entry,
        index % 2 === 1,
      );
    });
  }

  if (y < 135) {
    page = pdf.addPage([WIDTH, HEIGHT]);
    drawHeader(page, bold, regular, params.payroll, params.companyName, true);
    y = HEIGHT - 125;
  } else y -= 25;
  page.drawText("4. TOTALES", {
    x: MARGIN,
    y,
    size: 11,
    font: bold,
    color: NAVY,
  });
  y -= 20;
  const totals = [
    ["TOTAL NOMINA EN SISTEMA", params.payroll.total_system_pay],
    ["TOTAL TIPS", params.payroll.total_tips],
    ["TOTAL CHEQUES DE SERVICIOS", params.payroll.total_service_checks],
    ["TOTAL AJUSTES", params.payroll.total_adjustments],
    ["TOTAL GENERAL A PAGAR", params.payroll.grand_total],
  ] as const;
  totals.forEach(([label, value], index) => {
    page.drawText(label, {
      x: MARGIN,
      y,
      size: index === totals.length - 1 ? 10 : 8.5,
      font: bold,
      color: NAVY,
    });
    const amount = money(value);
    page.drawText(amount, {
      x: WIDTH - MARGIN - bold.widthOfTextAtSize(amount, 11),
      y,
      size: 11,
      font: bold,
      color: index === totals.length - 1 ? RED : NAVY,
    });
    y -= 18;
  });
  if (params.payroll.client_note) {
    y -= 8;
    page.drawText("Mensaje al cliente:", {
      x: MARGIN,
      y,
      size: 8.5,
      font: bold,
      color: NAVY,
    });
    page.drawText(
      fit(params.payroll.client_note, regular, 8, WIDTH - MARGIN * 2 - 105),
      { x: MARGIN + 105, y, size: 8, font: regular, color: MUTED },
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
