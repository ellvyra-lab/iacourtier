import { NextResponse } from "next/server";
import { createRequire } from "node:module";

import { generateWithOpenAI } from "@/lib/openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 24_000;

type PDFParseInstance = {
  getText: () => Promise<{ text: string }>;
  destroy: () => Promise<void> | void;
};

type PDFParseConstructor = new (options: { data: Buffer }) => PDFParseInstance;

const requirePdfParse = createRequire(import.meta.url);

function getPDFParse() {
  return requirePdfParse("pdf-parse").PDFParse as PDFParseConstructor;
}

const systemPrompt = `Tu es un courtier immobilier d'expérience au Québec spécialisé en analyse comparative de marché.

Tu reçois le texte extrait d'un PDF fourni par un courtier : rapport de comparables, analyse Centris, PDF MLS ou document d'analyse.

Règles obligatoires :
- Ne jamais inventer de comparables.
- Utiliser uniquement les données détectées dans le PDF et les informations du mandat fournies.
- Si une donnée n'est pas trouvée dans le PDF, écrire "non détecté".
- Ne jamais garantir une valeur marchande.
- Ne jamais remplacer le jugement professionnel du courtier.
- Toujours demander une validation par le courtier.
- Utiliser un français québécois professionnel.

Produis exactement ces sections :
1. Résumé de la propriété sujet
2. Résumé des comparables détectés
3. Éléments favorables à la valeur
4. Éléments pouvant limiter la valeur
5. Arguments à présenter au vendeur
6. Objections possibles du vendeur
7. Réponses suggérées
8. Recommandation de positionnement
9. Note de prudence : le courtier doit valider les données et exercer son jugement professionnel`;

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function buildPrompt({
  mandatId,
  subjectProperty,
  fileName,
  extractedText,
}: {
  mandatId: string;
  subjectProperty: string;
  fileName: string;
  extractedText: string;
}) {
  return [
    `Mandat ID: ${mandatId}`,
    `Nom du fichier: ${fileName}`,
    "",
    "Informations connues du mandat",
    subjectProperty || "non détecté",
    "",
    "Texte extrait du PDF",
    extractedText,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mandatId = textValue(formData.get("mandatId"));
    const subjectProperty = textValue(formData.get("subjectProperty"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Ajoutez un fichier PDF." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Le format accepté est PDF." }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "Le PDF est trop volumineux. Utilisez un fichier de 12 Mo ou moins." }, { status: 400 });
    }

    let extractedText = "";

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const PDFParse = getPDFParse();
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      extractedText = result.text.trim().replace(/\s+\n/g, "\n");
      await parser.destroy();
    } catch {
      return NextResponse.json(
        { error: "Le PDF n’a pas pu être lu automatiquement. Essayez un PDF texte ou utilisez la saisie manuelle." },
        { status: 422 },
      );
    }

    if (!extractedText) {
      return NextResponse.json(
        { error: "Le PDF n’a pas pu être lu automatiquement. Essayez un PDF texte ou utilisez la saisie manuelle." },
        { status: 422 },
      );
    }

    const limitedText = extractedText.slice(0, MAX_EXTRACTED_CHARS);
    const generatedText = await generateWithOpenAI({
      systemPrompt,
      userPrompt: buildPrompt({
        mandatId,
        subjectProperty,
        fileName: file.name,
        extractedText: limitedText,
      }),
      maxTokens: 1700,
      temperature: 0.45,
    });

    let saved = false;
    let id: string | undefined;

    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("market_analyses")
          .insert({
            user_id: user.id,
            mandat_id: mandatId || null,
            source_type: "pdf",
            file_name: file.name,
            extracted_text: limitedText,
            generated_text: generatedText,
          })
          .select("id")
          .single();

        if (!error && data) {
          saved = true;
          id = data.id;
        }
      }
    } catch {
      saved = false;
    }

    return NextResponse.json({
      text: generatedText,
      id,
      saved,
      fileName: file.name,
      extractedText: limitedText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
