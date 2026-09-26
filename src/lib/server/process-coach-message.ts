import { understandCoachMessage } from "@/lib/server/coach-intent";
import { coachStorageError } from "@/lib/server/coach-storage-error";
import { getOpenAIErrorPayload } from "@/lib/openai";
import { relationshipCoachHandlers } from "@/lib/server/coach-relationships";
import { emptyCoachContext, foldCoach, parseCoachIntent, type CoachContext, type CoachIntent, type CoachReply } from "@/lib/coach/conversation";
import { CoachChoice, coachHandlers, coachRows, type CoachScope } from "@/lib/server/coach-tools";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CoachActionRequest } from "@/lib/coach/conversation";
import { connectedCoachHandlers, focusReference, handleConnectedAction, readConnectedEvent } from "@/lib/server/connections/coach-connected";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Pending = { intent: CoachIntent; text: string; kind: string; options: { id: string; label: string }[]; selections?: Record<string,string> };
export function coachUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export async function processCoachMessage(db: Supabase, userId: string, input: { conversationId: string; messageId: string; text: string; choiceId?: string; taskId?: string; action?: CoachActionRequest; referenceId?: string }) {
  if (!coachUuid(input.conversationId) || !coachUuid(input.messageId) || typeof input.text !== "string" || !input.text.trim() || input.text.length > 12000 || (input.choiceId !== undefined && !coachUuid(input.choiceId))) throw new Error("Message invalide.");
  const lock = crypto.randomUUID();
  const { data: acquired, error: lockError } = await db.rpc("claim_coach_lock", { lock_token: lock });
  if (lockError) throw coachStorageError(lockError, "verrouiller la conversation");
  if (!acquired) throw new Error("Une demande est déjà en traitement. Attends sa réponse avant de continuer.");
  try {
    const { data: existing, error: existingError } = await db.from("coach_messages").select("reply,status,conversation_id").eq("id", input.messageId).eq("user_id", userId).maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.conversation_id !== input.conversationId) throw new Error("Ce message appartient à une autre conversation.");
      if (existing.reply) return existing.reply as CoachReply;
      throw new Error("Cette demande a déjà été reçue. Vérifie le CRM avant de la répéter : son traitement a pu être interrompu.");
    }
    const { data: conversation, error } = await db.from("coach_conversations").select("*").eq("id", input.conversationId).eq("user_id", userId).single();
    if (error || !conversation) throw new Error("Conversation introuvable. Ouvre une nouvelle conversation.");
    const context = { ...emptyCoachContext(), ...conversation.context } as CoachContext;
    const scope: CoachScope = { db, userId, conversationId: input.conversationId, messageId: input.messageId, text: input.text.trim(), context };
    const { error: messageError } = await db.from("coach_messages").insert({ id: input.messageId, user_id: userId, conversation_id: input.conversationId, text: scope.text });
    if (messageError) throw messageError;
    let intent: CoachIntent | undefined;
    let pending: Pending | null = null;
    let failed = false;
    let response: CoachReply = { text:"Action non exécutée.",cards:[],context:scope.context };
    try {
      const previous = conversation.pending as Pending | null;
      const selected = previous?.options.find(option => input.choiceId ? option.id === input.choiceId : foldCoach(option.label) === foldCoach(scope.text));
      if (input.choiceId && !selected) throw new Error("Ce choix ne correspond pas à la question en cours.");
      if (input.action) {
        if (!coachUuid(input.action.id)) throw new Error("Aperçu invalide.");
        response = await handleConnectedAction(scope,input.action);
      } else if (input.referenceId) {
        if (!coachUuid(input.referenceId)) throw new Error("Référence invalide.");
        const ref = await focusReference(scope,input.referenceId);
        if (ref.kind === "email") intent = { tool:"get_email" };
        else response = await readConnectedEvent(scope,ref.id);
      } else if (input.taskId) {
        if (!coachUuid(input.taskId)) throw new Error("Tâche invalide.");
        const task = (await coachRows(scope, "tasks", "id", input.taskId))[0];
        if (!task) throw new Error("Tâche inaccessible.");
        scope.context = { ...emptyCoachContext(), current_task_id: task.id, current_case_id: typeof task.case_id === "string" ? task.case_id : null, current_client_id: typeof task.client_id === "string" ? task.client_id : null, current_property_id: typeof task.property_id === "string" ? task.property_id : null };
        intent = { tool: "complete_task" };
      } else if (selected && previous) {
        intent = parseCoachIntent(previous.intent);
        scope.text = previous.text;
        scope.selected = { kind: previous.kind, id: selected.id };
        scope.selections = { ...previous.selections, [previous.kind]: selected.id };
      } else {
        const { data: history, error: historyError } = await db.from("coach_messages").select("text,reply").eq("conversation_id", input.conversationId).eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(8);
        if (historyError) throw historyError;
        intent = await understandCoachMessage(scope.context, history || [], scope.text);
      }
      if (intent) {
        if (intent.tool !== "send_email") scope.context.current_action_id = null;
        const handlers = { ...coachHandlers,...connectedCoachHandlers,...relationshipCoachHandlers };
        const handler = handlers[intent.tool];
        if (!handler) throw new Error("Outil indisponible.");
        response = await handler(scope, intent);
      }
    } catch (error) {
      if (error instanceof CoachChoice && intent) {
        pending = { intent, text: scope.text, kind: error.kind, options: error.options, selections: scope.selections };
        response = { text: error.message, choices: error.options, cards: [], context: scope.context };
      } else {
        failed = true;
        const aiError = getOpenAIErrorPayload(error);
        response = { text: aiError ? aiError.body.error : error instanceof Error ? error.message : "Je n’ai pas pu terminer cette demande. Vérifie le CRM avant de recommencer.", cards: [], context: scope.context };
      }
    }
    const { error: contextError } = await db.from("coach_conversations").update({ context: scope.context, pending, updated_at: new Date().toISOString() }).eq("id", input.conversationId).eq("user_id", userId);
    if (contextError) throw new Error("Le traitement a terminé, mais le contexte n’a pas pu être sauvegardé. Vérifie le CRM avant de recommencer.");
    const { error: replyError } = await db.from("coach_messages").update({ reply: response, status: failed ? "failed" : "completed" }).eq("id", input.messageId).eq("user_id", userId);
    if (replyError) throw new Error("La réponse n’a pas pu être enregistrée. Vérifie le CRM avant de recommencer.");
    return response;
  } finally { await db.rpc("release_coach_lock", { lock_token: lock }); }
}
