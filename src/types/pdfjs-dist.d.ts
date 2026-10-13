// pdfjs-dist no publica tipos para la ruta profunda del worker -- solo
// se importa por su efecto de módulo (ver src/lib/pdfjs-node-worker.ts),
// así que alcanza con declararla como "any".
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
