// Resaltado amarillo de la portada del "Paquete para el dueño". Puro
// respecto de pdf-lib: recibe la página y la fuente ya embebidas por el
// llamador, dibuja rectángulos semitransparentes ENCIMA del texto ya
// copiado (nunca lo reescribe ni lo borra) -- por eso el texto extraíble
// de la página no cambia un carácter.
//
// Coordenadas fijas a la página 3 (la portada -- "CONSOLIDATED REPORT",
// la última del documento, movida al frente del Paquete para el dueño)
// de buildConsolidatedPdf (src/lib/cutmeat-daily/pdf.ts): MARGIN=36,
// value en "key: value" dibujado con right-align a x_end=MARGIN+260,
// tamaño 9, bold. Si ese layout cambia, estas constantes se tienen que
// actualizar junto con él.

import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

export type HighlightTarget = {
  key: string;
  label: string;
  /** Borde derecho del valor (right-aligned), en puntos. */
  xEnd: number;
  /** Línea base del texto, en puntos. */
  y: number;
  fontSize: number;
};

/**
 * Lista configurable de qué cifras se resaltan -- un solo lugar para
 * cambiarla (todavía falta confirmar con María cuáles resalta el dueño).
 * Por defecto: Total First Bank Accounts, Aging Vendors - Consolidated
 * Total, Aging Customers - Consolidated Total.
 */
export const DEFAULT_PACKAGE_HIGHLIGHTS: HighlightTarget[] = [
  { key: "first_bank_accounts", label: "Total First Bank Accounts", xEnd: 296, y: 452, fontSize: 9 },
  {
    key: "aging_vendors_consolidated",
    label: "Aging Vendors - Consolidated Total",
    xEnd: 296,
    y: 379,
    fontSize: 9,
  },
  {
    key: "aging_customers_consolidated",
    label: "Aging Customers - Consolidated Total",
    xEnd: 296,
    y: 306,
    fontSize: 9,
  },
];

const YELLOW = rgb(1, 0.92, 0.23);

/**
 * Dibuja un rectángulo amarillo semitransparente detrás de cada cifra
 * configurada, del ancho exacto del texto (+ relleno) para no tapar
 * números vecinos ni el propio número. `values` es el texto EXACTO tal
 * como se dibujó en el PDF (mismo formato de moneda) para cada `key`;
 * una `key` sin valor en el mapa se omite en silencio.
 */
export function applyHighlights(
  page: PDFPage,
  font: PDFFont,
  values: Record<string, string>,
  targets: HighlightTarget[] = DEFAULT_PACKAGE_HIGHLIGHTS,
): void {
  for (const target of targets) {
    const text = values[target.key];
    if (text == null) continue;
    const width = font.widthOfTextAtSize(text, target.fontSize);
    page.drawRectangle({
      x: target.xEnd - width - 4,
      y: target.y - 3,
      width: width + 8,
      height: target.fontSize + 6,
      color: YELLOW,
      opacity: 0.45,
    });
  }
}
