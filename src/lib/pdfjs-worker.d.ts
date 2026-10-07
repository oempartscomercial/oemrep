// O build do worker do pdfjs não publica tipos; só o importamos para pendurar em
// globalThis.pdfjsWorker (ver extracao-pdf-texto.ts).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
