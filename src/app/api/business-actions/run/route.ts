import { NextResponse } from "next/server";

import { getAssistantConfig } from "@/data/assistantsConfig";
import { buildBusinessActionPrompt, getBusinessAction, type BusinessActionRunInput } from "@/lib/business-actions";
import { generateWithOpenAI } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BusinessActionRunInput;
    const action = getBusinessAction(body.actionId);

    if (!action) {
      return NextResponse.json({ ok: false, error: "Action métier introuvable." }, { status: 404 });
    }

    const serviceSlugs = action.serviceSlugs?.length ? action.serviceSlugs : action.assistantSlug ? [action.assistantSlug] : [];
    if (!serviceSlugs.length) {
      return NextResponse.json({ ok: false, error: "Aucun service IA n'est associé à cette action." }, { status: 400 });
    }

    const prompt = buildBusinessActionPrompt(action, body.context);
    const results = [];

    for (const slug of serviceSlugs) {
      const assistant = getAssistantConfig(slug);
      if (!assistant) continue;

      const output = await generateWithOpenAI({
        systemPrompt: `${assistant.systemPrompt}\n\nTu es appelé comme service interne d'une action métier IACourtier. Ne parle pas d'assistant IA. Produis uniquement la partie utile pour l'action métier.`,
        userPrompt: prompt,
        maxTokens: 1200,
        temperature: 0.65,
      });

      results.push({
        slug,
        label: assistant.title,
        output,
      });
    }

    return NextResponse.json({ ok: true, action, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "L'action métier n'a pas pu être exécutée.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
