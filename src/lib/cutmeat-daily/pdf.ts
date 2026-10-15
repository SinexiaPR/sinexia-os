// Los 5 PDF de "Informes diarios" (Cut Meat Distributors / Wagyu Food
// Service LLC), con pdf-lib. A4 horizontal.
//
// Réplica fiel de los documentos que entrega Hernan: mismos títulos,
// mismas etiquetas (con sus errores de tipeo tal cual, salvo la lista
// explícita de correcciones ortográficas más abajo), mismo orden de
// secciones y columnas. Sin "SINEXIA" ni "Fecha del informe" ni ningún
// otro banner que Hernan no tenga -- cada builder dibuja el encabezado
// real de SU documento, no un encabezado genérico compartido.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  buildRecurringDetailTable,
  round,
  totalVarianceOf,
  type AgingGroup,
  type AgingLine,
  type BankMovement,
  type FinancialReportResult,
  type RecurringDetailRow,
  type ReconciliationControlResult,
  type VarianceLine,
  type VendorAgingResult,
} from "./calculations";
import {
  addDays,
  formatEnglishLongDate,
  formatEnglishShortDate,
  formatSlashDate,
  formatSpanishLongDate,
  lastDayOfMonth,
  sundayWeekStartOf,
  type IsoDate,
} from "./dates";

const WIDTH = 842;
const HEIGHT = 595;
const MARGIN = 36;
const NAVY = rgb(0.055, 0.12, 0.2);
const MUTED = rgb(0.38, 0.42, 0.47);
const GRAY_TEXT = rgb(0.6, 0.62, 0.65);
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
        // Object.is(value, -0) -- evita "-$0.00" cuando un bucket vacío
        // (p.ej. recurrentes de la semana después, hoy siempre 0) se
        // niega para mostrarse (-step.recurrentes): -0 === 0 es true,
        // pero Intl.NumberFormat sí distingue el signo de -0.
        Object.is(value, -0) ? 0 : value,
      );

/** Como `money`, sin el signo "$" -- el Vendor/Customer Balance Detail
 * Report real solo lo lleva en los totales ("Total for X" / "TOTAL"),
 * nunca en las filas de detalle. */
const plainMoney = (value: number | null | undefined) =>
  value == null
    ? "-"
    : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Object.is(value, -0) ? 0 : value,
      );

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

/** Parte `value` en líneas que entran en `width`, por palabra completa
 * (nunca recorta ni agrega "..."). Si una sola palabra no entra, la deja
 * igual en su propia línea -- desborda un poco en vez de partir la
 * palabra a la mitad. */
function wrapText(value: string, font: PDFFont, size: number, width: number): string[] {
  const clean = printable(value);
  const words = clean.split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(attempt, size) <= width) {
      current = attempt;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type Doc = { page: PDFPage; bold: PDFFont; regular: PDFFont };

async function newDoc(): Promise<{ pdf: PDFDocument; doc: Doc }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([WIDTH, HEIGHT]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  return { pdf, doc: { page, bold, regular } as Doc };
}

/** Pie de página -- fecha/hora de generación + paginación -- en TODAS
 * las páginas ya dibujadas de `pdf` (se aplica al final, cuando se
 * conoce el total de páginas). Por defecto: fecha/hora corta + "i/N".
 * `dateStamp: null` omite la fecha (p.ej. el Export banco, que solo
 * lleva "Page i of N"); `pageLabel` cambia el formato de paginación. */
function stampFooters(
  pdf: PDFDocument,
  font: PDFFont,
  options: { dateStamp?: string | null; pageLabel?: (index: number, total: number) => string } = {},
) {
  const pages = pdf.getPages();
  const dateStamp =
    options.dateStamp !== undefined
      ? options.dateStamp
      : new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const pageLabel = options.pageLabel ?? ((index: number, total: number) => `${index}/${total}`);
  for (const [index, page] of pages.entries()) {
    if (dateStamp) {
      page.drawText(printable(dateStamp), { x: MARGIN, y: 16, size: 7, font, color: GRAY_TEXT });
    }
    right(page, pageLabel(index + 1, pages.length), font, 7, WIDTH - MARGIN, 16, GRAY_TEXT);
  }
}

function sectionTitle(doc: Doc, text: string, y: number, size = 11) {
  doc.page.drawText(printable(text), {
    x: MARGIN,
    y,
    size,
    font: doc.bold,
    color: NAVY,
  });
  return y - (size + 5);
}

function keyValueRow(
  doc: Doc,
  label: string,
  value: string,
  x: number,
  y: number,
  valueOffset = 220,
) {
  doc.page.drawText(printable(label), { x, y, size: 8.5, font: doc.regular, color: MUTED });
  right(doc.page, value, doc.bold, 9, x + valueOffset, y);
}

const LABEL_VALUE_LINE_HEIGHT = 11;

/**
 * Como keyValueRow, pero para etiquetas largas (RECONCILIATION
 * INFORMATION, FINANCIAL REPORT): la etiqueta vive en una columna de
 * ancho fijo (`labelWidth`) y el valor en otra columna fija a la
 * derecha, separada por un margen -- nunca se tocan, sin importar cuán
 * larga sea la etiqueta. Si la etiqueta no entra en una línea, hace
 * salto de línea dentro de su columna (nunca la recorta ni la
 * superpone); si ni así entra en 2 líneas, reduce un poco la fuente.
 * Devuelve la próxima Y libre (ya contempla las líneas que ocupó).
 */
function labelValueRow(
  doc: Doc,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth = 250,
  valueWidth = 85,
  gap = 8,
): number {
  let size = 8.5;
  let lines = wrapText(label, doc.regular, size, labelWidth);
  if (lines.length > 2) {
    size = 7.3;
    lines = wrapText(label, doc.regular, size, labelWidth);
  }
  lines.forEach((line, index) => {
    doc.page.drawText(line, {
      x,
      y: y - index * LABEL_VALUE_LINE_HEIGHT,
      size,
      font: doc.regular,
      color: MUTED,
    });
  });
  const valueXEnd = x + labelWidth + gap + valueWidth;
  right(doc.page, value, doc.bold, 9, valueXEnd, y);
  return y - lines.length * LABEL_VALUE_LINE_HEIGHT;
}

const BOTTOM_MARGIN = 40;

/** Agrega una página nueva de las mismas dimensiones y la deja como
 * página activa de `doc`. */
function addPage(pdf: PDFDocument, doc: Doc): number {
  doc.page = pdf.addPage([WIDTH, HEIGHT]);
  return HEIGHT - BOTTOM_MARGIN;
}

/** Una fila de `drawTable`: datos normales (string[]), una fila
 * resaltada tipo subtotal ({ bold }), una fila atenuada tipo "ya pagado"
 * ({ gray }, se dibuja pero no se piensa como dato activo), o una fila
 * "spanner" que ocupa todo el ancho de la tabla con un solo texto -- para
 * el nombre de un grupo (aging agrupado por proveedor/cliente) sin
 * repetir el encabezado de columnas por cada uno. */
type TableRow = string[] | { bold: string[] } | { gray: string[] } | { spanner: string };

const SPANNER_HEIGHT = 14;

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
  rows: TableRow[],
  totalRow?: string[],
  /** Si la tabla pagina, se llama justo después de la página nueva --
   * para repetir un bloque de título propio del documento (p.ej. el
   * Customer Balance Detail Report) antes del encabezado de columnas.
   * Devuelve el Y donde debe arrancar ese encabezado. */
  onNewPage?: (startY: number) => number,
) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const rowHeight = 12;

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

  const rowHeightOf = (row: TableRow) => (!Array.isArray(row) && "spanner" in row ? SPANNER_HEIGHT : rowHeight);

  const drawRow = (yy: number, row: TableRow, index: number) => {
    if (!Array.isArray(row) && "spanner" in row) {
      doc.page.drawRectangle({ x, y: yy - SPANNER_HEIGHT, width: tableWidth, height: SPANNER_HEIGHT, color: rgb(0.88, 0.9, 0.93) });
      doc.page.drawText(printable(row.spanner), {
        x: x + 4,
        y: yy - SPANNER_HEIGHT + 4,
        size: 8.5,
        font: doc.bold,
        color: NAVY,
      });
      return yy - SPANNER_HEIGHT;
    }
    const bold = !Array.isArray(row) && "bold" in row;
    const gray = !Array.isArray(row) && "gray" in row;
    const cells = bold ? (row as { bold: string[] }).bold : gray ? (row as { gray: string[] }).gray : (row as string[]);
    if (bold) {
      doc.page.drawRectangle({ x, y: yy - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.9, 0.92, 0.94) });
    } else if (index % 2 === 1) {
      doc.page.drawRectangle({ x, y: yy - rowHeight, width: tableWidth, height: rowHeight, color: ALT });
    }
    let colX = x;
    cells.forEach((cell, colIndex) => {
      const col = columns[colIndex];
      const text = bold ? printable(cell) : fit(cell, doc.regular, 7.5, col.width - 8);
      const font = bold ? doc.bold : doc.regular;
      const size = bold ? 7.8 : 7.5;
      const color = gray ? GRAY_TEXT : NAVY;
      if (col.align === "right") {
        right(doc.page, text, font, size, colX + col.width - 4, yy - rowHeight + 4, color);
      } else {
        doc.page.drawText(text, { x: colX + 4, y: yy - rowHeight + 4, size, font, color });
      }
      colX += col.width;
    });
    return yy - rowHeight;
  };

  let pageTop = y;
  let yy = drawHeader(y);

  const breakPageIfNeeded = (needed: number) => {
    if (yy - needed < BOTTOM_MARGIN) {
      doc.page.drawRectangle({ x, y: yy, width: tableWidth, height: pageTop - yy, borderColor: BORDER, borderWidth: 0.75 });
      let newTop = addPage(pdf, doc);
      if (onNewPage) newTop = onNewPage(newTop);
      pageTop = newTop;
      yy = drawHeader(pageTop);
    }
  };

  rows.forEach((row, index) => {
    breakPageIfNeeded(rowHeightOf(row));
    yy = drawRow(yy, row, index);
  });
  if (totalRow) {
    breakPageIfNeeded(rowHeight);
    yy = drawRow(yy, { bold: totalRow }, 0);
  }
  doc.page.drawRectangle({ x, y: yy, width: tableWidth, height: pageTop - yy, borderColor: BORDER, borderWidth: 0.75 });
  return yy - 6;
}

// ---------------------------------------------------------------------------
// 1) Reconciliation Report (QuickBooks)
// ---------------------------------------------------------------------------

/** Una línea de detalle del Reconciliation Report real de QuickBooks:
 * DATE | TYPE | REF NO. | PAYEE | AMOUNT (USD). */
export type ReconciliationDetailLine = {
  txnDate: IsoDate | null;
  txnType: string;
  refNo: string;
  payee: string;
  amount: number;
};

const RECONCILIATION_DETAIL_COLUMNS = [
  { label: "DATE", width: 70 },
  { label: "TYPE", width: 110 },
  { label: "REF NO.", width: 90 },
  { label: "PAYEE", width: 230 },
  { label: "AMOUNT (USD)", width: 100, align: "right" as const },
];

function reconciliationDetailRows(lines: ReconciliationDetailLine[]): string[][] {
  return lines.map((line) => [
    line.txnDate ? formatSlashDate(line.txnDate) : "",
    line.txnType,
    line.refNo,
    line.payee,
    money(line.amount),
  ]);
}

const RECONCILIATION_MIN_TABLE_HEIGHT = 16 /* header */ + 12 * 2 /* 1 fila + Total */ + 20 /* título */;

/** Evita dejar un título + encabezado de tabla solos al final de una
 * página (huérfano): si no entra el mínimo (título + encabezado + 1 fila
 * + Total), salta de página antes de dibujar nada de esta sección. */
function ensureRoomFor(pdf: PDFDocument, doc: Doc, y: number, minHeight: number): number {
  if (y - minHeight < BOTTOM_MARGIN) return addPage(pdf, doc);
  return y;
}

export async function buildReconciliationPdf(params: {
  reportDate: IsoDate;
  /** Fecha de la última conciliación bancaria real (FIRST BANK) -- el
   * "Period Ending" del QB original. Puede ser anterior a reportDate
   * (p.ej. el 10/12 reconciliando todavía contra el statement del
   * 10/09) -- en ese caso, "as of"/"after" se cuentan desde acá. */
  periodEnding: IsoDate;
  reconciledOn: IsoDate | null;
  beginningBalance: number;
  clearedChecks: ReconciliationDetailLine[];
  clearedDeposits: ReconciliationDetailLine[];
  control: ReconciliationControlResult;
  /** Pendientes "as of" periodEnding (la última conciliación real). */
  asOfChecks: ReconciliationDetailLine[];
  asOfDeposits: ReconciliationDetailLine[];
  /** Pendientes nuevos "after" periodEnding, hasta reportDate -- vacíos
   * cuando reportDate == periodEnding (ningún tramo nuevo todavía). */
  afterChecks: ReconciliationDetailLine[];
  afterDeposits: ReconciliationDetailLine[];
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc();
  let y = HEIGHT - 50;
  doc.page.drawText("Wagyu Food Service LLC", { x: MARGIN, y, size: 13, font: doc.bold, color: NAVY });
  y -= 16;
  doc.page.drawText(
    printable(`FIRST BANK, Period Ending ${formatSlashDate(params.periodEnding)}`),
    { x: MARGIN, y, size: 9, font: doc.regular, color: MUTED },
  );
  y -= 20;
  doc.page.drawText("RECONCILIATION REPORT", { x: MARGIN, y, size: 12, font: doc.bold, color: NAVY });
  y -= 16;
  if (params.reconciledOn) {
    doc.page.drawText(
      printable(`Reconciled on: ${formatSlashDate(params.reconciledOn)}`),
      { x: MARGIN, y, size: 8.5, font: doc.regular, color: MUTED },
    );
    y -= 12;
  }
  doc.page.drawText("Reconciled by: Sinexia PR", { x: MARGIN, y, size: 8.5, font: doc.regular, color: MUTED });
  y -= 12;
  doc.page.drawText(
    "Any changes made to transactions after this date aren't included in this report.",
    { x: MARGIN, y, size: 7.5, font: doc.regular, color: MUTED },
  );
  y -= 24;

  // Summary (USD): Statement beginning balance -> Checks/Deposits
  // cleared (con la cantidad entre paréntesis, aunque sea 0) ->
  // Statement ending balance -> Uncleared transactions as of
  // periodEnding (checks + deposits EN UNA SOLA línea, no por
  // separado) -> Register balance as of periodEnding -> Cleared
  // transactions after periodEnding -> Uncleared transactions after
  // periodEnding (también combinados) -> Register balance as of
  // reportDate (hoy) -- igual que el Summary real de QuickBooks.
  const clearedChecksTotal = round(params.clearedChecks.reduce((total, item) => total + item.amount, 0));
  const clearedDepositsTotal = round(params.clearedDeposits.reduce((total, item) => total + item.amount, 0));
  const uncleardAsOfTotal = round(params.control.asOfChecksTotal + params.control.asOfDepositsTotal);
  const uncleardAfterTotal = round(params.control.afterChecksTotal + params.control.afterDepositsTotal);
  // No basta con reportDate !== periodEnding -- un día sin ninguna
  // transacción nueva desde la última conciliación (p.ej. el 10/14
  // reconciliando contra el período al 10/13, pero QuickBooks sin nada
  // posterior) no debe mostrar "Cleared/Uncleared transactions after"
  // en el Summary ni las tablas "after" en Details, aunque las fechas
  // difieran -- eso solo corresponde cuando SÍ hay algo en ese tramo.
  const hasAfterTranche = params.afterChecks.length > 0 || params.afterDeposits.length > 0;

  doc.page.drawText("Summary (USD)", { x: MARGIN, y, size: 10, font: doc.bold, color: NAVY });
  y -= 18;
  keyValueRow(doc, "Statement beginning balance", money(params.beginningBalance), MARGIN, y);
  y -= 14;
  keyValueRow(doc, `Checks and payments cleared (${params.clearedChecks.length})`, money(clearedChecksTotal), MARGIN, y);
  y -= 14;
  keyValueRow(doc, `Deposits and other credits cleared (${params.clearedDeposits.length})`, money(clearedDepositsTotal), MARGIN, y);
  y -= 14;
  keyValueRow(doc, "Statement ending balance", money(params.control.statementEnding), MARGIN, y);
  y -= 18;
  keyValueRow(doc, `Uncleared transactions as of ${formatSlashDate(params.periodEnding)}`, money(uncleardAsOfTotal), MARGIN, y);
  y -= 14;
  keyValueRow(doc, `Register balance as of ${formatSlashDate(params.periodEnding)}`, money(params.control.registerAsOf), MARGIN, y);
  y -= 18;
  if (hasAfterTranche) {
    keyValueRow(doc, `Cleared transactions after ${formatSlashDate(params.periodEnding)}`, money(0), MARGIN, y);
    y -= 14;
    keyValueRow(doc, `Uncleared transactions after ${formatSlashDate(params.periodEnding)}`, money(uncleardAfterTotal), MARGIN, y);
    y -= 14;
    // "Register balance as of" (la última fila del Summary) lleva la
    // fecha de "Reconciled on" -- cuándo se hizo ESTA conciliación --
    // no reportDate.
    keyValueRow(doc, `Register balance as of ${formatSlashDate(params.reconciledOn ?? params.reportDate)}`, money(params.control.register), MARGIN, y);
    y -= 18;
  }
  y -= 8;

  const drawDetailTable = (title: string, lines: ReconciliationDetailLine[], total: number) => {
    y = ensureRoomFor(pdf, doc, y, RECONCILIATION_MIN_TABLE_HEIGHT);
    y = sectionTitle(doc, title, y, 9.5);
    y = drawTable(pdf, doc, MARGIN, y, RECONCILIATION_DETAIL_COLUMNS, reconciliationDetailRows(lines), ["", "", "", "Total", money(total)]);
    y -= 10;
  };

  y = ensureRoomFor(pdf, doc, y, 16);
  doc.page.drawText("Details", { x: MARGIN, y, size: 10, font: doc.bold, color: NAVY });
  y -= 18;
  drawDetailTable(`Checks and payments cleared (${params.clearedChecks.length})`, params.clearedChecks, clearedChecksTotal);
  if (params.clearedDeposits.length > 0) {
    drawDetailTable(`Deposits and other credits cleared (${params.clearedDeposits.length})`, params.clearedDeposits, clearedDepositsTotal);
  }

  y = ensureRoomFor(pdf, doc, y, 16);
  doc.page.drawText("Additional Information", { x: MARGIN, y, size: 10, font: doc.bold, color: NAVY });
  y -= 18;

  drawDetailTable(`Uncleared checks and payments as of ${formatSlashDate(params.periodEnding)}`, params.asOfChecks, params.control.asOfChecksTotal);
  drawDetailTable(`Uncleared deposits and other credits as of ${formatSlashDate(params.periodEnding)}`, params.asOfDeposits, params.control.asOfDepositsTotal);
  if (hasAfterTranche) {
    drawDetailTable(`Uncleared checks and payments after ${formatSlashDate(params.periodEnding)}`, params.afterChecks, params.control.afterChecksTotal);
    drawDetailTable(`Uncleared deposits and other credits after ${formatSlashDate(params.periodEnding)}`, params.afterDeposits, params.control.afterDepositsTotal);
  }
  return pdf.save();
}

// ---------------------------------------------------------------------------
// 2) Export del banco (Deposit Accounts Activity Summary)
// ---------------------------------------------------------------------------

/** Igual formato que la fecha/hora "Report Created" del export real del
 * banco: "10/13/2026 11:25:20 AM (ET)". */
function formatReportCreatedStamp(date: Date): string {
  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  }).format(date);
  return `${datePart} ${timePart} (ET)`;
}

export async function buildBankExportPdf(params: {
  reportDate: IsoDate;
  /** Fecha(s) que cubre este export -- "Date range" del banco, puede
   * ser anterior a reportDate (réplica: el export sigue fechado el día
   * de la última actividad real, no el día del informe). */
  dateRange: IsoDate;
  accountLabel: string;
  availableBalance: number;
  closingBalance: number | null;
  movements: BankMovement[];
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc();
  let y = HEIGHT - 50;
  const headerLine = (text: string, size = 9, color = MUTED) => {
    doc.page.drawText(printable(text), { x: MARGIN, y, size, font: doc.regular, color });
    y -= 13;
  };
  doc.page.drawText("Deposit Accounts Activity Summary", { x: MARGIN, y, size: 12, font: doc.bold, color: NAVY });
  y -= 18;
  headerLine(`Report Created: ${formatReportCreatedStamp(params.generatedAt ?? new Date())}`);
  headerLine(`Account: ${params.accountLabel} - Available ${money(params.availableBalance)}`);
  headerLine(`Date range: ${formatSlashDate(params.dateRange)}`);
  headerLine("Transaction types: All transactions");
  headerLine("Detail option: Includes transaction detail");
  y -= 8;
  // El export real repite la línea de cuenta antes de la tabla.
  headerLine(`Account: ${params.accountLabel} - Available ${money(params.availableBalance)}`, 9.5, NAVY);
  y -= 4;

  const debitTotal = round(
    params.movements.filter((m) => m.direction === "egreso").reduce((total, m) => total + m.amount, 0),
  );
  const creditTotal = round(
    params.movements.filter((m) => m.direction === "ingreso").reduce((total, m) => total + m.amount, 0),
  );
  const rows: TableRow[] = params.movements.map((m) => [
    m.postDate ? formatSlashDate(m.postDate) : "",
    "",
    "",
    m.description,
    m.direction === "egreso" ? money(m.amount) : "",
    m.direction === "ingreso" ? money(m.amount) : "",
    m.calculatedBalance == null ? "" : money(m.calculatedBalance),
  ]);
  y = drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    [
      { label: "Post Date", width: 70 },
      { label: "Reference", width: 90 },
      { label: "Additional Reference", width: 110 },
      { label: "Description", width: 220 },
      { label: "Debit", width: 85, align: "right" },
      { label: "Credit", width: 85, align: "right" },
      { label: "Calculated Balance", width: 110, align: "right" },
    ],
    rows,
    [formatSlashDate(params.dateRange), "", "", "Totals", money(debitTotal), money(creditTotal), ""],
  );
  stampFooters(pdf, doc.regular, { dateStamp: null, pageLabel: (i, n) => `Page ${i} of ${n}` });
  return pdf.save();
}

// ---------------------------------------------------------------------------
// 3) Aging Vendors / Aging Customers (Vendor / Customer Balance Detail Report)
// ---------------------------------------------------------------------------

function drawAgingTable(
  pdf: PDFDocument,
  doc: Doc,
  y: number,
  items: AgingLine[],
  total: number,
  onNewPage?: (startY: number) => number,
): number {
  return drawTable(
    pdf,
    doc,
    MARGIN,
    y,
    [
      { label: "Nombre", width: 460 },
      { label: "Balance", width: 120, align: "right" },
    ],
    items.map((item) => [item.name, plainMoney(item.balance)]),
    ["TOTAL", money(total)],
    onNewPage,
  );
}

/**
 * Agrupado por nombre, una fila por factura (Date/Transaction type/Num/
 * Due date/Amount/Open balance/Balance), con "Total for <nombre>" como
 * subtotal, cierre "TOTAL" al final, y una columna de Balance corrido
 * que se REINICIA EN 0 al empezar cada vendor/customer (no se acumula
 * entre grupos distintos), igual que el Vendor/Customer Balance Detail
 * Report original de QuickBooks.
 */
function drawAgingDetailTable(
  pdf: PDFDocument,
  doc: Doc,
  y: number,
  groups: AgingGroup[],
  grandTotal: number,
  onNewPage?: (startY: number) => number,
): number {
  const columns = [
    { label: "Date", width: 62 },
    { label: "Transaction type", width: 85 },
    { label: "Num", width: 80 },
    { label: "Due date", width: 62 },
    { label: "Amount", width: 90, align: "right" as const },
    { label: "Open balance", width: 95, align: "right" as const },
    { label: "Balance", width: 95, align: "right" as const },
  ];
  const rows: TableRow[] = [];
  for (const group of groups) {
    rows.push({ spanner: group.name });
    // El Balance corrido se reinicia en 0 al empezar cada vendor/
    // customer -- no se acumula entre grupos distintos.
    let running = 0;
    for (const line of group.lines) {
      running += line.openBalance ?? line.balance;
      rows.push([
        line.txnDate ? formatSlashDate(line.txnDate) : "",
        line.txnType ?? "",
        line.num ?? "",
        line.dueDate ? formatSlashDate(line.dueDate) : "",
        line.amount == null ? "" : plainMoney(line.amount),
        plainMoney(line.openBalance ?? line.balance),
        plainMoney(running),
      ]);
    }
    // "Total for X" lleva el subtotal tanto en Amount como en Open
    // balance (las 2 columnas de importe), igual que el original.
    rows.push({ bold: [`Total for ${group.name}`, "", "", "", money(group.subtotal), money(group.subtotal), ""] });
  }
  return drawTable(pdf, doc, MARGIN, y, columns, rows, ["TOTAL", "", "", "", money(grandTotal), money(grandTotal), ""], onNewPage);
}

function drawAgingHeader(doc: Doc, reportType: string, subtitle: string, startY = HEIGHT - 50) {
  let y = startY;
  doc.page.drawText("Wagyu Food Service LLC", { x: MARGIN, y, size: 13, font: doc.bold, color: NAVY });
  y -= 16;
  doc.page.drawText(printable(reportType), { x: MARGIN, y, size: 11, font: doc.bold, color: NAVY });
  y -= 14;
  doc.page.drawText(printable(subtitle), { x: MARGIN, y, size: 8.5, font: doc.regular, color: MUTED });
  return y - 20;
}

/** "Tuesday, October 13, 2026 01:07 PM GMT-04:00" -- Puerto Rico (AST)
 * no tiene horario de verano, así que el offset es siempre -04:00. */
function formatAgingFooterStamp(date: Date): string {
  const datePart = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Puerto_Rico",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Puerto_Rico",
  }).format(date);
  return `${datePart} ${timePart} GMT-04:00`;
}

export async function buildAgingVendorsPdf(params: {
  reportDate: IsoDate;
  items: AgingLine[];
  rawTotal: number;
  groups?: AgingGroup[];
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc();
  const y = drawAgingHeader(doc, "Vendor Balance Detail Report - New", "All Dates");
  const hasDetail = params.groups?.some((group) => group.hasDetail);
  if (hasDetail && params.groups) {
    drawAgingDetailTable(pdf, doc, y, params.groups, params.rawTotal);
  } else {
    drawAgingTable(pdf, doc, y, params.items, params.rawTotal);
  }
  stampFooters(pdf, doc.regular, { dateStamp: formatAgingFooterStamp(params.generatedAt ?? new Date()) });
  return pdf.save();
}

export async function buildAgingCustomersPdf(params: {
  reportDate: IsoDate;
  items: AgingLine[];
  rawTotal: number;
  groups?: AgingGroup[];
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc();
  const subtitle = `As of ${formatEnglishShortDate(params.reportDate)}`;
  const y = drawAgingHeader(doc, "Customer Balance Detail Report - New", subtitle);
  // Si pagina, la página 2 (y siguientes) repite el bloque de título --
  // no solo el encabezado de columnas de la tabla.
  const onNewPage = (startY: number) => drawAgingHeader(doc, "Customer Balance Detail Report - New", subtitle, startY);
  const hasDetail = params.groups?.some((group) => group.hasDetail);
  if (hasDetail && params.groups) {
    drawAgingDetailTable(pdf, doc, y, params.groups, params.rawTotal, onNewPage);
  } else {
    drawAgingTable(pdf, doc, y, params.items, params.rawTotal, onNewPage);
  }
  stampFooters(pdf, doc.regular, { dateStamp: formatAgingFooterStamp(params.generatedAt ?? new Date()) });
  return pdf.save();
}

// ---------------------------------------------------------------------------
// 4) Consolidated (3 páginas: Reconciliation Information + Financial Report
//    + A/P Aging Detail Recurrentes // Balance GABRIEL + Variación Diaria
//    // portada CONSOLIDATED REPORT)
// ---------------------------------------------------------------------------

function financialHorizonRow(
  doc: Doc,
  y: number,
  step: FinancialReportResult["day7"],
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
  recurrentesLabel: string | null,
) {
  const range = `${formatSpanishLongDate(rangeStart)} al ${formatSpanishLongDate(rangeEnd)}`;
  y = labelValueRow(doc, `Weekly income projection - Proyección del ${range}`, money(step.income), MARGIN, y) - 2;
  // Solo day7 (sin recurrentesLabel) usa "Aging at" a secas; day14/day21
  // lo escriben "Total Aging at", tal como Hernan.
  const agingLabel = recurrentesLabel ? "Total Aging at" : "Aging at";
  if (recurrentesLabel) {
    y = labelValueRow(doc, `${recurrentesLabel} - Recurrentes del ${range}`, money(-step.recurrentes), MARGIN, y) - 2;
  }
  y = labelValueRow(doc, `${agingLabel} - Aging del ${range}`, money(step.agingAdjustment), MARGIN, y) - 2;
  if (!recurrentesLabel) {
    // "Total" solo en el primer bloque (7-day) -- Balance Today +
    // Weekly income projection (+ Aging) de ESE bloque: es el mismo
    // step.balance que se muestra justo debajo como "7-day balance",
    // así que SIEMPRE coinciden (nunca un valor fijo aparte).
    y = labelValueRow(doc, "Total", money(step.balance), MARGIN, y) - 2;
  }
  y = labelValueRow(doc, `${step.label} balance ${formatSlashDate(step.date)}`, money(step.balance), MARGIN, y) - 2;
  return y - 14;
}

function recurringRowCells(row: RecurringDetailRow): string[] {
  const num = row.referenceNumber?.replace(/^"|"$/g, "") ?? "";
  return [
    row.entryDate ? formatSlashDate(row.entryDate) : "",
    row.itemType ?? "",
    num,
    row.vendor,
    row.dueDate ? formatSlashDate(row.dueDate) : "",
    money(row.amount),
  ];
}

type RecurringTableRowSpec = { cells: string[]; kind: "data" | "paid" | "bold" };

const RECURRING_TABLE_COLUMNS: Array<{ label: string; width: number; align?: "right"; wrap?: boolean }> = [
  { label: "Date", width: 42 },
  { label: "Tr Type", width: 30 },
  { label: "Num", width: 78, wrap: true },
  { label: "Vendor", width: 110, wrap: true },
  { label: "Due Date", width: 42 },
  { label: "Amount", width: 64, align: "right" },
];

/**
 * Tabla de "A/P Aging Detail Recurrentes": a diferencia de drawTable
 * (pensada para filas de una sola línea), acá Vendor y Num hacen salto
 * de línea dentro de su columna en vez de recortarse con "..." -- los
 * nombres largos (p.ej. "Deposito Oriental Bank - Seg de vida - J
 * Manzanares") tienen que verse completos, como en el original de
 * Hernan. Cada fila mide lo que necesite (1-3 líneas); sin zebra-stripe
 * (alternar el fondo por fila no tiene sentido con alto variable, y fue
 * la causa de un recuadro gris suelto que no correspondía a ninguna
 * fila real).
 */
function drawRecurringDetailTable(
  pdf: PDFDocument,
  doc: Doc,
  x: number,
  y: number,
  rows: RecurringTableRowSpec[],
): number {
  const columns = RECURRING_TABLE_COLUMNS;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const lineHeight = 9;
  const vPad = 3;
  const dataSize = 7;
  const boldSize = 7.3;

  const drawHeader = (yy: number) => {
    doc.page.drawRectangle({ x, y: yy - 16, width: tableWidth, height: 16, color: NAVY });
    let cx = x;
    for (const col of columns) {
      if (col.align === "right") {
        right(doc.page, col.label, doc.bold, 7, cx + col.width - 4, yy - 11, rgb(1, 1, 1));
      } else {
        doc.page.drawText(printable(col.label), { x: cx + 4, y: yy - 11, size: 7, font: doc.bold, color: rgb(1, 1, 1) });
      }
      cx += col.width;
    }
    return yy - 16;
  };

  let pageTop = y;
  let yy = drawHeader(y);

  for (const row of rows) {
    const bold = row.kind === "bold";
    const paid = row.kind === "paid";
    const size = bold ? boldSize : dataSize;
    const font = bold ? doc.bold : doc.regular;
    const color = paid ? GRAY_TEXT : NAVY;
    // Las filas "bold" (Total-Week / TOTAL RECURRENTES A PAGAR) solo
    // usan la columna Vendor + Amount -- Date/Tr Type/Num/Due Date van
    // vacíos -- así que la etiqueta puede usar el ancho de Vendor + Due
    // Date combinado (esa celda igual queda vacía) en vez de recortarse
    // a solo 110pt, que no le alcanza a "TOTAL RECURRENTES A PAGAR".
    const vendorIndex = 3;
    const dueDateIndex = 4;
    const vendorWidth = bold ? columns[vendorIndex]!.width + columns[dueDateIndex]!.width : columns[vendorIndex]!.width;
    const wrapped = columns.map((col, i) => {
      if (bold && i === dueDateIndex) return [""];
      const width = i === vendorIndex ? vendorWidth : col.width;
      return col.wrap && row.cells[i] ? wrapText(row.cells[i]!, font, size, width - 8) : [printable(row.cells[i] ?? "")];
    });
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
    const rowHeight = lineCount * lineHeight + vPad * 2;

    if (yy - rowHeight < BOTTOM_MARGIN) {
      doc.page.drawRectangle({ x, y: yy, width: tableWidth, height: pageTop - yy, borderColor: BORDER, borderWidth: 0.75 });
      pageTop = addPage(pdf, doc);
      yy = drawHeader(pageTop);
    }

    if (bold) {
      doc.page.drawRectangle({ x, y: yy - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.9, 0.92, 0.94) });
    }
    let colX = x;
    columns.forEach((col, i) => {
      const lines = wrapped[i]!;
      lines.forEach((line, lineIndex) => {
        const lineY = yy - vPad - lineHeight * (lineIndex + 1) + 2;
        if (col.align === "right") {
          right(doc.page, line, font, size, colX + col.width - 4, lineY, color);
        } else {
          doc.page.drawText(line, { x: colX + 4, y: lineY, size, font, color });
        }
      });
      colX += col.width;
    });
    yy -= rowHeight;
  }

  doc.page.drawRectangle({ x, y: yy, width: tableWidth, height: pageTop - yy, borderColor: BORDER, borderWidth: 0.75 });
  return yy - 6;
}

export async function buildConsolidatedPdf(params: {
  reportDate: IsoDate;
  control: ReconciliationControlResult | null;
  financial: FinancialReportResult | null;
  recurring: RecurringDetailRow[];
  varianceLines: VarianceLine[];
  balanceGabriel: number | null;
  /** Depósitos del día que todavía no están en QuickBooks, sin contar
   * los que ya aparecen como línea de Variación Diaria (p.ej. Costco) --
   * ver buildConsolidatedPageTwo más abajo. */
  notEnteredDepositsTotal: number;
  vendorAging: VendorAgingResult | null;
  customerAgingRawTotal: number | null;
  customerAgingConsolidated: number | null;
  primeMeatsRecurring: number;
}): Promise<Uint8Array> {
  const { pdf, doc } = await newDoc();

  // -------------------------------------------------------------------
  // Página 1: RECONCILIATION INFORMATION + FINANCIAL REPORT (izquierda) /
  // A/P Aging Detail Recurrentes (derecha)
  // -------------------------------------------------------------------
  let y = HEIGHT - 50;
  doc.page.drawText("RECONCILIATION INFORMATION", { x: MARGIN, y, size: 11, font: doc.bold, color: NAVY });
  right(doc.page, formatSlashDate(params.reportDate), doc.bold, 9, MARGIN + 380, y);
  y -= 16;
  doc.page.drawText("Date", { x: MARGIN, y, size: 7.5, font: doc.bold, color: MUTED });
  right(doc.page, "Amount", doc.bold, 7.5, MARGIN + 335, y);
  y -= 14;
  if (params.control) {
    // La columna "Date" de estas filas -- a diferencia del Reconciliation
    // Report propio, que usa la fecha de la última conciliación real --
    // siempre es reportDate (el día de ESTE informe), igual que en la
    // planilla de Hernan.
    const asOfDate = params.reportDate;
    y = labelValueRow(doc, "Statement ending balance S/RECONCILIATION REPORT", money(params.control.statementEnding), MARGIN, y) - 2;
    y = labelValueRow(doc, `Uncleared checks and payments as of ${formatSlashDate(asOfDate)} S/RECONCILIATION REPORT`, money(params.control.asOfChecksTotal), MARGIN, y) - 2;
    y = labelValueRow(doc, `Uncleared checks and payments after ${formatSlashDate(asOfDate)} S/RECONCILIATION REPORT`, money(params.control.afterChecksTotal), MARGIN, y) - 2;
    y = labelValueRow(doc, `Uncleared deposits and other credits as of ${formatSlashDate(asOfDate)} S/RECONCILIATION REPORT`, money(params.control.asOfDepositsTotal), MARGIN, y) - 2;
    y = labelValueRow(doc, `Uncleared deposits and other credits after ${formatSlashDate(asOfDate)} S/RECONCILIATION REPORT`, money(params.control.afterDepositsTotal), MARGIN, y) - 2;
    y = labelValueRow(doc, "Register balance S/RECONCILIATION REPORT", money(params.control.register), MARGIN, y) - 2;
  }
  const recurring = buildRecurringDetailTable(params.recurring, params.reportDate);
  y = labelValueRow(doc, "Recurrentes prior to this week", money(-recurring.prior.total), MARGIN, y) - 2;
  y = labelValueRow(doc, "Recurrentes for this week", money(-recurring.thisWeek.total), MARGIN, y) - 2;
  y = labelValueRow(doc, "Balance after Weekly Payments", money(params.financial?.balanceToday ?? null), MARGIN, y) - 2;
  y = labelValueRow(doc, "A/P Aging", money(0), MARGIN, y) - 2;
  y -= 10;

  if (params.financial) {
    doc.page.drawText("FINANCIAL REPORT", { x: MARGIN, y, size: 11, font: doc.bold, color: NAVY });
    right(doc.page, formatSlashDate(params.reportDate), doc.bold, 9, MARGIN + 380, y);
    y -= 16;
    doc.page.drawText("Date", { x: MARGIN, y, size: 7.5, font: doc.bold, color: MUTED });
    right(doc.page, "Amount", doc.bold, 7.5, MARGIN + 335, y);
    y -= 14;
    y = labelValueRow(doc, "Balance - Today", money(params.financial.balanceToday), MARGIN, y) - 2;
    y -= 4;
    const weekStart = sundayWeekStartOf(params.reportDate);
    y = financialHorizonRow(doc, y, params.financial.day7, addDays(weekStart, 0), addDays(weekStart, 6), null);
    y = financialHorizonRow(doc, y, params.financial.day14, addDays(weekStart, 7), addDays(weekStart, 13), "Recurrentes for next 14 days");
    y = financialHorizonRow(doc, y, params.financial.day21, addDays(weekStart, 14), addDays(weekStart, 20), "Recurrentes for next 21 days");
  }

  // A/P Aging Detail Recurrentes -- columna derecha de la misma página 1.
  const rightX = 430;
  let ry = HEIGHT - 50;
  doc.page.drawText(
    printable(`A/P Aging Detail Recurrentes - As of ${formatEnglishLongDate(lastDayOfMonth(params.reportDate))}`),
    { x: rightX, y: ry, size: 10, font: doc.bold, color: NAVY },
  );
  ry -= 18;
  const recurringRows: RecurringTableRowSpec[] = [];
  for (const [bucket, label] of [
    [recurring.prior, "Total-Week"],
    [recurring.thisWeek, "Total-Week"],
    [recurring.nextWeek, "Total-Week"],
    [recurring.weekAfter, "Total-Week"],
  ] as const) {
    for (const row of bucket.rows) {
      recurringRows.push({ cells: recurringRowCells(row), kind: row.isPaid ? "paid" : "data" });
    }
    recurringRows.push({ cells: ["", "", "", label, "", money(bucket.total)], kind: "bold" });
  }
  recurringRows.push({
    cells: ["", "", "", "TOTAL RECURRENTES A PAGAR", "", money(recurring.grandTotal)],
    kind: "bold",
  });
  drawRecurringDetailTable(pdf, doc, rightX, ry, recurringRows);

  // -------------------------------------------------------------------
  // Página 2: Balance - GABRIEL + Variación Diaria + Balance after Weekly
  // Payments (+ Not entered Sales)
  // -------------------------------------------------------------------
  const page2 = pdf.addPage([WIDTH, HEIGHT]);
  const doc2: Doc = { page: page2, bold: doc.bold, regular: doc.regular };
  let y2 = HEIGHT - 50;
  doc2.page.drawText(formatSlashDate(params.reportDate), { x: MARGIN, y: y2, size: 10, font: doc.bold, color: NAVY });
  y2 -= 20;
  keyValueRow(doc2, "Balance - GABRIEL", money(params.balanceGabriel), MARGIN, y2, 300);
  y2 -= 24;

  // Todas las líneas de Variación Diaria (incluida Costco, aunque su
  // section siga siendo "uncollected_deposit" para la ecuación de
  // control) se muestran juntas en "Uncleared checks and payments" --
  // "Uncleared deposits and other credits" es una sección propia del
  // formato de Hernan que queda siempre vacía (0.00) en este informe.
  // El total de control (Gabriel + variación) no cambia: sigue siendo
  // Gabriel + la suma de TODAS las líneas, sin importar cómo se
  // agrupen visualmente.
  const allVarianceTotal = totalVarianceOf(params.varianceLines);
  const varianceColumns = [
    { label: "", width: 350 },
    { label: "", width: 120, align: "right" as const },
  ];
  y2 = sectionTitle(doc2, "Variación Diaria - Uncleared checks and payments", y2, 10);
  y2 = drawTable(
    pdf,
    doc2,
    MARGIN,
    y2,
    varianceColumns,
    params.varianceLines.map((line) => [line.concept, money(line.amount)]),
    ["", money(allVarianceTotal)],
  );
  y2 -= 14;
  y2 = sectionTitle(doc2, "Variación Diaria- Uncleared deposits and other credits", y2, 10);
  y2 = drawTable(pdf, doc2, MARGIN, y2, varianceColumns, [], ["", money(0)]);
  y2 -= 20;

  const balanceAfterVariance =
    params.balanceGabriel == null ? null : params.balanceGabriel + allVarianceTotal;
  keyValueRow(doc2, "Balance after Weekly Payments", money(balanceAfterVariance), MARGIN, y2, 300);
  y2 -= 14;
  // "Depósitos del día" (lo nuevo de HOY todavía no ingresado en
  // QuickBooks) es un término propio de la ecuación de control -- no se
  // le resta nada de la sección "uncollected_deposit" de arriba (esa
  // puede ser, p.ej., la reversa de un Not entered Sales de un día
  // anterior: otro día, otro depósito, no se netean entre sí).
  const depositsOfTheDay = params.notEnteredDepositsTotal;
  keyValueRow(doc2, `Depósitos ${formatSlashDate(params.reportDate)}`, money(depositsOfTheDay), MARGIN, y2, 300);
  y2 -= 14;
  const balanceWithNotEntered = balanceAfterVariance == null ? null : balanceAfterVariance + depositsOfTheDay;
  keyValueRow(doc2, "Balance after Weekly Payments + Not entered Sales", money(balanceWithNotEntered), MARGIN, y2, 300);

  // -------------------------------------------------------------------
  // Página 3 (portada, se mueve al frente del Paquete para el dueño):
  // CONSOLIDATED REPORT -- lo único que de verdad mira el dueño.
  // -------------------------------------------------------------------
  const page3 = pdf.addPage([WIDTH, HEIGHT]);
  const doc3: Doc = { page: page3, bold: doc.bold, regular: doc.regular };
  let y3 = HEIGHT - 50;
  doc3.page.drawText("CONSOLIDATED REPORT", { x: MARGIN, y: y3, size: 14, font: doc.bold, color: NAVY });
  right(doc3.page, formatSlashDate(params.reportDate), doc.bold, 10, WIDTH - MARGIN, y3);
  y3 -= 36;

  const primeMeatsBankBalance = 0;
  const totalFirstBank = (params.financial?.balanceToday ?? 0) + primeMeatsBankBalance;
  y3 = sectionTitle(doc3, "FIRST BANK ACCOUNTS", y3, 10);
  keyValueRow(doc3, "Wagyu Food Service Balance First Bank Acc", money(params.financial?.balanceToday ?? null), MARGIN, y3, 260);
  y3 -= 14;
  keyValueRow(doc3, "Prime Meats Balance First Bank Acc", money(primeMeatsBankBalance), MARGIN, y3, 260);
  y3 -= 14;
  // Esta fila lleva 2 valores (0.00 y 0.00), no 1 como las demás --
  // réplica exacta de la planilla de Hernan.
  doc3.page.drawText(printable("Recurrentes Prime Meats"), { x: MARGIN, y: y3, size: 8.5, font: doc.regular, color: MUTED });
  right(doc3.page, money(params.primeMeatsRecurring), doc.bold, 9, MARGIN + 200, y3);
  right(doc3.page, money(params.primeMeatsRecurring), doc.bold, 9, MARGIN + 260, y3);
  y3 -= 14;
  keyValueRow(doc3, "Total First Bank Accounts", money(totalFirstBank), MARGIN, y3, 260);
  y3 -= 30;

  if (params.vendorAging) {
    y3 = sectionTitle(doc3, "AGING - VENDORS", y3, 10);
    keyValueRow(doc3, "Wagyu Food Service - Total", money(params.vendorAging.rawTotal), MARGIN, y3, 260);
    y3 -= 14;
    keyValueRow(doc3, "Prime Meats - Total", money(params.vendorAging.primeMeatsBalance), MARGIN, y3, 260);
    y3 -= 14;
    keyValueRow(doc3, "Aging Vendors - Consolidated Total", money(params.vendorAging.consolidated), MARGIN, y3, 260);
    y3 -= 30;
  }

  if (params.customerAgingRawTotal != null) {
    y3 = sectionTitle(doc3, "AGING - CUSTOMERS", y3, 10);
    keyValueRow(doc3, "Wagyu Food Service - Total", money(params.customerAgingRawTotal), MARGIN, y3, 260);
    y3 -= 14;
    keyValueRow(doc3, "Prime Meats - Total", money(0), MARGIN, y3, 260);
    y3 -= 14;
    keyValueRow(doc3, "Aging Customers - Consolidated Total", money(params.customerAgingConsolidated), MARGIN, y3, 260);
  }

  return pdf.save();
}
