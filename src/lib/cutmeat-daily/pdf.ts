// Los 5 PDF de "Informes diarios" (Cut Meat Distributors / Wagyu Food
// Service LLC), con pdf-lib. A4 horizontal (el presupuesto de Tresbe usa
// Carta horizontal; este módulo reemplaza un Google Sheet pensado para
// A4, así que se mantiene ese tamaño). Mismo lenguaje visual que el PDF
// de Tresbe: barra superior navy con franja roja, "SINEXIA" en blanco.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  splitVarianceLinesBySection,
  totalVarianceOf,
  type AgingGroup,
  type AgingLine,
  type BankMovement,
  type FinancialReportResult,
  type RecurringPayment,
  type ReconciliationControlResult,
  type VarianceLine,
  type VendorAgingResult,
} from "./calculations";
import { formatDayLabel, type IsoDate } from "./dates";

const WIDTH = 842;
const HEIGHT = 595;
const MARGIN = 36;
const NAVY = rgb(0.055, 0.12, 0.2);
const RED = rgb(0.72, 0.12, 0.14);
const MUTED = rgb(0.38, 0.42, 0.47);
const BORDER = rgb(0.82, 0.84, 0.87);
const ALT = rgb(0.965, 0.97, 0.975);

const printable = (value: string) =>
  value
    .replace(/[–—]/g, "-")
    .replace(/[''']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^ -ÿ]/g, "?");

export const money = (value: number | null | undefined) =>
  value == null
    ? "-"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        value,
      );

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const asDate = (value: IsoDate) => new Date(`${value}T12:00:00Z`);

function right(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  xEnd: number,
  y: number,
  color = NAVY,
) {
  const clean = printable(text);
  page.drawText(clean, {
    x: xEnd - font.widthOfTextAtSize(clean, size),
    y,
    size,
    font,
    color,
  });
}

function fit(value: string, font: PDFFont, size: number, width: number) {
  const clean = printable(value);
  if (font.widthOfTextAtSize(clean, size) <= width) return clean;
  let short = clean;
  while (short.length > 1 && font.widthOfTextAtSize(`${short}...`, size) > width)
    short = short.slice(0, -1);
  return `${short.trim()}...`;
}

type Doc = { page: PDFPage; bold: PDFFont; regular: PDFFont };

async function newDoc(subtitle: string, reportDate: IsoDate) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([WIDTH, HEIGHT]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: HEIGHT - 64, width: WIDTH, height: 64, color: NAVY });
  page.drawRectangle({ x: 0, y: HEIGHT - 68, width: WIDTH, height: 4, color: RED });
  page.drawText("SINEXIA", {
    x: MARGIN,
    y: HEIGHT - 38,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  right(page, subtitle, bold, 11, WIDTH - MARGIN, HEIGHT - 36, rgb(1, 1, 1));
  page.drawText("Cut Meat Distributors (Wagyu Food Service LLC)", {
    x: MARGIN,
    y: HEIGHT - 54,
    size: 9,
    font: regular,
    color: rgb(0.85, 0.87, 0.9),
  });
  right(
    page,
    `Fecha del informe: ${dateFormat.format(asDate(reportDate))}`,
    regular,
    9,
    WIDTH - MARGIN,
    HEIGHT - 54,
    rgb(0.85, 0.87, 0.9),
  );
  return { pdf, doc: { page, bold, regular } as Doc };
}

function sectionTitle(doc: Doc, text: string, y: number) {
  doc.page.drawText(printable(text), {
    x: MARGIN,
    y,
    size: 11,
    font: doc.bold,
    color: NAVY,
  });
  return y - 16;
}

function keyValueRow(doc: Doc, label: string, value: string, x: number, y: number) {
  doc.page.drawText(printable(label), { x, y, size: 8.5, font: doc.regular, color: MUTED });
  right(doc.page, value, doc.bold, 9, x + 220, y);
}

const BOTTOM_MARGIN = 40;

/** Agrega una página nueva de las mismas dimensiones y la deja como
 * página activa de `doc` -- todo lo que se dibuje después (incluyendo en
 * funciones que ya tenían `doc.page` capturado en una variable local, ya
 * que `doc` es el mismo objeto) va a parar ahí. */
function addPage(pdf: PDFDocument, doc: Doc): number {
  doc.page = pdf.addPage([WIDTH, HEIGHT]);
  return HEIGHT - BOTTOM_MARGIN;
}

/** Tabla simple: encabezados + filas de texto, con una fila de total
 * opcional. Pagina sola: si una fila (o el encabezado) no entra antes del
 * margen inferior, cierra el borde de lo dibujado en la página actual,
 * agrega una página nueva y repite el encabezado de columnas ahí. Devuelve
 * el Y final para seguir dibujando debajo (en la página que haya quedado
 * activa). */
function drawTable(
  pdf: PDFDocument,
  doc: Doc,
  x: number,
  y: number,
  columns: Array<{ label: string; width: number; align?: "left" | "right" }>,
  rows: string[][],
  totalRow?: string[],
) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const rowHeight = 13;

  const drawHeader = (yy: number) => {
    doc.page.drawRectangle({ x, y: yy - 16, width: tableWidth, height: 16, color: NAVY });
    let cx = x;
    for (const col of columns) {
      if (col.align === "right") {
        right(doc.page, col.label, doc.bold, 7.5, cx + col.width - 4, yy - 11, rgb(1, 1, 1));
      } else {
        doc.page.drawText(printable(col.label), {
          x: cx + 4,
          y: yy - 11,
          size: 7.5,
          font: doc.bold,
          color: rgb(1, 1, 1),
        });
      }
      cx += col.width;
    }
    return yy - 16;
  };

  const drawRow = (yy: number, row: string[], index: number, bold: boolean) => {
    if (bold) {
      doc.page.drawRectangle({ x, y: yy - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.9, 0.92, 0.94) });
    } else if (index % 2 === 1) {
      doc.page.drawRectangle({ x, y: yy - rowHeight, width: tableWidth, height: rowHeight, color: ALT });
    }
    let colX = x;
    row.forEach((cell, colIndex) => {
      const col = columns[colIndex];
      const text = bold ? printable(cell) : fit(cell, doc.regular, 7.5, col.width - 8);
      const font = bold ? doc.bold : doc.regular;
      const size = bold ? 7.8 : 7.5;
      if (col.align === "right") {
        right(doc.page, text, font, size, colX + col.width - 4, yy - rowHeight + 4);
      } else {
        doc.page.drawText(text, { x: colX + 4, y: yy - rowHeight + 4, size, font, color: NAVY });
      }
      colX += col.width;
    });
    return yy - rowHeight;
  };

  let pageTop = y;
  let yy = drawHeader(y);

  const breakPageIfNeeded = () => {
    if (yy - rowHeight < BOTTOM_MARGIN) {
      doc.page.drawRectangle({ x, y: yy, width: tableWidth, height: pageTop - yy, borderColor: BORDER, borderWidth: 0.75 });
      pageTop = addPage(pdf, doc);
      yy = drawHeader(pageTop);
    }
  };

  rows.forEach((row, index) => {
    breakPageIfNeeded();
    yy = drawRow(yy, row, index, false);
  });
  if (totalRow) {
    breakPageIfNeeded();
    yy = drawRow(yy, totalRow, 0, true);
  }
  doc.page.drawRectangle({ x, y: yy, width: tableWidth, height: pageTop - yy, borderColor: BORDER, borderWidth: 0.75 });
  return yy - 10;
}

function drawReconciliationSection(
  doc: Doc,
  y: number,
  control: ReconciliationControlResult,
): number {
  y = sectionTitle(doc, "Reconciliation Report", y);
  keyValueRow(doc, "Statement ending balance", money(control.statementEnding), MARGIN, y);
  keyValueRow(
    doc,
    "Register balance",
    money(control.register),
    MARGIN + 260,
    y,
  );
  y -= 14;
  keyValueRow(
    doc,
    "Total uncleared checks",
    money(control.unclearedChecksTotal),
    MARGIN,
    y,
  );
  keyValueRow(
    doc,
    "Total uncleared deposits",
    money(control.unclearedDepositsTotal),
    MARGIN + 260,
    y,
  );
  y -= 14;
  keyValueRow(
    doc,
    control.balanced ? "Control (debe ser $0.00)" : "Control -- NO CUADRA",
    money(control.control),
    MARGIN,
    y,
  );
  return y - 20;
}

export async function buildReconciliationPdf(params: {
  reportDate: IsoDate;
  control: ReconciliationControlResult;
  checks: AgingLine[];
  deposits: AgingLine[];
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc("Reconciliation Report", params.reportDate);
  let y = HEIGHT - 90;
  y = drawReconciliationSection(doc, y, params.control);
  y = sectionTitle(doc, "Uncleared Checks and Payments", y);
  y = drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    [
      { label: "Reference", width: 400 },
      { label: "Amount", width: 120, align: "right" },
    ],
    params.checks.map((item) => [item.name, money(item.balance)]),
    ["Total", money(params.control.unclearedChecksTotal)],
  );
  y -= 10;
  y = sectionTitle(doc, "Uncleared Deposits and Credits", y);
  drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    [
      { label: "Reference", width: 400 },
      { label: "Amount", width: 120, align: "right" },
    ],
    params.deposits.map((item) => [item.name, money(item.balance)]),
    ["Total", money(params.control.unclearedDepositsTotal)],
  );
  return pdf.save();
}

export async function buildBankExportPdf(params: {
  reportDate: IsoDate;
  closingBalance: number | null;
  movements: BankMovement[];
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc("Deposit Accounts Activity Summary", params.reportDate);
  let y = HEIGHT - 90;
  y = sectionTitle(doc, "Export del banco", y);
  keyValueRow(doc, "Closing balance", money(params.closingBalance), MARGIN, y);
  y -= 24;
  y = sectionTitle(doc, "Movimientos", y);
  drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    [
      { label: "Descripción", width: 460 },
      { label: "Dirección", width: 90 },
      { label: "Monto", width: 100, align: "right" },
    ],
    params.movements.map((m) => [m.description, m.direction, money(m.amount)]),
  );
  return pdf.save();
}

function drawAgingTable(
  pdf: PDFDocument,
  doc: Doc,
  y: number,
  title: string,
  items: AgingLine[],
  total: number,
): number {
  y = sectionTitle(doc, title, y);
  return drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    [
      { label: "Nombre", width: 460 },
      { label: "Balance", width: 120, align: "right" },
    ],
    items.map((item) => [item.name, money(item.balance)]),
    ["Total", money(total)],
  );
}

/**
 * Reproduce el formato original (Vendor/Customer Balance Detail Report):
 * agrupado por nombre, una fila por factura (fecha/tipo/número/
 * vencimiento/monto/saldo abierto), con "Total for <nombre>" como
 * subtotal, y el total general al final. Se usa en cuanto un solo grupo
 * tiene detalle cargado (txn_date/num/txn_type); si ninguno lo tiene,
 * `drawAgingTable` (nombre + balance) sigue siendo exactamente igual
 * que antes.
 */
function drawAgingDetailTable(
  pdf: PDFDocument,
  doc: Doc,
  y: number,
  title: string,
  groups: AgingGroup[],
  grandTotal: number,
): number {
  y = sectionTitle(doc, title, y);
  const columns = [
    { label: "Fecha", width: 70 },
    { label: "Tipo", width: 90 },
    { label: "Número", width: 90 },
    { label: "Vencimiento", width: 80 },
    { label: "Monto", width: 100, align: "right" as const },
    { label: "Saldo abierto", width: 100, align: "right" as const },
  ];
  // Alto mínimo para arrancar un grupo nuevo en la página actual: nombre
  // + encabezado de columnas + al menos 1 fila + subtotal. Si no entra,
  // mejor arrancarlo en una página nueva en vez de partirlo recién
  // dentro de drawTable.
  const minGroupHeight = 4 + 14 + 16 + 13 + 13;
  for (const group of groups) {
    if (y - minGroupHeight < BOTTOM_MARGIN) {
      y = addPage(pdf, doc);
      y = sectionTitle(doc, `${title} (cont.)`, y);
    }
    y -= 4;
    doc.page.drawText(printable(group.name), {
      x: MARGIN,
      y,
      size: 9,
      font: doc.bold,
      color: NAVY,
    });
    y -= 14;
    y = drawTable(
      pdf,
      doc,
      MARGIN,
      y,
      columns,
      group.lines.map((line) => [
        line.txnDate ? formatDayLabel(line.txnDate) : "",
        line.txnType ?? "",
        line.num ?? "",
        line.dueDate ? formatDayLabel(line.dueDate) : "",
        line.amount == null ? "" : money(line.amount),
        money(line.openBalance ?? line.balance),
      ]),
      [`Total for ${group.name}`, "", "", "", "", money(group.subtotal)],
    );
    y -= 8;
  }
  if (y - 16 < BOTTOM_MARGIN) {
    y = addPage(pdf, doc);
    y = sectionTitle(doc, `${title} (cont.)`, y);
  }
  doc.page.drawText(printable("Total general"), {
    x: MARGIN,
    y,
    size: 9,
    font: doc.bold,
    color: NAVY,
  });
  right(doc.page, money(grandTotal), doc.bold, 9, MARGIN + 530, y);
  return y - 16;
}

export async function buildAgingVendorsPdf(params: {
  reportDate: IsoDate;
  items: AgingLine[];
  rawTotal: number;
  groups?: AgingGroup[];
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc("Vendor Balance Detail Report", params.reportDate);
  const hasDetail = params.groups?.some((group) => group.hasDetail);
  if (hasDetail && params.groups) {
    drawAgingDetailTable(pdf, doc, HEIGHT - 90, "Aging Vendors", params.groups, params.rawTotal);
  } else {
    drawAgingTable(pdf, doc, HEIGHT - 90, "Aging Vendors", params.items, params.rawTotal);
  }
  return pdf.save();
}

export async function buildAgingCustomersPdf(params: {
  reportDate: IsoDate;
  items: AgingLine[];
  rawTotal: number;
  groups?: AgingGroup[];
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc("Customer Balance Detail Report", params.reportDate);
  const hasDetail = params.groups?.some((group) => group.hasDetail);
  if (hasDetail && params.groups) {
    drawAgingDetailTable(pdf, doc, HEIGHT - 90, "Aging Customers", params.groups, params.rawTotal);
  } else {
    drawAgingTable(pdf, doc, HEIGHT - 90, "Aging Customers", params.items, params.rawTotal);
  }
  return pdf.save();
}

export async function buildConsolidatedPdf(params: {
  reportDate: IsoDate;
  control: ReconciliationControlResult | null;
  recurrentes: {
    prior: RecurringPayment[];
    priorTotal: number;
    thisWeek: RecurringPayment[];
    thisWeekTotal: number;
  };
  financial: FinancialReportResult | null;
  varianceLines: VarianceLine[];
  totalVariance: number;
  balanceGabriel: number | null;
  balanceWithNotEntered: number | null;
  incomeDays: Array<{ date: IsoDate; amount: number }>;
  vendorAging: VendorAgingResult | null;
  customerAgingTotal: number | null;
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc("Consolidated Report", params.reportDate);
  let y = HEIGHT - 90;
  if (params.control) y = drawReconciliationSection(doc, y, params.control);

  y = sectionTitle(doc, "Financial Report", y);
  if (params.financial) {
    keyValueRow(doc, "Balance Today", money(params.financial.balanceToday), MARGIN, y);
    keyValueRow(
      doc,
      `7-day (${dateFormat.format(asDate(params.financial.day7.date))})`,
      money(params.financial.day7.balance),
      MARGIN + 260,
      y,
    );
    y -= 14;
    keyValueRow(
      doc,
      `14-day (${dateFormat.format(asDate(params.financial.day14.date))})`,
      money(params.financial.day14.balance),
      MARGIN,
      y,
    );
    keyValueRow(
      doc,
      `21-day (${dateFormat.format(asDate(params.financial.day21.date))})`,
      money(params.financial.day21.balance),
      MARGIN + 260,
      y,
    );
    y -= 20;
  }
  const { variance: varianceOnlyLines, uncollectedDeposits } = splitVarianceLinesBySection(
    params.varianceLines,
  );
  const varianceTableColumns = [
    { label: "Concepto", width: 400 },
    { label: "Monto", width: 120, align: "right" as const },
  ];
  if (varianceOnlyLines.length) {
    y = sectionTitle(doc, "Variación Diaria", y);
    y = drawTable(
      pdf,
      doc,
      MARGIN,
      y,
      varianceTableColumns,
      varianceOnlyLines.map((line) => [line.concept, money(line.amount)]),
      ["Subtotal", money(totalVarianceOf(varianceOnlyLines))],
    );
    y -= 10;
  }
  if (uncollectedDeposits.length) {
    y = sectionTitle(doc, "Depósitos sin cobrar", y);
    y = drawTable(
      pdf,
      doc,
      MARGIN,
      y,
      varianceTableColumns,
      uncollectedDeposits.map((line) => [line.concept, money(line.amount)]),
      ["Subtotal", money(totalVarianceOf(uncollectedDeposits))],
    );
    y -= 10;
  }
  keyValueRow(doc, "Variación Diaria (total)", money(params.totalVariance), MARGIN, y);
  y -= 14;
  keyValueRow(doc, "Balance GABRIEL", money(params.balanceGabriel), MARGIN, y);
  keyValueRow(
    doc,
    "Balance + Not entered Sales",
    money(params.balanceWithNotEntered),
    MARGIN + 260,
    y,
  );
  y -= 20;

  y = sectionTitle(doc, "A/P Aging Detail Recurrentes", y);
  y = drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    [
      { label: "Concepto", width: 300 },
      { label: "Vencimiento", width: 100 },
      { label: "Monto", width: 100, align: "right" },
    ],
    [
      ...params.recurrentes.prior.map((item) => [
        item.concept,
        formatDayLabel(item.dueDate),
        money(item.amount),
      ]),
      ...params.recurrentes.thisWeek.map((item) => [
        item.concept,
        formatDayLabel(item.dueDate),
        money(item.amount),
      ]),
    ],
    [
      "Prior + This week",
      "",
      money(params.recurrentes.priorTotal + params.recurrentes.thisWeekTotal),
    ],
  );
  y -= 10;

  y = sectionTitle(doc, "THIS WEEK", y);
  drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    params.incomeDays.map((day) => ({
      label: formatDayLabel(day.date),
      width: 70,
      align: "right" as const,
    })),
    [params.incomeDays.map((day) => money(day.amount))],
  );

  const page2 = pdf.addPage([WIDTH, HEIGHT]);
  const doc2: Doc = { page: page2, bold: doc.bold, regular: doc.regular };
  let y2 = HEIGHT - 60;
  y2 = sectionTitle(doc2, "Consolidated Report", y2);
  keyValueRow(
    doc2,
    "First Bank Accounts (Wagyu + Prime Meats)",
    money(params.financial?.balanceToday ?? null),
    MARGIN,
    y2,
  );
  y2 -= 18;
  if (params.vendorAging) {
    keyValueRow(doc2, "Aging Vendors (raw total)", money(params.vendorAging.rawTotal), MARGIN, y2);
    keyValueRow(
      doc2,
      "Aging Vendors (consolidado Wagyu + Prime Meats)",
      money(params.vendorAging.consolidated),
      MARGIN + 320,
      y2,
    );
    y2 -= 14;
    keyValueRow(
      doc2,
      "Excluidos (Prime Meats & Seafoods, Jose Santiago Inc)",
      money(params.vendorAging.excludedSubtotal),
      MARGIN,
      y2,
    );
    keyValueRow(
      doc2,
      "Saldo de Prime Meats y sus recurrentes",
      money(params.vendorAging.primeMeatsBalance),
      MARGIN + 320,
      y2,
    );
    y2 -= 20;
  }
  keyValueRow(
    doc2,
    "Aging Customers (Wagyu + Prime Meats)",
    money(params.customerAgingTotal),
    MARGIN,
    y2,
  );
  return pdf.save();
}
