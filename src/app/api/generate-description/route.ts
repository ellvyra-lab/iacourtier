import { NextResponse } from "next/server";

import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import { buildUserPrompt, type PropertyDescriptionForm } from "@/lib/property-description";
import { propertyDescriptionSystemPrompt } from "@/lib/server-prompt";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function validateInput(input: PropertyDescriptionForm) {
  if (!input.propertyType || !input.city?.trim() || !input.highlights?.trim()) {
    return "Le type de propriété, la ville et les points forts sont requis.";
  }

  if (!input.style || !input.length) {
    return "Le style d'écriture et la longueur sont requis.";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PropertyDescriptionForm & { mandatId?: string };
    const validationError = validateInput(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const text = await generateWithOpenAI({
      systemPrompt: propertyDescriptionSystemPrompt,
      userPrompt: buildUserPrompt(body),
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
          .from("generated_descriptions")
          .insert({
            user_id: user.id,
            mandat_id: body.mandatId || null,
            property_type: body.propertyType,
            city: body.city,
            price: body.price?.trim() || null,
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
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) {
      return NextResponse.json(openAIError.body, { status: openAIError.status });
    }

    const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
