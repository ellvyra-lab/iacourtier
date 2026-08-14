import { NextResponse } from "next/server";
import { createRequire } from "node:module";

import { generateWithOpenAI, generateWithOpenAIVision, getOpenAIErrorPayload } from "@/lib/openai";
import { mandateDocumentExtractionSystemPrompt, normalizeMandateDocumentExtraction, parseJsonObject } from "@/lib/mandate-document-extraction";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILES = 12;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_CHARS = 36_000;
const acceptedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".heic"];

type PDFParseInstance = { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> | void };
type PDFParseConstructor = new (options: { data: Buffer }) => PDFParseInstance;
const requirePdfParse = createRequire(import.meta.url);

async function extractPdfText(file: File) {
  const PDFParse = requirePdfParse("pdf-parse").PDFParse as PDFParseConstructor;
  const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
  try {
    const result = await parser.getText();
    return result.text.trim().replace(/\s+\n/g, "\n");
  } finally {
    await parser.destroy();
  }
}

function extension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté pour analyser des documents clients." }, { status: 401 });

    if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
      return NextResponse.json({ error: "Envoyez les documents avec un formulaire multipart." }, { status: 400 });
    }
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: "Déposez au moins un document." }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Un maximum de ${MAX_FILES} documents est permis.` }, { status: 400 });

    const textSections: string[] = [];
    const images: Array<{ dataUrl: string; name: string }> = [];
    const fileNames: string[] = [];

    for (const file of files) {
      const ext = extension(file.name);
      if (!acceptedExtensions.includes(ext)) {
        return NextResponse.json({ error: `Format non accepté pour ${file.name}. Utilisez PDF, JPG, JPEG, PNG ou HEIC.` }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name} dépasse la limite de 12 Mo.` }, { status: 400 });
      }
      fileNames.push(file.name);
      if (ext === ".pdf") {
        try {
          const text = await extractPdfText(file);
          if (text) textSections.push(`--- DOCUMENT: ${file.name} ---\n${text}`);
        } catch {
          textSections.push(`--- DOCUMENT: ${file.name} ---\nPDF numérisé ou sans texte exploitable.`);
        }
      } else {
        const mime = file.type || (ext === ".png" ? "image/png" : ext === ".heic" ? "image/heic" : "image/jpeg");
        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        images.push({ name: file.name, dataUrl: `data:${mime};base64,${base64}` });
      }
    }

    const extractedText = textSections.join("\n\n").slice(0, MAX_TOTAL_CHARS);
    const userPrompt = [
      "Extrais uniquement les informations immobilières réellement présentes et tous les vendeurs clairement identifiés dans ces documents.",
      `Documents reçus : ${fileNames.join(", ")}.`,
      extractedText ? `Texte extrait des PDF :\n\n${extractedText}` : "Aucun texte PDF; analyse les images fournies.",
    ].join("\n\n");

    const aiText = images.length
      ? await generateWithOpenAIVision({ systemPrompt: mandateDocumentExtractionSystemPrompt, userPrompt, images, maxTokens: 3500 })
      : await generateWithOpenAI({ systemPrompt: mandateDocumentExtractionSystemPrompt, userPrompt, maxTokens: 3500, temperature: 0.1 });

    const extraction = normalizeMandateDocumentExtraction(parseJsonObject(aiText));

    return NextResponse.json({
      ...extraction,
      fileNames,
      extractedTextPreview: extractedText.slice(0, 4000),
    });
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) return NextResponse.json(openAIError.body, { status: openAIError.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur inattendue est survenue." }, { status: 500 });
  }
}
