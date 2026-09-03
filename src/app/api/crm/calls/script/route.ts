import { NextResponse } from "next/server";

import { generateWithOpenAI } from "@/lib/openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré." }, { status: 401 });
    const body = await request.json() as { clientId?: string; caseId?: string };
    const { data: client } = await supabase.from("clients").select("id,first_name,last_name,notes").eq("id", body.clientId || "00000000-0000-0000-0000-000000000000").eq("user_id", user.id).maybeSingle();
    const { data: clientCase } = await supabase.from("client_cases").select("id,title,case_type,current_stage,next_action,next_action_reason,missing_items,property:properties(address,city,property_type)").eq("id", body.caseId || "00000000-0000-0000-0000-000000000000").eq("user_id", user.id).maybeSingle();
    if (!client || !clientCase) return NextResponse.json({ error: "Contexte client ou dossier introuvable." }, { status: 404 });
    const name = `${client.first_name || ""} ${client.last_name || ""}`.trim();
    const fallback = `Bonjour ${client.first_name || name}, c’est [ton prénom], ton courtier. Je t’appelle au sujet de ${String(clientCase.title || "ton projet immobilier").replace(/^./, (letter) => letter.toLowerCase())}. Est-ce que c’est un bon moment?\n\nJe voulais faire le point sur ${clientCase.next_action_reason || clientCase.next_action || "la prochaine étape de ton projet"}. Où en es-tu depuis notre dernier échange?\n\nSelon ta réponse, je pourrai te proposer la prochaine étape la plus utile. Qu’est-ce qui serait le plus aidant pour toi aujourd’hui?`;
    try {
      const script = await generateWithOpenAI({ systemPrompt: "Tu es le Coach IA d'un courtier immobilier québécois. Rédige un bref script d'appel naturel, consultatif et chaleureux. Utilise seulement les faits fournis. N'invente rien. Trois courts paragraphes maximum.", userPrompt: JSON.stringify({ client: name, notes: client.notes, dossier: clientCase }), maxTokens: 420, temperature: 0.35 });
      return NextResponse.json({ script, engine: "openai" });
    } catch { return NextResponse.json({ script: fallback, engine: "contextual_fallback" }); }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Script impossible à préparer." }, { status: 500 }); }
}

