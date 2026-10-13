// Renderiza una página de un PDF ya generado a PNG, para la portada
// descargable como imagen (WhatsApp). Una sola fuente de datos: SIEMPRE
// se rendimienta desde el PDF del paquete ya armado -- nunca se
// recalculan las cifras aparte, así que portada y PDF jamás pueden
// desalinearse.
//
// pdfjs-dist y @napi-rs/canvas ya eran dependencias transitivas de
// pdf-parse (usadas en src/lib/intelligence/extraction/pdf.ts para
// extraer texto); se promovieron a dependencias directas porque esta vez
// se usan para renderizar, no solo para extraer texto.

import { join } from "node:path";

import { ensurePdfjsNodeWorker } from "@/lib/pdfjs-node-worker";

const STANDARD_FONT_DATA_URL = `${join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")}/`;

export type RenderedPage = { png: Buffer; width: number; height: number };

/**
 * Renderiza `pageNumber` (1-based) de `pdfBytes` a PNG, con un ancho
 * mínimo de `minWidthPx` (legible en celular). Nunca recorta márgenes:
 * escala la página completa.
 */
export async function renderPdfPageToPng(
  pdfBytes: Uint8Array,
  pageNumber: number,
  minWidthPx = 1600,
): Promise<RenderedPage> {
  // @napi-rs/canvas debe cargar antes que pdfjs-dist para polyfillear
  // DOMMatrix, Path2D, etc. en Node -- mismo orden que extraction/pdf.ts.
  await import("@napi-rs/canvas");
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await ensurePdfjsNodeWorker();

  const doc = await pdfjsLib.getDocument({
    data: pdfBytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.max(1, minWidthPx / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    // Fondo blanco explícito -- un PNG sin relleno queda transparente.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;
    return { png: canvas.toBuffer("image/png"), width: canvas.width, height: canvas.height };
  } finally {
    await doc.destroy();
  }
}
