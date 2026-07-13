import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { calculatePayrollEntry } from "@/lib/payroll/calculations";

export type PayrollPdfEntry = {
  employee_name_snapshot: string;
  section_snapshot: string;
  compensation_type_snapshot:
    "hourly" | "hourly_training" | "fixed_weekly" | null;
  regular_rate_snapshot: number | null;
  training_rate_snapshot: number | null;
  fixed_salary_snapshot: number | null;
  regular_hours: number;
  training_hours: number;
  other_payments: number;
  comment: string | null;
};

export type PayrollPdfData = {
  companyName: string;
  weekStart: string;
  weekEnd: string;
  status: "submitted" | "approved";
  submittedAt: string | null;
  entries: PayrollPdfEntry[];
};

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 36;
const NAVY = rgb(0.055, 0.12, 0.2);
const RED = rgb(0.72, 0.12, 0.14);
const MUTED = rgb(0.38, 0.42, 0.47);
const BORDER = rgb(0.82, 0.84, 0.87);
const ROW_ALT = rgb(0.965, 0.97, 0.975);

function printable(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\u0020-\u00ff]/g, "?");
}

function date(value: string) {
  return new Intl.DateTimeFormat("es-PR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function money(value: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function number(value: number) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fitText(value: string, font: PDFFont, size: number, width: number) {
  const clean = printable(value);
  if (font.widthOfTextAtSize(clean, size) <= width) return clean;
  let shortened = clean;
  while (
    shortened.length > 1 &&
    font.widthOfTextAtSize(`${shortened}...`, size) > width
  ) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}...`;
}

function wrapText(value: string, font: PDFFont, size: number, width: number) {
  const words = printable(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawHeader(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  data: PayrollPdfData,
  continuation = false,
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 72,
    width: PAGE_WIDTH,
    height: 72,
    color: NAVY,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 76,
    width: PAGE_WIDTH,
    height: 4,
    color: RED,
  });
  page.drawText("SINEXIA", {
    x: MARGIN,
    y: PAGE_HEIGHT - 42,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    continuation ? "NOMINA SEMANAL - CONTINUACION" : "NOMINA SEMANAL",
    {
      x: 500,
      y: PAGE_HEIGHT - 39,
      size: 12,
      font: bold,
      color: rgb(1, 1, 1),
    },
  );
  page.drawText(printable(data.companyName), {
    x: MARGIN,
    y: PAGE_HEIGHT - 104,
    size: 17,
    font: bold,
    color: NAVY,
  });
  page.drawText(`Semana: ${date(data.weekStart)} al ${date(data.weekEnd)}`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 123,
    size: 9.5,
    font: regular,
    color: MUTED,
  });
  page.drawText(
    `Estado: ${data.status === "approved" ? "Aprobada" : "Enviada"}`,
    {
      x: 550,
      y: PAGE_HEIGHT - 104,
      size: 9.5,
      font: bold,
      color: data.status === "approved" ? NAVY : RED,
    },
  );
  if (data.submittedAt) {
    const submitted = new Intl.DateTimeFormat("es-PR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Puerto_Rico",
    }).format(new Date(data.submittedAt));
    page.drawText(`Enviada: ${submitted}`, {
      x: 550,
      y: PAGE_HEIGHT - 123,
      size: 8.5,
      font: regular,
      color: MUTED,
    });
  }
}

export async function buildPayrollPdf(data: PayrollPdfData) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  document.setTitle(`Nomina ${data.companyName} ${data.weekStart}`);
  document.setAuthor("Sinexia OS");
  document.setSubject("Nomina semanal enviada");
  document.setCreator("Sinexia OS");

  const columns = [
    { label: "Empleado", width: 145, align: "left" },
    { label: "Seccion", width: 78, align: "left" },
    { label: "H. reg.", width: 48, align: "right" },
    { label: "Tarifa", width: 55, align: "right" },
    { label: "H. entr.", width: 48, align: "right" },
    { label: "T. entr.", width: 55, align: "right" },
    { label: "Fijo", width: 67, align: "right" },
    { label: "Otros", width: 67, align: "right" },
    { label: "Total", width: 73, align: "right" },
  ] as const;
  const rowsPerPage = 19;
  const chunks: PayrollPdfEntry[][] = [];
  for (let index = 0; index < data.entries.length; index += rowsPerPage) {
    chunks.push(data.entries.slice(index, index + rowsPerPage));
  }
  if (!chunks.length) chunks.push([]);

  chunks.forEach((entries, pageIndex) => {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, bold, regular, data, pageIndex > 0);
    let y = PAGE_HEIGHT - 158;
    page.drawRectangle({
      x: MARGIN,
      y: y - 20,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 20,
      color: NAVY,
    });
    let x = MARGIN;
    for (const column of columns) {
      const labelWidth = bold.widthOfTextAtSize(column.label, 7.5);
      page.drawText(column.label, {
        x: column.align === "right" ? x + column.width - labelWidth - 5 : x + 5,
        y: y - 14,
        size: 7.5,
        font: bold,
        color: rgb(1, 1, 1),
      });
      x += column.width;
    }
    y -= 20;

    entries.forEach((entry, rowIndex) => {
      const values = [
        entry.employee_name_snapshot,
        entry.section_snapshot,
        number(entry.regular_hours),
        money(entry.regular_rate_snapshot),
        number(entry.training_hours),
        money(entry.training_rate_snapshot),
        entry.compensation_type_snapshot === "fixed_weekly"
          ? money(entry.fixed_salary_snapshot)
          : "-",
        money(entry.other_payments),
        money(calculatePayrollEntry(entry)),
      ];
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - 19,
          width: PAGE_WIDTH - MARGIN * 2,
          height: 19,
          color: ROW_ALT,
        });
      }
      x = MARGIN;
      values.forEach((value, columnIndex) => {
        const column = columns[columnIndex];
        const text = fitText(String(value), regular, 7.4, column.width - 10);
        const textWidth = regular.widthOfTextAtSize(text, 7.4);
        page.drawText(text, {
          x:
            column.align === "right" ? x + column.width - textWidth - 5 : x + 5,
          y: y - 13,
          size: 7.4,
          font: regular,
          color: NAVY,
        });
        x += column.width;
      });
      page.drawLine({
        start: { x: MARGIN, y: y - 19 },
        end: { x: PAGE_WIDTH - MARGIN, y: y - 19 },
        thickness: 0.35,
        color: BORDER,
      });
      y -= 19;
    });

    const pageTotal = entries.reduce(
      (sum, entry) => sum + calculatePayrollEntry(entry),
      0,
    );
    page.drawText(
      pageIndex === chunks.length - 1 ? "TOTAL NOMINA" : "SUBTOTAL PAGINA",
      {
        x: 575,
        y: y - 22,
        size: 9,
        font: bold,
        color: NAVY,
      },
    );
    const totalValue =
      pageIndex === chunks.length - 1
        ? data.entries.reduce(
            (sum, entry) => sum + calculatePayrollEntry(entry),
            0,
          )
        : pageTotal;
    const totalText = money(totalValue);
    page.drawText(totalText, {
      x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(totalText, 12),
      y: y - 25,
      size: 12,
      font: bold,
      color: RED,
    });
  });

  const comments = data.entries.filter((entry) => entry.comment?.trim());
  if (comments.length) {
    let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, bold, regular, data, true);
    let y = PAGE_HEIGHT - 158;
    page.drawText("COMENTARIOS", {
      x: MARGIN,
      y,
      size: 11,
      font: bold,
      color: NAVY,
    });
    y -= 24;
    for (const entry of comments) {
      const lines = wrapText(
        entry.comment ?? "",
        regular,
        9,
        PAGE_WIDTH - MARGIN * 2 - 16,
      );
      const requiredHeight = 25 + lines.length * 13;
      if (y - requiredHeight < 42) {
        page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeader(page, bold, regular, data, true);
        y = PAGE_HEIGHT - 158;
      }
      page.drawText(printable(entry.employee_name_snapshot), {
        x: MARGIN,
        y,
        size: 9.5,
        font: bold,
        color: NAVY,
      });
      y -= 15;
      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN + 12,
          y,
          size: 9,
          font: regular,
          color: MUTED,
        });
        y -= 13;
      }
      y -= 10;
    }
  }

  const pages = document.getPages();
  pages.forEach((page, index) => {
    const footer = `Sinexia OS - ${printable(data.companyName)} - Pagina ${index + 1} de ${pages.length}`;
    page.drawText(footer, {
      x: MARGIN,
      y: 20,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    page.drawText(
      "Documento generado desde la nomina enviada; no es software contable.",
      {
        x: 475,
        y: 20,
        size: 7,
        font: regular,
        color: MUTED,
      },
    );
  });

  return document.save();
}
