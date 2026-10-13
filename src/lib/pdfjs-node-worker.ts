// pdfjs-dist (usado por pdf-parse para extraer texto, y directamente
// para renderizar una página a PNG) resuelve su "fake worker" en Node
// con un import() dinámico de pdf.worker.mjs cuya ruta arma en tiempo
// de ejecución (GlobalWorkerOptions.workerSrc). El
// output file tracing de Vercel no sigue ese import -- la ruta no es un
// string literal estático -- así que el archivo no queda en el bundle
// desplegado y falla con "Setting up fake worker failed: Cannot find
// module '.../pdf.worker.mjs'".
//
// pdfjs-dist mira primero globalThis.pdfjsWorker antes de intentar ese
// import dinámico (PDFWorker.#mainThreadWorkerMessageHandler en
// pdfjs-dist/legacy/build/pdf.mjs), así que alcanza con importar el
// worker acá mismo con un import() de ruta literal -- el tracer SÍ lo
// sigue -- y dejarlo ahí una sola vez por proceso.
let installed: Promise<void> | null = null;

export function ensurePdfjsNodeWorker(): Promise<void> {
  installed ??= (async () => {
    const pdfjsWorker: unknown = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;
  })();
  return installed;
}
