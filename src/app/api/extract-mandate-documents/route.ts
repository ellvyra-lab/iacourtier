import { NextResponse } from "next/server";
import { createRequire } from "node:module";

import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import {
  mandateDocumentExtractionSystemPrompt,
  normalizeExtractedMandateFields,
  parseJsonObject,
} from "@/lib/mandate-document-extraction";

export const runtime = "nodejs";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_CHARS = 30_000;

type PDFParseInstance = {
  getText: () => Promise<{ text: string }>;
  destroy: () => Promise<void> | void;
};

type PDFParseConstructor = new (options: { data: Buffer }) => PDFParseInstance;

const requirePdfParse = createRequire(import.meta.url);

function getPDFParse() {
  return requirePdfParse("pdf-parse").PDFParse as PDFParseConstructor;
}

async function extractPdfText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const PDFParse = getPDFParse();
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text.trim().replace(/\s+\n/g, "\n");
  } finally {
    await parser.destroy();
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Envoyez les documents avec un formulaire multipart." }, { status: 400 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "Déposez au moins un document PDF." }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Un maximum de ${MAX_FILES} PDF est permis à la fois.` }, { status: 400 });
    }

    const extractedSections: string[] = [];
    const fileNames: string[] = [];

    for (const file of files) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "Tous les documents doivent être des PDF." }, { status: 400 });
      }

      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `Le fichier ${file.name} est trop volumineux. Utilisez des PDF de 12 Mo ou moins.` }, { status: 400 });
      }

      try {
        const text = await extractPdfText(file);
        if (text) {
          fileNames.push(file.name);
          extractedSections.push(`--- DOCUMENT: ${file.name} ---\n${text}`);
        }
      } catch {
        return NextResponse.json(
          { error: "Un des PDF n’a pas pu être lu automatiquement. Essayez un PDF texte ou retirez le document problématique." },
          { status: 422 },
        );
      }
    }

    const extractedText = extractedSections.join("\n\n").slice(0, MAX_TOTAL_CHARS);

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "Les PDF n’ont pas pu être lus automatiquement. Essayez des PDF texte ou utilisez la saisie manuelle." },
        { status: 422 },
      );
    }

    const aiText = await generateWithOpenAI({
      systemPrompt: mandateDocumentExtractionSystemPrompt,
      userPrompt: `Texte extrait des documents de mandat:\n\n${extractedText}`,
      maxTokens: 1200,
      temperature: 0.1,
    });

    const fields = normalizeExtractedMandateFields(parseJsonObject(aiText));

    return NextResponse.json({
      fields,
      fileNames,
      extractedTextPreview: extractedText.slice(0, 4000),
    });
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) {
      return NextResponse.json(openAIError.body, { status: openAIError.status });
    }

    const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
