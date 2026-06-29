import { NextResponse } from "next/server";

import { generateWithOpenAI } from "@/lib/openai";
import {
  buildMarketAnalysisPrompt,
  marketAnalysisSystemPrompt,
  type MarketAnalysisInput,
} from "@/lib/market-analysis";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function validateInput(input: MarketAnalysisInput) {
  if (!input.mandatId || !input.subjectProperty?.address || !input.subjectProperty?.city) {
    return "Le mandat lié est requis pour créer une analyse.";
  }

  const validComparables = input.comparables?.filter((comparable) => comparable.address.trim() && comparable.city.trim() && comparable.price.trim());

  if (!validComparables?.length) {
    return "Ajoutez au moins un comparable avec une adresse, une ville et un prix.";
  }

  if (validComparables.length > 10) {
    return "Un maximum de 10 comparables est permis.";
  }

  if (!input.objective || !input.style) {
    return "L'objectif et le style de l'analyse sont requis.";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MarketAnalysisInput;
    const comparables = (body.comparables ?? []).filter((comparable) => comparable.address.trim() && comparable.city.trim() && comparable.price.trim());
    const input = { ...body, comparables };
    const validationError = validateInput(input);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const text = await generateWithOpenAI({
      systemPrompt: marketAnalysisSystemPrompt,
      userPrompt: buildMarketAnalysisPrompt(input),
      maxTokens: 1700,
      temperature: 0.55,
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
            mandat_id: input.mandatId,
            subject_property: input.subjectProperty,
            comparables: input.comparables,
            objective: input.objective,
            style: input.style,
            generated_text: text,
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

    return NextResponse.json({ text, id, saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
