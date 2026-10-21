import { createSupabaseServerClient } from "@/lib/supabase/server";
import { coachStorageError } from "@/lib/server/coach-storage-error";
import { coachUuid, processCoachMessage, selectCoachProvider } from "@/lib/server/process-coach-message";
import { metaConfigured, parseAIProvider } from "@/lib/server/ai-provider";
import { hydrateConnectionMessages } from "@/lib/server/connections/coach-connections";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Ta session a expiré." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ provider: "openai", metaAvailable: metaConfigured() });
  if (!coachUuid(id)) return Response.json({ error: "Conversation invalide." }, { status: 400 });
  const { data: conversation, error: conversationError } = await db.from("coach_conversations").select("id,context").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (conversationError) return Response.json({ error: coachStorageError(conversationError, "ouvrir la conversation").message }, { status: 503 });
  if (!conversation) return Response.json({ error: "Conversation introuvable. Ouvre une nouvelle conversation." }, { status: 404 });
  const { data, error } = await db.from("coach_messages").select("id,text,reply").eq("conversation_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: coachStorageError(error, "charger l’historique").message }, { status: 503 });
  try {return Response.json({ provider: parseAIProvider(conversation.context?.ai_provider), metaAvailable: metaConfigured(), messages: await hydrateConnectionMessages(user.id,id,(data || []).reverse()) });}
  catch(error) {return Response.json({error:error instanceof Error ? error.message : "États de connexion indisponibles."},{status:503});}
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error:"Origine invalide." },{ status:403 });
  try {
    const db = await createSupabaseServerClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return Response.json({ error: "Ta session a expiré." }, { status: 401 });
    const body = await request.json();
    if (body.action === "new") {
      const { data, error } = await db.from("coach_conversations").insert({ user_id: user.id }).select("id").single();
      if (error) return Response.json({ error: coachStorageError(error, "créer la conversation").message }, { status: 503 });
      return Response.json({ ...data, provider: "openai", metaAvailable: metaConfigured() });
    }
    if (body.action === "select_provider") return Response.json({ provider: await selectCoachProvider(db, user.id, body.conversationId, body.provider), metaAvailable: metaConfigured() });
    const result = await processCoachMessage(db, user.id, { timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined, conversationId: body.conversationId, messageId: body.messageId, text: body.text, choiceId: body.choiceId, taskId: body.taskId, action:body.action,referenceId:body.referenceId });
    return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Le Coach est momentanément indisponible." }, { status: 400 }); }
}
