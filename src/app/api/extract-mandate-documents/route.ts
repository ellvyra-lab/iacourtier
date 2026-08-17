import { NextResponse } from "next/server";
import { createRequire } from "node:module";

import { generateWithOpenAIFile, generateWithOpenAIVision, getOpenAIErrorPayload } from "@/lib/openai";
import {
  buildMandateDocumentAnalysis,
  mandateDocumentExtractionSystemPrompt,
  mergeMandateDocumentAnalyses,
  normalizeMandateDocumentType,
  parseJsonObject,
  type MandateDocumentAnalysis,
} from "@/lib/mandate-document-extraction";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_PREVIEW_CHARS = 4_000;
const ANALYSIS_CONCURRENCY = 3;
const DOCUMENT_ANALYSIS_MODEL = process.env.OPENAI_DOCUMENT_MODEL?.trim() || "gpt-4o";
const acceptedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"];

type PDFParseInstance = {
  getText: () => Promise<{ text: string; total: number }>;
  getScreenshot: (options: { desiredWidth: number; imageDataUrl: boolean; imageBuffer: boolean }) => Promise<{
    total: number;
    pages: Array<{ dataUrl: string }>;
  }>;
  destroy: () => Promise<void> | void;
};
type PDFParseConstructor = new (options: { data: Buffer }) => PDFParseInstance;
const requirePdfParse = createRequire(import.meta.url);

async function extractPdfContent(data: Buffer) {
  const PDFParse = requirePdfParse("pdf-parse").PDFParse as PDFParseConstructor;
  const parser = new PDFParse({ data });
  try {
    let text = "";
    let pageCount: number | null = null;
    try {
      const result = await parser.getText();
      text = result.text.trim().replace(/\s+\n/g, "\n");
      pageCount = Number.isFinite(result.total) ? result.total : null;
    } catch {
      // A valid image-only PDF can have no locally extractable text.
    }

    const textPerPage = text.length / Math.max(1, pageCount || 1);
    const screenshots = textPerPage < 80
      ? (await parser.getScreenshot({ desiredWidth: 2000, imageDataUrl: true, imageBuffer: false })).pages.map((page) => page.dataUrl)
      : [];
    return {
      text,
      pageCount,
      screenshots,
    };
  } finally {
    await parser.destroy();
  }
}

function extension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function documentPrompt(fileName: string) {
  const typeHint = normalizeMandateDocumentType("", fileName);
  const guidance: Record<typeof typeHint, string> = {
    "Acte de vente": "Distingue le vendeur historique de l’acquéreur. L’acquéreur de cet acte est le propriétaire acquis par l’acte et doit être placé dans fields.sellers avec le rôle owner; le vendeur historique ne doit pas être placé dans fields.sellers. Lis la désignation pour l’adresse et le lot, l’ouverture et les signatures pour la date et le notaire, la contrepartie pour le prix, puis toutes les servitudes et mentions pertinentes.",
    "Certificat de localisation": "Lis l’adresse et le lot, les dimensions, la superficie, les bâtiments, le garage, la piscine, les servitudes, les empiètements et les remarques. Ne conclus jamais « non » pour un garage, une piscine ou un empiètement si le document ne le dit ou ne le montre pas clairement.",
    Modification: "Examine attentivement M1 et chaque clause cochée ou remplie. Si une valeur est écrite à M2.2 PRIX DE VENTE, tu dois obligatoirement la retourner dans fields.askingPrice et décrire ce changement dans fields.modifiedInfo. Examine aussi M2.1, M5 et M6. Une case vide n’est pas une information.",
    Contrat: "Pour un CCV, prends le vendeur uniquement dans Identification du vendeur; le lot uniquement dans Désignation cadastrale de la section 3, jamais dans un numéro de pièce d’identité; la superficie uniquement sur la ligne SUPERFICIE et les dimensions uniquement sur la ligne DIMENSIONS. Ne copie jamais la superficie dans dimensions. Prends le prix demandé uniquement à 4.1, les inclusions à 4.4, les exclusions à 4.5, la signature de l’acte à 5.1 et l’occupation à 5.2. La date de fin à 2.1 n’est pas une date de mise en marché.",
    "Déclaration du vendeur": "Identifie le ou les vendeurs et résume uniquement les déclarations, rénovations, caractéristiques et réponses effectivement cochées ou écrites.",
    Taxes: "Distingue taxes municipales, taxes scolaires, évaluation et année. Ne mélange pas solde, versement et total annuel.",
    Autre: "Identifie d’abord le type d’après le contenu, puis extrais uniquement les informations immobilières explicitement présentes.",
  };
  return [
    `Document unique à analyser : ${fileName}.`,
    "Lis toutes les pages et tous les champs remplis. Si le PDF est numérisé, utilise le rendu visuel/OCR fourni par l’API.",
    `Le nom suggère possiblement « ${typeHint} », mais confirme le type d’après le contenu. ${guidance[typeHint]}`,
    "Identifie le type réel d’après le contenu, puis extrais chaque information explicitement présente.",
    `Dans documentTypes, utilise exactement le nom ${JSON.stringify(fileName)}. Dans chaque fait, utilise exactement ce même nom comme sourceLabel.`,
    "Ne retourne pas de fait vide et ne déduis jamais une valeur absente. Retourne uniquement le JSON demandé.",
  ].join("\n");
}

async function analyzeDocument(file: File, textPreviews: string[]): Promise<MandateDocumentAnalysis> {
  const ext = extension(file.name);
  const data = Buffer.from(await file.arrayBuffer());

  if (ext === ".pdf") {
    const extracted = await extractPdfContent(data);
    const { text, pageCount, screenshots } = extracted;
    if (text) textPreviews.push(`--- ${file.name} ---\n${text}`);

    const analysisMode = screenshots.length ? "pdf_visual_ocr" as const : "pdf_text_and_vision" as const;
    const aiText = screenshots.length
      ? await generateWithOpenAIVision({
          systemPrompt: mandateDocumentExtractionSystemPrompt,
          userPrompt: documentPrompt(file.name),
          images: screenshots.map((dataUrl, index) => ({ name: `${file.name} — page ${index + 1}`, dataUrl })),
          maxTokens: 4500,
          model: DOCUMENT_ANALYSIS_MODEL,
          timeoutMs: 120_000,
        })
      : await generateWithOpenAIFile({
          systemPrompt: mandateDocumentExtractionSystemPrompt,
          userPrompt: documentPrompt(file.name),
          file: { name: file.name, dataUrl: `data:application/pdf;base64,${data.toString("base64")}` },
          maxTokens: 4500,
          model: DOCUMENT_ANALYSIS_MODEL,
        });

    return buildMandateDocumentAnalysis({
      name: file.name,
      value: parseJsonObject(aiText),
      analysisMode,
      pageCount,
      extractedTextLength: text.length,
    });
  }

  const mime = file.type || (ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".heic" || ext === ".heif" ? "image/heic" : "image/jpeg");
  const aiText = await generateWithOpenAIVision({
    systemPrompt: mandateDocumentExtractionSystemPrompt,
    userPrompt: documentPrompt(file.name),
    images: [{ name: file.name, dataUrl: `data:${mime};base64,${data.toString("base64")}` }],
    maxTokens: 4500,
    model: DOCUMENT_ANALYSIS_MODEL,
    timeoutMs: 120_000,
  });

  return buildMandateDocumentAnalysis({
    name: file.name,
    value: parseJsonObject(aiText),
    analysisMode: "image_vision",
    pageCount: 1,
    extractedTextLength: 0,
  });
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
      return NextResponse.json({ error: "Envoyez les documents avec un formulaire multipart." }, { status: 400 });
    }
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: "Déposez au moins un document." }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Un maximum de ${MAX_FILES} documents est permis.` }, { status: 400 });

    for (const file of files) {
      const ext = extension(file.name);
      if (!acceptedExtensions.includes(ext)) {
        return NextResponse.json({ error: `Format non accepté pour ${file.name}. Utilisez PDF, JPG, JPEG, PNG, HEIC, HEIF ou WEBP.` }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name} dépasse la limite de 12 Mo.` }, { status: 400 });
      }
    }

    const textPreviews: string[] = [];
    const documents = await mapWithConcurrency(files, ANALYSIS_CONCURRENCY, (file) => analyzeDocument(file, textPreviews));
    const extraction = mergeMandateDocumentAnalyses(documents);

    return NextResponse.json({
      ...extraction,
      fileNames: files.map((file) => file.name),
      extractedTextPreview: textPreviews.join("\n\n").slice(0, MAX_TEXT_PREVIEW_CHARS),
    });
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) return NextResponse.json(openAIError.body, { status: openAIError.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur inattendue est survenue." }, { status: 500 });
  }
}
