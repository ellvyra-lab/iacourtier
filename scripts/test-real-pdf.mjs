import fs from "node:fs";
import path from "node:path";

import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

const requestedPath = process.argv.slice(2).join(" ");
if (!requestedPath) {
  console.error("Usage: pnpm test:pdf -- <chemin-du-pdf>");
  process.exit(2);
}

const absolutePath = path.resolve(requestedPath);
const data = fs.readFileSync(absolutePath);
const parser = new PDFParse({ data, CanvasFactory });

try {
  const result = await parser.getText();
  if (!result.text.trim()) throw new Error("Le PDF ne contient aucune couche texte; le parcours de production utilisera alors l’analyse visuelle/OCR.");
  console.log(JSON.stringify({
    ok: true,
    file: absolutePath,
    bytes: data.length,
    pages: result.total,
    extractedCharacters: result.text.length,
    domMatrix: typeof globalThis.DOMMatrix,
  }, null, 2));
} finally {
  await parser.destroy();
}
