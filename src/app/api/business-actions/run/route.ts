import { NextResponse } from "next/server";

import { getAssistantConfig } from "@/data/assistantsConfig";
import { buildBusinessActionPrompt, getBusinessAction, type BusinessActionRunInput } from "@/lib/business-actions";
import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import { CLIENT_BRAND_SAFETY_RULES, formatBrokerProfileForPrompt, normalizeBrokerProfile, sanitizeClientFacingContent } from "@/lib/broker-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BusinessActionRunInput;
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Vous devez être connecté." }, { status: 401 });
    }
    const brokerProfile = normalizeBrokerProfile(userData.user.user_metadata?.broker_profile);
    const brokerContext = formatBrokerProfileForPrompt(brokerProfile);
    const action = getBusinessAction(body.actionId);

    if (!action) {
      return NextResponse.json({ ok: false, error: "Action metier introuvable." }, { status: 404 });
    }

    const serviceSlugs = action.serviceSlugs?.length ? action.serviceSlugs : action.assistantSlug ? [action.assistantSlug] : [];
    if (!serviceSlugs.length) {
      return NextResponse.json({ ok: false, error: "Aucun service IA n'est associe a cette action." }, { status: 400 });
    }

    const prompt = `${buildBusinessActionPrompt(action, body.context)}\n\nPROFIL OFFICIEL DU COURTIER :\n${brokerContext || "(profil non configuré — ne rien inventer)"}`;
    const results = [];

    for (const slug of serviceSlugs) {
      const assistant = getAssistantConfig(slug);
      if (!assistant) continue;

      const generatedOutput = await generateWithOpenAI({
        systemPrompt: `${assistant.systemPrompt}\n\nTu es appelé comme service interne d'une action métier. Produis uniquement le contenu final utile.\n\n${CLIENT_BRAND_SAFETY_RULES}`,
        userPrompt: prompt,
        maxTokens: 1200,
        temperature: 0.65,
      });
      const output = sanitizeClientFacingContent(generatedOutput, brokerProfile);

      results.push({
        slug,
        label: assistant.title,
        output,
      });
    }

    return NextResponse.json({ ok: true, action, results });
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) {
      return NextResponse.json({ ok: false, ...openAIError.body }, { status: openAIError.status });
    }

    const message = error instanceof Error ? error.message : "L'action metier n'a pas pu etre executee.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
