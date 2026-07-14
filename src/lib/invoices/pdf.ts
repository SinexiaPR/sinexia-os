import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

import type { BillingSettings, Invoice, InvoiceItem } from "@/types/invoices";

const WIDTH = 612;
const HEIGHT = 792;
const MARGIN = 42;
const NAVY = rgb(0.055, 0.12, 0.2);
const BLUE = rgb(0.12, 0.3, 0.55);
const MUTED = rgb(0.39, 0.43, 0.49);
const BORDER = rgb(0.84, 0.86, 0.89);
const PALE = rgb(0.965, 0.975, 0.99);

const clean = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\u0020-\u00ff]/g, "?");

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value));

const date = (value: string | null, language: "es" | "en") =>
  value
    ? new Intl.DateTimeFormat(language === "es" ? "es-PR" : "en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T12:00:00Z`))
    : "-";

function fit(value: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = clean(value);
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;
  let result = normalized;
  while (
    result.length > 1 &&
    font.widthOfTextAtSize(`${result}...`, size) > maxWidth
  )
    result = result.slice(0, -1);
  return `${result.trim()}...`;
}

function drawInvoiceHeader(params: {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  invoice: Invoice;
  settings: BillingSettings;
  logo?: PDFImage;
  continuation?: boolean;
}) {
  const { page, regular, bold, invoice, settings } = params;
  if (params.logo) {
    const scale = Math.min(110 / params.logo.width, 40 / params.logo.height, 1);
    page.drawImage(params.logo, {
      x: MARGIN,
      y: 716,
      width: params.logo.width * scale,
      height: params.logo.height * scale,
    });
  } else {
    page.drawText(
      clean(settings.issuer_display_name || "Sinexia").toUpperCase(),
      {
        x: MARGIN,
        y: 735,
        size: 22,
        font: bold,
        color: NAVY,
      },
    );
    page.drawRectangle({
      x: MARGIN,
      y: 724,
      width: 86,
      height: 3,
      color: BLUE,
    });
  }
  page.drawText(params.continuation ? "FACTURA · CONTINUACIÓN" : "FACTURA", {
    x: 390,
    y: 728,
    size: params.continuation ? 15 : 24,
    font: bold,
    color: NAVY,
  });
  page.drawText(`#${invoice.invoice_number ?? "BORRADOR"}`, {
    x: 447,
    y: 704,
    size: 12,
    font: bold,
    color: BLUE,
  });
  const issuerAddress = [
    settings.address_line_1,
    settings.address_line_2,
    [settings.city, settings.region, settings.postal_code]
      .filter(Boolean)
      .join(", "),
    settings.contact_email,
    settings.phone,
  ].filter(Boolean) as string[];
  issuerAddress.slice(0, 4).forEach((line, index) =>
    page.drawText(clean(line), {
      x: MARGIN,
      y: 707 - index * 11,
      size: 8,
      font: regular,
      color: MUTED,
    }),
  );
}

function drawItems(params: {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  items: InvoiceItem[];
  currency: string;
  startY: number;
}) {
  const { page, regular, bold, items, currency } = params;
  let y = params.startY;
  page.drawRectangle({
    x: MARGIN,
    y: y - 22,
    width: 528,
    height: 22,
    color: NAVY,
  });
  const columns = [
    { x: MARGIN + 8, label: "Cantidad" },
    { x: MARGIN + 82, label: "Descripción" },
    { x: MARGIN + 356, label: "Precio" },
    { x: MARGIN + 446, label: "Importe" },
  ];
  columns.forEach((column) =>
    page.drawText(column.label, {
      x: column.x,
      y: y - 15,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    }),
  );
  y -= 22;
  items.forEach((item, index) => {
    const rowHeight = 28;
    if (index % 2 === 0)
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: 528,
        height: rowHeight,
        color: PALE,
      });
    page.drawText(
      Number(item.quantity).toLocaleString("en-US", {
        maximumFractionDigits: 4,
      }),
      {
        x: MARGIN + 8,
        y: y - 18,
        size: 8,
        font: regular,
        color: NAVY,
      },
    );
    page.drawText(fit(item.description, regular, 8, 260), {
      x: MARGIN + 82,
      y: y - 18,
      size: 8,
      font: regular,
      color: NAVY,
    });
    page.drawText(money(item.unit_price, currency), {
      x: MARGIN + 356,
      y: y - 18,
      size: 8,
      font: regular,
      color: NAVY,
    });
    page.drawText(money(item.amount, currency), {
      x: MARGIN + 446,
      y: y - 18,
      size: 8,
      font: bold,
      color: NAVY,
    });
    page.drawLine({
      start: { x: MARGIN, y: y - rowHeight },
      end: { x: 570, y: y - rowHeight },
      thickness: 0.4,
      color: BORDER,
    });
    y -= rowHeight;
  });
  return y;
}

export async function buildInvoicePdf(params: {
  invoice: Invoice;
  items: InvoiceItem[];
  settings: BillingSettings;
  logoBytes?: Uint8Array;
  signatureBytes?: Uint8Array;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const embedImage = async (bytes?: Uint8Array) => {
    if (!bytes) return undefined;
    try {
      return await pdf.embedPng(bytes);
    } catch {
      return pdf.embedJpg(bytes);
    }
  };
  const logo = await embedImage(params.logoBytes);
  const signature = await embedImage(params.signatureBytes);
  const language = params.invoice.language;
  const chunks: InvoiceItem[][] = [];
  for (let i = 0; i < params.items.length; i += 12)
    chunks.push(params.items.slice(i, i + 12));
  if (!chunks.length) chunks.push([]);

  chunks.forEach((items, pageIndex) => {
    const page = pdf.addPage([WIDTH, HEIGHT]);
    drawInvoiceHeader({
      page,
      regular,
      bold,
      invoice: params.invoice,
      settings: params.settings,
      logo,
      continuation: pageIndex > 0,
    });
    let y = 635;
    if (pageIndex === 0) {
      page.drawText(language === "es" ? "FACTURAR A" : "BILL TO", {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: BLUE,
      });
      page.drawText(clean(params.invoice.billing_name_snapshot), {
        x: MARGIN,
        y: y - 18,
        size: 11,
        font: bold,
        color: NAVY,
      });
      const billingLines = [
        params.invoice.billing_contact_snapshot,
        params.invoice.billing_address_snapshot,
        params.invoice.billing_email_snapshot,
      ].filter(Boolean) as string[];
      billingLines.slice(0, 3).forEach((line, index) =>
        page.drawText(fit(line, regular, 8, 280), {
          x: MARGIN,
          y: y - 34 - index * 11,
          size: 8,
          font: regular,
          color: MUTED,
        }),
      );
      const dateLabels =
        language === "es"
          ? ["Fecha de factura", "Fecha de vencimiento", "Referencia"]
          : ["Invoice date", "Due date", "Reference"];
      const dateValues = [
        date(params.invoice.invoice_date, language),
        date(params.invoice.due_date, language),
        params.invoice.purchase_order_reference || "-",
      ];
      dateLabels.forEach((label, index) => {
        page.drawText(label, {
          x: 382,
          y: y - index * 25,
          size: 7,
          font: bold,
          color: MUTED,
        });
        page.drawText(clean(dateValues[index]), {
          x: 482,
          y: y - index * 25,
          size: 8,
          font: regular,
          color: NAVY,
        });
      });
      y -= 92;
    }
    y = drawItems({
      page,
      regular,
      bold,
      items,
      currency: params.invoice.currency,
      startY: y,
    });

    if (pageIndex === chunks.length - 1) {
      const totals = [
        [language === "es" ? "Subtotal" : "Subtotal", params.invoice.subtotal],
        [
          language === "es" ? "Descuento" : "Discount",
          -params.invoice.discount_amount,
        ],
        [language === "es" ? "Impuesto" : "Tax", params.invoice.tax_amount],
        [language === "es" ? "TOTAL" : "TOTAL", params.invoice.total],
      ] as const;
      const totalsY = Math.max(160, y - 18);
      totals.forEach(([label, value], index) => {
        const rowY = totalsY - index * 21;
        page.drawText(label, {
          x: 390,
          y: rowY,
          size: index === 3 ? 11 : 8,
          font: bold,
          color: index === 3 ? NAVY : MUTED,
        });
        page.drawText(money(value, params.invoice.currency), {
          x: 480,
          y: rowY,
          size: index === 3 ? 12 : 8,
          font: bold,
          color: index === 3 ? BLUE : NAVY,
        });
      });

      const paymentY = 130;
      page.drawText(language === "es" ? "MÉTODO DE PAGO" : "PAYMENT METHOD", {
        x: MARGIN,
        y: paymentY,
        size: 8,
        font: bold,
        color: BLUE,
      });
      const paymentLines = [
        params.settings.payment_method_label,
        params.settings.bank_account_name,
        params.settings.bank_account_number
          ? `Cuenta: ${params.settings.bank_account_number}`
          : null,
        params.settings.routing_number
          ? `Routing: ${params.settings.routing_number}`
          : null,
      ].filter(Boolean) as string[];
      paymentLines.slice(0, 4).forEach((line, index) =>
        page.drawText(fit(line, regular, 8, 300), {
          x: MARGIN,
          y: paymentY - 15 - index * 11,
          size: 8,
          font: regular,
          color: NAVY,
        }),
      );
      page.drawText(
        clean(
          params.invoice.client_note ||
            params.settings.default_footer ||
            (language === "es"
              ? "Gracias por su confianza."
              : "Thank you for your trust."),
        ),
        { x: MARGIN, y: 48, size: 8, font: regular, color: MUTED },
      );
      if (signature) {
        const scale = Math.min(120 / signature.width, 35 / signature.height, 1);
        page.drawImage(signature, {
          x: 390,
          y: 75,
          width: signature.width * scale,
          height: signature.height * scale,
        });
      } else if (params.settings.signature_text)
        page.drawText(clean(params.settings.signature_text), {
          x: 390,
          y: 86,
          size: 9,
          font: bold,
          color: NAVY,
        });
    }
    page.drawText(`${pageIndex + 1}/${chunks.length}`, {
      x: 540,
      y: 24,
      size: 7,
      font: regular,
      color: MUTED,
    });
  });
  pdf.setTitle(`Factura ${params.invoice.invoice_number ?? "borrador"}`);
  pdf.setAuthor(params.settings.issuer_display_name || "Sinexia");
  return pdf.save();
}
