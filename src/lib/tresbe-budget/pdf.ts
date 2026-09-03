import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type { HorizonRow, WeekView } from "@/lib/tresbe-budget/calculations";
import { addDays, type IsoDate } from "@/lib/tresbe-budget/dates";

// Mismo lenguaje visual que el PDF de nómina de Tresbe.
const WIDTH = 792;
const HEIGHT = 612;
const MARGIN = 36;
const NAVY = rgb(0.055, 0.12, 0.2);
const RED = rgb(0.72, 0.12, 0.14);
const MUTED = rgb(0.38, 0.42, 0.47);
const BORDER = rgb(0.82, 0.84, 0.87);
const ALT = rgb(0.965, 0.97, 0.975);
const GREEN = rgb(0.05, 0.42, 0.28);
const AMBER = rgb(0.996, 0.98, 0.93);

const printable = (value: string) =>
  value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^ -ÿ]/g, "?");

/** Los ceros se imprimen como guion, igual que en la planilla original. */
const num = (value: number) =>
  value === 0
    ? "-"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const money = (value: number | null | undefined) =>
  value == null
    ? "-"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);

const dayFormat = new Intl.DateTimeFormat("es-PR", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateFormat = new Intl.DateTimeFormat("es-PR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const asDate = (value: IsoDate) => new Date(`${value}T12:00:00Z`);

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

function drawHeader(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  companyName: string,
  weekStart: IsoDate,
  weekNumber: number | null,
  subtitle: string,
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
  right(page, subtitle, bold, 11, WIDTH - MARGIN, HEIGHT - 40, rgb(1, 1, 1));
  page.drawText(`Empresa: ${printable(companyName)}`, {
    x: MARGIN,
    y: HEIGHT - 101,
    size: 9,
    font: regular,
    color: MUTED,
  });
  page.drawText(
    `Periodo: ${dateFormat.format(asDate(weekStart))} al ${dateFormat.format(
      asDate(addDays(weekStart, 6)),
    )}`,
    { x: 245, y: HEIGHT - 101, size: 9, font: regular, color: MUTED },
  );
  if (weekNumber != null) {
    right(
      page,
      `Semana ${weekNumber}`,
      bold,
      9,
      WIDTH - MARGIN,
      HEIGHT - 101,
      NAVY,
    );
  }
}

type GridRow = {
  label: string;
  budget: number[];
  real: number[];
  totals: { budget: number; real: number; variance: number };
  emphasis?: "subtotal" | "total";
};

const CATEGORY_WIDTH = 96;
const DAY_CELL = 34;
const WEEK_CELL = 49;

function drawGrid(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  yStart: number,
  dates: IsoDate[],
  rows: GridRow[],
) {
  const tableWidth =
    CATEGORY_WIDTH + dates.length * DAY_CELL * 2 + WEEK_CELL * 3;
  let y = yStart;

  // Cabecera de dos niveles: el día arriba, Ppto/Real abajo.
  page.drawRectangle({
    x: MARGIN,
    y: y - 26,
    width: tableWidth,
    height: 26,
    color: NAVY,
  });
  page.drawText("Categoria", {
    x: MARGIN + 4,
    y: y - 11,
    size: 6.6,
    font: bold,
    color: rgb(1, 1, 1),
  });
  let x = MARGIN + CATEGORY_WIDTH;
  for (const date of dates) {
    const label = fit(
      dayFormat.format(asDate(date)).replace(".", ""),
      bold,
      6.4,
      DAY_CELL * 2 - 4,
    );
    page.drawText(label, {
      x: x + (DAY_CELL * 2 - bold.widthOfTextAtSize(label, 6.4)) / 2,
      y: y - 10,
      size: 6.4,
      font: bold,
      color: rgb(1, 1, 1),
    });
    right(page, "Ppto", regular, 5.4, x + DAY_CELL - 3, y - 21, rgb(1, 1, 1));
    right(
      page,
      "Real",
      regular,
      5.4,
      x + DAY_CELL * 2 - 3,
      y - 21,
      rgb(1, 1, 1),
    );
    x += DAY_CELL * 2;
  }
  const weekLabel = "Semana";
  page.drawText(weekLabel, {
    x: x + (WEEK_CELL * 3 - bold.widthOfTextAtSize(weekLabel, 6.4)) / 2,
    y: y - 10,
    size: 6.4,
    font: bold,
    color: rgb(1, 1, 1),
  });
  for (const [index, label] of ["Ppto", "Real", "Desvio"].entries()) {
    right(
      page,
      label,
      regular,
      5.4,
      x + WEEK_CELL * (index + 1) - 3,
      y - 21,
      rgb(1, 1, 1),
    );
  }
  y -= 26;

  const rowHeight = 13;
  rows.forEach((row, index) => {
    const emphasised = row.emphasis != null;
    if (row.emphasis === "total") {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.9, 0.92, 0.94),
      });
    } else if (row.emphasis === "subtotal" || index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: ALT,
      });
    }
    const font = emphasised ? bold : regular;
    const size = 6;
    const baseline = y - rowHeight + 4.4;
    page.drawText(fit(row.label, font, 6.4, CATEGORY_WIDTH - 6), {
      x: MARGIN + 4,
      y: baseline,
      size: 6.4,
      font,
      color: NAVY,
    });
    let cellX = MARGIN + CATEGORY_WIDTH;
    for (let day = 0; day < row.budget.length; day += 1) {
      right(
        page,
        num(row.budget[day]),
        font,
        size,
        cellX + DAY_CELL - 3,
        baseline,
        MUTED,
      );
      right(
        page,
        num(row.real[day]),
        font,
        size,
        cellX + DAY_CELL * 2 - 3,
        baseline,
      );
      cellX += DAY_CELL * 2;
    }
    right(
      page,
      num(row.totals.budget),
      font,
      size,
      cellX + WEEK_CELL - 3,
      baseline,
      MUTED,
    );
    right(
      page,
      num(row.totals.real),
      font,
      size,
      cellX + WEEK_CELL * 2 - 3,
      baseline,
    );
    right(
      page,
      num(row.totals.variance),
      font,
      size,
      cellX + WEEK_CELL * 3 - 3,
      baseline,
      row.totals.variance < -0.004
        ? RED
        : row.totals.variance > 0.004
          ? GREEN
          : MUTED,
    );
    page.drawLine({
      start: { x: MARGIN, y: y - rowHeight },
      end: { x: MARGIN + tableWidth, y: y - rowHeight },
      thickness: 0.25,
      color: BORDER,
    });
    y -= rowHeight;
  });
  return y;
}

function drawKeyValueBlock(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  x: number,
  yStart: number,
  width: number,
  title: string,
  columns: string[],
  rows: Array<{ label: string; values: string[]; strong?: boolean }>,
) {
  page.drawText(printable(title), {
    x,
    y: yStart,
    size: 8.5,
    font: bold,
    color: NAVY,
  });
  let y = yStart - 12;
  const valueWidth = 72;
  columns.forEach((column, index) => {
    right(
      page,
      column,
      regular,
      6,
      x + width - valueWidth * (columns.length - 1 - index),
      y,
      MUTED,
    );
  });
  y -= 3;
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 0.5,
    color: BORDER,
  });
  for (const row of rows) {
    y -= 12;
    const font = row.strong ? bold : regular;
    page.drawText(
      fit(row.label, font, 7, width - valueWidth * columns.length),
      {
        x,
        y,
        size: 7,
        font,
        color: NAVY,
      },
    );
    row.values.forEach((value, index) => {
      right(
        page,
        value,
        font,
        7,
        x + width - valueWidth * (row.values.length - 1 - index),
        y,
        row.strong ? NAVY : MUTED,
      );
    });
  }
  return y;
}

function drawHorizonPage(
  pdf: PDFDocument,
  bold: PDFFont,
  regular: PDFFont,
  companyName: string,
  weekStart: IsoDate,
  weekNumber: number | null,
  weeks: number,
  rows: HorizonRow[],
) {
  const page = pdf.addPage([WIDTH, HEIGHT]);
  drawHeader(
    page,
    bold,
    regular,
    companyName,
    weekStart,
    weekNumber,
    "PRESUPUESTO TRESBE - RESUMEN",
  );
  page.drawText(`RESUMEN DE ${weeks} SEMANAS`, {
    x: MARGIN,
    y: HEIGHT - 128,
    size: 10,
    font: bold,
    color: NAVY,
  });
  page.drawText(
    "Totales operativos. El movimiento de linea de reserva se informa aparte y no entra en ingresos ni egresos.",
    { x: MARGIN, y: HEIGHT - 141, size: 7, font: regular, color: MUTED },
  );

  const columns: Array<{ label: string; width: number }> = [
    { label: "Semana", width: 116 },
    { label: "Ing. Ppto", width: 72 },
    { label: "Ing. Real", width: 72 },
    { label: "Desvio", width: 66 },
    { label: "Egr. Ppto", width: 72 },
    { label: "Egr. Real", width: 72 },
    { label: "Desvio", width: 66 },
    { label: "Flujo Ppto", width: 72 },
    { label: "Flujo Real", width: 72 },
    { label: "Desvio", width: 60 },
  ];
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  let y = HEIGHT - 156;
  page.drawRectangle({
    x: MARGIN,
    y: y - 16,
    width: tableWidth,
    height: 16,
    color: NAVY,
  });
  let x = MARGIN;
  columns.forEach((column, index) => {
    if (index === 0) {
      page.drawText(column.label, {
        x: x + 4,
        y: y - 11,
        size: 6.6,
        font: bold,
        color: rgb(1, 1, 1),
      });
    } else {
      right(
        page,
        column.label,
        bold,
        6.6,
        x + column.width - 4,
        y - 11,
        rgb(1, 1, 1),
      );
    }
    x += column.width;
  });
  y -= 16;

  for (const [index, row] of rows.entries()) {
    const height = 14;
    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - height,
        width: tableWidth,
        height,
        color: ALT,
      });
    }
    const baseline = y - height + 4.6;
    const empty = !row.hasBudget && !row.hasReal;
    page.drawText(
      fit(
        `S${row.weekNumber}  ${dateFormat.format(asDate(row.weekStart))}`,
        regular,
        6.6,
        columns[0].width - 8,
      ),
      { x: MARGIN + 4, y: baseline, size: 6.6, font: regular, color: NAVY },
    );
    const values: Array<{ text: string; color?: typeof NAVY }> = [
      { text: num(row.income.budget), color: MUTED },
      { text: num(row.income.real) },
      {
        text: num(row.income.variance),
        color: row.income.variance < -0.004 ? RED : GREEN,
      },
      { text: num(row.expenses.budget), color: MUTED },
      { text: num(row.expenses.real) },
      {
        text: num(row.expenses.variance),
        color: row.expenses.variance < -0.004 ? RED : GREEN,
      },
      { text: num(row.net.budget), color: MUTED },
      { text: num(row.net.real) },
      {
        text: num(row.net.variance),
        color: row.net.variance < -0.004 ? RED : GREEN,
      },
    ];
    let cellX = MARGIN + columns[0].width;
    values.forEach((value, index_) => {
      const column = columns[index_ + 1];
      right(
        page,
        empty ? "-" : value.text,
        regular,
        6.6,
        cellX + column.width - 4,
        baseline,
        empty ? BORDER : (value.color ?? NAVY),
      );
      cellX += column.width;
    });
    page.drawLine({
      start: { x: MARGIN, y: y - height },
      end: { x: MARGIN + tableWidth, y: y - height },
      thickness: 0.25,
      color: BORDER,
    });
    y -= height;
  }

  const totals = rows.reduce(
    (accumulator, row) => ({
      incomeBudget: accumulator.incomeBudget + row.income.budget,
      incomeReal: accumulator.incomeReal + row.income.real,
      expenseBudget: accumulator.expenseBudget + row.expenses.budget,
      expenseReal: accumulator.expenseReal + row.expenses.real,
    }),
    { incomeBudget: 0, incomeReal: 0, expenseBudget: 0, expenseReal: 0 },
  );
  page.drawRectangle({
    x: MARGIN,
    y: y - 15,
    width: tableWidth,
    height: 15,
    color: rgb(0.9, 0.92, 0.94),
  });
  const baseline = y - 15 + 4.8;
  page.drawText("Total del horizonte", {
    x: MARGIN + 4,
    y: baseline,
    size: 6.8,
    font: bold,
    color: NAVY,
  });
  const netBudget = totals.incomeBudget - totals.expenseBudget;
  const netReal = totals.incomeReal - totals.expenseReal;
  const footer = [
    num(totals.incomeBudget),
    num(totals.incomeReal),
    num(totals.incomeReal - totals.incomeBudget),
    num(totals.expenseBudget),
    num(totals.expenseReal),
    num(totals.expenseBudget - totals.expenseReal),
    num(netBudget),
    num(netReal),
    num(netReal - netBudget),
  ];
  let footerX = MARGIN + columns[0].width;
  footer.forEach((value, index) => {
    const column = columns[index + 1];
    right(page, value, bold, 6.8, footerX + column.width - 4, baseline);
    footerX += column.width;
  });
}

export async function buildTresbeBudgetPdf(params: {
  companyName: string;
  weekStart: IsoDate;
  weekNumber: number | null;
  view: WeekView;
  horizon?: { weeks: number; rows: HorizonRow[] };
}): Promise<Uint8Array> {
  const { view } = params;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Presupuesto Tresbe ${params.weekStart}`);
  pdf.setAuthor("Sinexia OS");
  pdf.setSubject("Presupuesto semanal vs real - Tresbe");

  const page = pdf.addPage([WIDTH, HEIGHT]);
  drawHeader(
    page,
    bold,
    regular,
    params.companyName,
    params.weekStart,
    params.weekNumber,
    "PRESUPUESTO SEMANAL TRESBE",
  );

  page.drawText("RESUMEN DE LA SEMANA", {
    x: MARGIN,
    y: HEIGHT - 126,
    size: 10,
    font: bold,
    color: NAVY,
  });
  const summary: Array<[string, string, "normal" | "total"]> = [
    ["Ingresos ppto", money(view.income.totals.budget), "normal"],
    ["Ingresos real", money(view.income.totals.real), "normal"],
    ["Egresos ppto", money(view.expenses.totals.budget), "normal"],
    ["Egresos real", money(view.expenses.totals.real), "normal"],
    ["Flujo neto real", money(view.net.totals.real), "normal"],
    ["Intercompany", money(view.intercompany.netReal), "normal"],
    ["Linea de credito", money(view.financing.netReal), "normal"],
    ["SALDO FINAL TEORICO", money(view.cash.theoreticalReal), "total"],
  ];
  const summaryY = HEIGHT - 142;
  summary.forEach(([label, value, kind], index) => {
    const cellWidth = (WIDTH - MARGIN * 2) / summary.length;
    const x = MARGIN + index * cellWidth;
    page.drawText(fit(label, bold, 6.2, cellWidth - 4), {
      x,
      y: summaryY,
      size: 6.2,
      font: bold,
      color: MUTED,
    });
    page.drawText(value, {
      x,
      y: summaryY - 13,
      size: kind === "total" ? 10 : 8,
      font: bold,
      color: kind === "total" ? RED : NAVY,
    });
  });

  page.drawText("SEGUIMIENTO DIARIO -- PRESUPUESTADO VS REAL", {
    x: MARGIN,
    y: summaryY - 34,
    size: 9,
    font: bold,
    color: NAVY,
  });
  page.drawText(
    "Desvio favorable en positivo: en ingresos Real - Presupuesto; en egresos Presupuesto - Real. Importes en US$.",
    { x: MARGIN, y: summaryY - 44, size: 6.5, font: regular, color: MUTED },
  );

  const byGroup = (group: string) =>
    view.rows.filter((row) => row.category.total_group === group);
  const toRow = (
    label: string,
    cells: { budget: number[]; real: number[] },
    totals: GridRow["totals"],
    emphasis?: GridRow["emphasis"],
  ): GridRow => ({ label, ...cells, totals, emphasis });
  const categoryRow = (row: (typeof view.rows)[number]) =>
    toRow(
      row.category.name,
      {
        budget: row.cells.map((cell) => cell.budget),
        real: row.cells.map((cell) => cell.real),
      },
      row.totals,
    );
  const groupRow = (group: typeof view.income, emphasis: GridRow["emphasis"]) =>
    toRow(
      group.label,
      {
        budget: group.cells.map((cell) => cell.budget),
        real: group.cells.map((cell) => cell.real),
      },
      group.totals,
      emphasis,
    );

  const rows: GridRow[] = [
    ...byGroup("ingresos").map(categoryRow),
    groupRow(view.income, "subtotal"),
    ...byGroup("proveedores_compras").map(categoryRow),
    ...(byGroup("proveedores_compras").length > 1
      ? [
          groupRow(
            view.expenseSubtotals.find(
              (item) => item.key === "proveedores_compras",
            )!,
            "subtotal",
          ),
        ]
      : []),
    ...byGroup("nomina").map(categoryRow),
    ...byGroup("payroll_taxes").map(categoryRow),
    ...byGroup("debitos_bancarios").map(categoryRow),
    groupRow(view.expenses, "subtotal"),
    groupRow(view.net, "total"),
    // Fuera de los totales operativos, pero se imprimen igual porque mueven la
    // caja de la semana.
    ...view.intercompanyRows.map(categoryRow),
    ...view.financingRows.map(categoryRow),
    ...view.externoRows.map(categoryRow),
  ];

  drawGrid(page, bold, regular, summaryY - 52, view.dates, rows);

  // Control de Caja va en su propia página: la cuadrícula diaria más el
  // puente de caja y sus recuadros ya no entraban proporcionados en una sola.
  const cashPage = pdf.addPage([WIDTH, HEIGHT]);
  drawHeader(
    cashPage,
    bold,
    regular,
    params.companyName,
    params.weekStart,
    params.weekNumber,
    "PRESUPUESTO TRESBE - CONTROL DE CAJA",
  );
  const y = HEIGHT - 140;
  const cashBottom = drawKeyValueBlock(
    cashPage,
    bold,
    regular,
    MARGIN,
    y,
    348,
    "CONTROL DE CAJA",
    ["Presupuesto", "Real"],
    [
      {
        label: "Saldo Banco Inicial",
        values: [money(view.cash.opening), money(view.cash.opening)],
      },
      {
        label: "+ Flujo Neto Operativo BANCO",
        values: [
          money(view.net.totals.budget),
          money(view.cash.bankOperatingReal),
        ],
      },
      {
        label: "+ Mov. Neto Intercompany",
        values: [
          money(view.intercompany.netBudget),
          money(view.intercompany.netReal),
        ],
      },
      {
        label: "+ Financiamiento Externo Neto",
        values: [
          money(view.financingExterno.netBudget),
          money(view.financingExterno.netReal),
        ],
      },
      {
        label: "+/- Transferencia Interna",
        values: ["-", money(view.cash.transferNetReal)],
      },
      {
        label: "= Saldo antes de Financiamiento",
        values: [
          money(view.cash.beforeFinancingBudget),
          money(view.cash.beforeFinancingReal),
        ],
        strong: true,
      },
      {
        label: "+ Utilizacion Linea de Credito",
        values: [money(0), money(view.financing.drawdown)],
      },
      {
        label: "- Repago Linea de Credito",
        values: [money(0), money(view.financing.repayment)],
      },
      {
        label: "= Saldo Final Banco Teorico",
        values: [
          money(view.cash.theoreticalBudget),
          money(view.cash.theoreticalReal),
        ],
        strong: true,
      },
      {
        label: "Saldo Banco Real (manual)",
        values: ["-", money(view.cash.actual)],
      },
      {
        label: "Diferencia a Conciliar",
        values: ["-", money(view.cash.differenceToReconcile)],
      },
      {
        label: "Excedente / Necesidad",
        values: [money(view.cash.surplusBudget), money(view.cash.surplusReal)],
        strong: true,
      },
    ],
  );

  // Intercompany y línea de crédito van en su propio recuadro: no son
  // resultado operativo, pero sin ellos el saldo no cuadra contra el banco.
  const sideX = MARGIN + 396;
  const sideWidth = WIDTH - MARGIN - sideX;
  cashPage.drawRectangle({
    x: sideX - 8,
    y: y - 150,
    width: sideWidth + 16,
    height: 162,
    color: AMBER,
    borderColor: rgb(0.85, 0.72, 0.36),
    borderWidth: 0.5,
  });
  drawKeyValueBlock(
    cashPage,
    bold,
    regular,
    sideX,
    y,
    sideWidth,
    "LINEA DE CREDITO",
    ["Semana"],
    [
      {
        label: "Saldo inicial",
        values: [money(view.financing.creditLineOpening)],
      },
      { label: "Utilizacion", values: [money(view.financing.drawdown)] },
      { label: "Repago", values: [money(view.financing.repayment)] },
      {
        label: "Saldo final",
        values: [money(view.financing.creditLineClosing)],
        strong: true,
      },
    ],
  );

  const interY = y - 78;
  cashPage.drawText("CONTROL INTERCOMPANY", {
    x: sideX,
    y: interY,
    size: 8.5,
    font: bold,
    color: NAVY,
  });
  let interRow = interY - 11;
  cashPage.drawText("LLC", {
    x: sideX,
    y: interRow,
    size: 6,
    font: regular,
    color: MUTED,
  });
  right(
    cashPage,
    "Recibido",
    regular,
    6,
    sideX + sideWidth - 72,
    interRow,
    MUTED,
  );
  right(cashPage, "Saldo", regular, 6, sideX + sideWidth, interRow, MUTED);
  interRow -= 3;
  cashPage.drawLine({
    start: { x: sideX, y: interRow },
    end: { x: sideX + sideWidth, y: interRow },
    thickness: 0.5,
    color: BORDER,
  });
  const balances = view.intercompany.counterparties.filter(
    (row) => row.opening !== 0 || row.received !== 0 || row.delivered !== 0,
  );
  if (balances.length === 0) {
    interRow -= 12;
    cashPage.drawText("Sin movimientos en la semana.", {
      x: sideX,
      y: interRow,
      size: 6.5,
      font: regular,
      color: MUTED,
    });
  }
  for (const row of balances) {
    interRow -= 12;
    cashPage.drawText(fit(row.name, regular, 7, sideWidth - 150), {
      x: sideX,
      y: interRow,
      size: 7,
      font: regular,
      color: NAVY,
    });
    right(
      cashPage,
      money(row.received),
      regular,
      7,
      sideX + sideWidth - 72,
      interRow,
    );
    right(cashPage, money(row.closing), bold, 7, sideX + sideWidth, interRow);
  }
  if (view.cash.notes) {
    cashPage.drawText(fit(view.cash.notes, regular, 6.2, sideWidth), {
      x: sideX,
      y: y - 144,
      size: 6.2,
      font: regular,
      color: MUTED,
    });
  }

  // Liquidez combinada (banco + cash), igual que el cuadro de la planilla.
  const liquidityBottom = drawKeyValueBlock(
    cashPage,
    bold,
    regular,
    MARGIN,
    cashBottom - 20,
    348,
    "LIQUIDEZ TOTAL AL CIERRE",
    ["Banco", "Cash", "Total"],
    [
      {
        label: "Saldo Final Teorico",
        values: [
          money(view.cash.theoreticalReal),
          money(view.cash.cashAccount.theoreticalReal),
          money(
            view.cash.theoreticalReal + view.cash.cashAccount.theoreticalReal,
          ),
        ],
      },
      {
        label: "Saldo Real / Contado",
        values: [
          money(view.cash.actual),
          money(view.cash.cashAccount.actual),
          view.cash.actual == null || view.cash.cashAccount.actual == null
            ? "-"
            : money(view.cash.actual + view.cash.cashAccount.actual),
        ],
      },
      {
        label: "Diferencia Total",
        values: [
          money(view.cash.differenceToReconcile),
          money(view.cash.cashAccount.differenceToReconcile),
          view.cash.differenceToReconcile == null ||
          view.cash.cashAccount.differenceToReconcile == null
            ? "-"
            : money(
                view.cash.differenceToReconcile +
                  view.cash.cashAccount.differenceToReconcile,
              ),
        ],
        strong: true,
      },
    ],
  );

  // CONTROL DIARIO CASH / CAJA: mismo desglose día por día que trajo la v5,
  // con el saldo encadenado (el cierre de un día es el inicio del siguiente).
  const dailyCashColumns = view.dates.map((date) =>
    dayFormat.format(asDate(date)).replace(".", ""),
  );
  const dailyCashRows: Array<{
    label: string;
    pick: (day: WeekView["cash"]["cashAccount"]["days"][number]) => number;
    strong?: boolean;
  }> = [
    { label: "Saldo Inicial Cash", pick: (day) => day.opening },
    { label: "+ Ingresos Operativos Cash", pick: (day) => day.income },
    { label: "- Egresos Operativos Cash", pick: (day) => day.expense },
    {
      label: "+ Mov. Neto Intercompany",
      pick: (day) => day.intercompanyNet,
    },
    {
      label: "+ Financ. Externo Neto Cash",
      pick: (day) => day.externoNet,
    },
    {
      label: "+ Transferencias Banco -> Cash",
      pick: (day) => day.transferIn,
    },
    { label: "- Depositos Cash -> Banco", pick: (day) => day.transferOut },
    {
      label: "= Saldo Final Cash Teorico",
      pick: (day) => day.closing,
      strong: true,
    },
  ];
  drawKeyValueBlock(
    cashPage,
    bold,
    regular,
    MARGIN,
    liquidityBottom - 20,
    WIDTH - MARGIN * 2,
    "CONTROL DIARIO CASH / CAJA",
    dailyCashColumns,
    dailyCashRows.map((row) => ({
      label: row.label,
      values: view.cash.cashAccount.days.map((day) => money(row.pick(day))),
      strong: row.strong,
    })),
  );

  if (params.horizon && params.horizon.rows.length) {
    drawHorizonPage(
      pdf,
      bold,
      regular,
      params.companyName,
      params.weekStart,
      params.weekNumber,
      params.horizon.weeks,
      params.horizon.rows,
    );
  }

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText(
      `Sinexia OS - Tresbe - Pagina ${index + 1} de ${pages.length}`,
      { x: MARGIN, y: 20, size: 7.5, font: regular, color: MUTED },
    );
    right(
      current,
      "Preparacion administrativa de presupuesto; no es software contable.",
      regular,
      7,
      WIDTH - MARGIN,
      20,
      MUTED,
    );
  });
  return pdf.save();
}
