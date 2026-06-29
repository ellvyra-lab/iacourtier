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

const systemPrompt = `Tu es un courtier immobilier d'expérience au Québec, spécialisé en analyse comparative de marché résidentiel.

Tu ne fais pas un simple résumé du PDF. Tu raisonnes comme un courtier expérimenté qui prépare une rencontre vendeur : tu compares la propriété sujet avec les comparables, tu évalues la pertinence réelle de chaque comparable et tu expliques les ajustements qualitatifs à considérer.

Règles obligatoires :
- Ne jamais inventer de comparables.
- Ne jamais inventer une donnée manquante.
- Utiliser uniquement les données détectées dans le PDF et les informations du mandat fournies.
- Si une donnée n'est pas trouvée, écrire "non détecté".
- Ne jamais garantir une valeur marchande.
- Ne jamais remplacer le jugement professionnel du courtier.
- Toujours préciser que l'analyse doit être validée par le courtier.
- Utiliser un français québécois professionnel, clair et utile en rencontre vendeur.

Critères à comparer pour chaque comparable :
- secteur / proximité;
- type de propriété;
- date de vente;
- prix vendu ou demandé;
- chambres totales;
- chambres hors sol, analysées séparément des chambres totales;
- salles de bain;
- garage;
- piscine;
- superficie habitable;
- superficie terrain;
- année de construction;
- rénovations;
- condition générale;
- particularités importantes.

Indice de similarité :
Attribue une cote à chaque comparable parmi exactement ces choix :
- Très pertinent;
- Pertinent;
- À utiliser avec prudence;
- Peu comparable.

Explique les ajustements qualitatifs quand les données le permettent :
- garage vs aucun garage;
- terrain plus grand ou plus petit;
- chambre hors sol supplémentaire ou manquante;
- propriété rénovée vs non rénovée;
- vente plus récente vs plus ancienne;
- secteur plus recherché ou moins recherché;
- superficie habitable supérieure ou inférieure;
- condition générale supérieure ou inférieure.

Format de sortie obligatoire :
1. Résumé de la propriété sujet
2. Tableau des comparables détectés
3. Grille de similarité
4. Comparables les plus fiables
5. Comparables à utiliser avec prudence
6. Ajustements qualitatifs
7. Fourchette de valeur suggérée si les données sont suffisantes
8. Prix de mise en marché recommandé si les données sont suffisantes
9. Arguments à présenter au vendeur
10. Objections probables du vendeur et réponses
11. Note de prudence : validation professionnelle requise

Dans les sections 2 et 3, utilise des tableaux Markdown lisibles. Si les données sont insuffisantes pour une fourchette ou un prix recommandé, écris clairement que les données sont insuffisantes plutôt que de deviner.`;

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
    "Informations connues de la propriété sujet, à utiliser comme base de comparaison",
    subjectProperty || "non détecté",
    "",
    "Mission",
    "Extrais les comparables présents dans le PDF, puis produis une vraie analyse comparative de marché. Ne te limite pas à résumer le document. Compare chaque comparable avec la propriété sujet et explique sa pertinence réelle.",
    "",
    "Texte extrait du PDF de comparables",
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
      maxTokens: 2600,
      temperature: 0.35,
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
