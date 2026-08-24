import { NextResponse } from "next/server";

import { parseJsonObject } from "@/lib/mandate-document-extraction";
import { buildContinuousMergePreview } from "@/lib/continuous-merge";
import { generateWithOpenAIFile, generateWithOpenAIVision, getOpenAIErrorPayload } from "@/lib/openai";
import { fileExtension, imageDataUrlForVision } from "@/lib/server/image-analysis";
import { extractPdfContent } from "@/lib/server/pdf-analysis";
import { loadContinuousMergeContext, publicCaseContext } from "@/lib/server/continuous-merge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  inferDocumentType,
  inferSourceType,
  mergeUniversalAnalyses,
  normalizeUniversalPartial,
  normalizeUniversalValue,
  universalExtractionPrompt,
  type DuplicateMatch,
  type UniversalAnalysis,
  type UniversalSource,
} from "@/lib/universal-import";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const DOCUMENT_MODEL = process.env.OPENAI_DOCUMENT_MODEL?.trim() || "gpt-4o";
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]);

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
      return NextResponse.json({ error: "Envoie les fichiers avec un formulaire multipart." }, { status: 400 });
    }
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    const caseId = typeof formData.get("caseId") === "string" ? String(formData.get("caseId") || "").trim() : "";
    const validationError = validateFiles(files);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const mergeContext = caseId ? await loadContinuousMergeContext(supabase, user.id, caseId) : null;
    const caseGuidance = mergeContext ? existingCaseGuidance(mergeContext) : "";

    const pdfFiles = files.filter((file) => fileExtension(file.name) === ".pdf");
    const imageFiles = files.filter((file) => fileExtension(file.name) !== ".pdf");
    const analyses: UniversalAnalysis[] = [];

    for (const file of pdfFiles) {
      const data = Buffer.from(await file.arrayBuffer());
      const extracted = await extractPdfContent(data);
      const fallback: UniversalSource = {
        name: file.name,
        type: inferDocumentType(file.name),
        sourceType: "pdf",
        confidence: null,
        pageCount: extracted.pageCount,
        analysisMode: extracted.text ? "pdf_text_and_vision" : "pdf_visual_ocr",
      };
      const response = await generateWithOpenAIFile({
        systemPrompt: `${universalExtractionPrompt([file.name])}${caseGuidance}`,
        userPrompt: [
          `Analyse le fichier « ${file.name} » en entier.`,
          extracted.text
            ? `Une couche texte locale de ${extracted.text.length} caractères a été détectée; utilise aussi la lecture visuelle du PDF.`
            : "Aucune couche texte exploitable n'a été détectée; effectue une lecture visuelle/OCR de toutes les pages.",
          "Retourne le JSON demandé et rien d'autre.",
        ].join("\n"),
        file: { name: file.name, dataUrl: `data:application/pdf;base64,${data.toString("base64")}` },
        maxTokens: 5000,
        model: DOCUMENT_MODEL,
      });
      analyses.push(normalizeUniversalPartial(parseJsonObject(response), [fallback]));
    }

    if (imageFiles.length) {
      const images = await Promise.all(imageFiles.map(async (file) => ({ name: file.name, ...(await imageDataUrlForVision(file)) })));
      const fallbacks: UniversalSource[] = imageFiles.map((file) => ({
        name: file.name,
        type: inferDocumentType(file.name),
        sourceType: inferSourceType(file.name),
        confidence: null,
        pageCount: 1,
        analysisMode: fileExtension(file.name) === ".heic" || fileExtension(file.name) === ".heif" ? "heic_converted_vision" : "image_vision",
      }));
      const response = await generateWithOpenAIVision({
        systemPrompt: `${universalExtractionPrompt(imageFiles.map((file) => file.name))}${caseGuidance}`,
        userPrompt: [
          "Analyse ces images ensemble, dans l'ordre transmis.",
          "Si plusieurs images sont des captures d'une même conversation ou plusieurs pages d'un même document, reconstitue leur continuité sans inventer les passages manquants.",
          `Noms exacts, dans l'ordre : ${imageFiles.map((file, index) => `${index + 1}. ${file.name}`).join("; ")}.`,
          "Retourne le JSON demandé et rien d'autre.",
        ].join("\n"),
        images: images.map((image) => ({ name: image.name, dataUrl: image.dataUrl })),
        maxTokens: 6000,
        model: DOCUMENT_MODEL,
        timeoutMs: 150_000,
      });
      analyses.push(normalizeUniversalPartial(parseJsonObject(response), fallbacks));
    }

    const analysis = mergeUniversalAnalyses(analyses);
    const [contactsResult, propertiesResult] = await Promise.all([
      supabase.from("clients").select("id,first_name,last_name,email,phone,roles").eq("user_id", user.id),
      supabase.from("properties").select("id,address,city").eq("user_id", user.id),
    ]);
    if (contactsResult.error) return NextResponse.json({ error: contactsResult.error.message }, { status: 500 });
    if (propertiesResult.error) return NextResponse.json({ error: propertiesResult.error.message }, { status: 500 });

    analysis.duplicates = analysis.people.map((person) => ({
      personId: person.id,
      matches: (contactsResult.data || []).map((contact) => duplicateForPerson(person, contact)).filter((match): match is DuplicateMatch => Boolean(match)),
    })).filter((item) => item.matches.length > 0);
    analysis.propertyDuplicate = findPropertyDuplicate(analysis, propertiesResult.data || []);
    if (mergeContext) {
      if (analysis.projectType === "unknown") analysis.projectType = mergeContext.caseType;
      if (mergeContext.seller && !analysis.sellerStage) analysis.sellerStage = String(mergeContext.seller.pipeline_stage || "lead");
      if (mergeContext.buyer && !analysis.buyerStage) analysis.buyerStage = String(mergeContext.buyer.pipeline_stage || "qualification");
      analysis.existingCase = publicCaseContext(mergeContext);
      analysis.mergePreview = buildContinuousMergePreview(analysis, mergeContext);
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[universal-import/analyze]", error);
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) return NextResponse.json(openAIError.body, { status: openAIError.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "L’analyse universelle a échoué." }, { status: 500 });
  }
}

function existingCaseGuidance(context: Awaited<ReturnType<typeof loadContinuousMergeContext>>) {
  const people = context.clients.map((client) => `${client.firstName} ${client.lastName}`.trim()).filter(Boolean).join(", ");
  const property = context.property ? [context.property.address, context.property.city].filter(Boolean).join(", ") : "aucune propriété";
  return `\n\nContexte du dossier existant à enrichir :
- Dossier : ${context.title} (${context.caseType})
- Personnes déjà reliées : ${people || "aucune"}
- Propriété du dossier : ${property}
Règles additionnelles : ce document enrichit ce même dossier. Ne déduis jamais qu'une adresse figurant sur une pièce d'identité est l'adresse de la propriété. Pour une pièce d'identité, associe le nom visible à l'une des personnes ci-dessus si le texte le permet; sinon signale l'ambiguïté.`;
}

function validateFiles(files: File[]) {
  if (!files.length) return "Ajoute au moins un PDF, une photo ou une capture d’écran.";
  if (files.length > MAX_FILES) return `Un maximum de ${MAX_FILES} fichiers est permis par analyse.`;
  for (const file of files) {
    if (!ALLOWED_EXTENSIONS.has(fileExtension(file.name))) return `${file.name} n’est pas accepté. Utilise PDF, JPG, JPEG, PNG, HEIC, HEIF ou WEBP.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name} dépasse la limite de 15 Mo.`;
  }
  return null;
}

function duplicateForPerson(person: UniversalAnalysis["people"][number], contact: Record<string, unknown>): DuplicateMatch | null {
  const matchedOn: string[] = [];
  const email = normalizeUniversalValue(person.email);
  const phone = person.phone.replace(/\D/g, "");
  const name = normalizeUniversalValue(`${person.firstName}${person.lastName}`);
  if (email && email === normalizeUniversalValue(String(contact.email || ""))) matchedOn.push("courriel");
  if (phone && phone === String(contact.phone || "").replace(/\D/g, "")) matchedOn.push("téléphone");
  if (name && name === normalizeUniversalValue(`${String(contact.first_name || "")}${String(contact.last_name || "")}`)) matchedOn.push("nom");
  if (!matchedOn.length) return null;
  return {
    id: String(contact.id), name: `${String(contact.first_name || "")} ${String(contact.last_name || "")}`.trim(),
    email: String(contact.email || ""), phone: String(contact.phone || ""), roles: Array.isArray(contact.roles) ? contact.roles.map(String) : [], matchedOn,
  };
}

function findPropertyDuplicate(analysis: UniversalAnalysis, properties: Array<Record<string, unknown>>) {
  const address = normalizeUniversalValue(analysis.property.address);
  const city = normalizeUniversalValue(analysis.property.city);
  if (!address) return null;
  const match = properties.find((property) => normalizeUniversalValue(String(property.address || "")) === address && (!city || normalizeUniversalValue(String(property.city || "")) === city));
  return match ? { id: String(match.id), address: String(match.address || ""), city: String(match.city || "") } : null;
}

