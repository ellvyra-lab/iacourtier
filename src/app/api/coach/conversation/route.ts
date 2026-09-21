import { createSupabaseServerClient } from "@/lib/supabase/server";
import { coachUuid, processCoachMessage } from "@/lib/server/process-coach-message";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Ta session a expiré." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!coachUuid(id)) return Response.json({ error: "Conversation invalide." }, { status: 400 });
  const { data, error } = await db.from("coach_messages").select("id,text,reply").eq("conversation_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "L’historique n’est pas disponible. Vérifie que la migration du Coach est appliquée." }, { status: 503 });
  return Response.json({ messages: (data || []).reverse() });
}
export async function POST(request: Request) {
  try {
    const db = await createSupabaseServerClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return Response.json({ error: "Ta session a expiré." }, { status: 401 });
    const body = await request.json();
    if (body.action === "new") {
      const { data, error } = await db.from("coach_conversations").insert({ user_id: user.id }).select("id").single();
      if (error) return Response.json({ error: "Le Coach n’est pas prêt : applique la migration de conversation Supabase." }, { status: 503 });
      return Response.json(data);
    }
    const result = await processCoachMessage(db, user.id, { conversationId: body.conversationId, messageId: body.messageId, text: body.text, choiceId: body.choiceId, taskId: body.taskId });
    return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Le Coach est momentanément indisponible." }, { status: 400 }); }
}
