import "server-only";

import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export type ExtractedPdfContent = {
  text: string;
  pageCount: number | null;
  screenshots: string[];
};

/**
 * Node/Vercel-safe PDF extraction. CanvasFactory installs the DOMMatrix,
 * ImageData and Path2D implementations PDF.js needs before it loads a PDF.
 */
export async function extractPdfContent(
  data: Buffer,
  { renderScannedPages = false, desiredWidth = 1800 }: { renderScannedPages?: boolean; desiredWidth?: number } = {},
): Promise<ExtractedPdfContent> {
  const parser = new PDFParse({ data, CanvasFactory });
  try {
    let text = "";
    let pageCount: number | null = null;

    try {
      const result = await parser.getText();
      text = result.text.trim().replace(/\s+\n/g, "\n");
      pageCount = Number.isFinite(result.total) ? result.total : null;
    } catch {
      // A valid scanned PDF may have no extractable text. Rendering below is
      // the supported fallback and must not be confused with a corrupt file.
      text = "";
    }

    const textPerPage = text.length / Math.max(1, pageCount || 1);
    const screenshots = renderScannedPages && textPerPage < 80
      ? (await parser.getScreenshot({ desiredWidth, imageDataUrl: true, imageBuffer: false })).pages.map((page) => page.dataUrl)
      : [];

    return { text, pageCount, screenshots };
  } finally {
    await parser.destroy();
  }
}
