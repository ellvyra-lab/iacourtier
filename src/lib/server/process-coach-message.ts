import { applyCoachPageContext } from "@/lib/server/coach-page-context";
import { emailConversationIntent } from "@/lib/server/coach-professional-context";
import { understandCoachMessage } from "@/lib/server/coach-intent";
import { coachStorageError } from "@/lib/server/coach-storage-error";
import { getOpenAIErrorPayload } from "@/lib/openai";
import { metaConfigured, metaPublicError, parseAIProvider, withCoachAI, type AIProviderId } from "@/lib/server/ai-provider";
import { relationshipCoachHandlers } from "@/lib/server/coach-relationships";
import { emptyCoachContext, foldCoach, parseCoachIntent, type CoachContext, type CoachIntent, type CoachReply } from "@/lib/coach/conversation";
import { CoachChoice, coachHandlers, coachRows, type CoachScope } from "@/lib/server/coach-tools";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CoachActionRequest } from "@/lib/coach/conversation";
import { connectedCoachHandlers, focusReference, handleConnectedAction, readConnectedEvent } from "@/lib/server/connections/coach-connected";
import { CoachClarification, freezeCoachDate, isCoachCancellation, resumeCoachPending, type PendingCoachAction } from "@/lib/server/coach-pending";
import { coachConnectionHandlers, connectionIntent } from "@/lib/server/connections/coach-connections";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Pending = PendingCoachAction;
export function coachUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export async function selectCoachProvider(db: Supabase, userId: string, conversationId: string, value: unknown): Promise<AIProviderId> {
  if (!coachUuid(conversationId)) throw new Error("Conversation invalide.");
  const provider = parseAIProvider(value);
  if (provider === "meta" && !metaConfigured()) throw new Error("Meta n’est pas configuré sur ce serveur. OpenAI reste disponible.");
  const token = crypto.randomUUID();
  const lock = await db.rpc("claim_coach_lock", { lock_token: token });
  if (lock.error || !lock.data) throw new Error("Une demande est en cours. Attends sa réponse.");
  try {
    const { data, error } = await db.from("coach_conversations").select("context").eq("id", conversationId).eq("user_id", userId).single();
    if (error || !data) throw new Error("Conversation inaccessible.");
    const saved = await db.from("coach_conversations").update({ context: { ...data.context, ai_provider: provider } }).eq("id", conversationId).eq("user_id", userId);
    if (saved.error) throw new Error("Choix du fournisseur non enregistré.");
    return provider;
  } finally { await db.rpc("release_coach_lock", { lock_token: token }); }
}
export async function processCoachMessage(db: Supabase, userId: string, input: { pagePath?: string; timeZone?: string; conversationId: string; messageId: string; text: string; choiceId?: string; taskId?: string; action?: CoachActionRequest; referenceId?: string }) {
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
    await applyCoachPageContext(db, userId, context, input.pagePath);
    const aiProvider = parseAIProvider(context.ai_provider);
    return await withCoachAI(aiProvider, async () => {
    const timeZone = input.timeZone || "America/Toronto";
    try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { throw new Error("Fuseau horaire invalide."); }
    const scope: CoachScope = { timeZone, db, userId, conversationId: input.conversationId, messageId: input.messageId, text: input.text.trim(), context };
    const { error: messageError } = await db.from("coach_messages").insert({ id: input.messageId, user_id: userId, conversation_id: input.conversationId, text: scope.text });
    if (messageError) throw messageError;
    let intent: CoachIntent | undefined;
    let pending: Pending | null = null;
    let failed = false;
    let response: CoachReply = { text:"Action non exécutée.",cards:[],context:scope.context };
    try {
      const previous = conversation.pending as Pending | null;
      const selected = previous?.options?.find(option => input.choiceId ? option.id === input.choiceId : foldCoach(option.label) === foldCoach(scope.text));
      const emailCommand = !input.action && !input.taskId && !input.referenceId && !input.choiceId ? emailConversationIntent(scope.text,scope.context) : undefined;
      const connectionCommand = !input.action && !input.taskId && !input.referenceId && !input.choiceId ? connectionIntent(scope.text) : undefined;
      if (connectionCommand) pending = previous;
      const resumed = previous && !connectionCommand && !emailCommand ? resumeCoachPending(previous, scope.text) : null;
      if (input.choiceId && !selected) throw new Error("Ce choix ne correspond pas à la question en cours.");
      if (isCoachCancellation(scope.text) && (previous || scope.context.current_action_id || scope.context.email_question || scope.context.professional_update)) {
        scope.context.email_question=null;scope.context.professional_update=null;
        if (scope.context.current_action_id) response = await handleConnectedAction(scope, { id: scope.context.current_action_id, mode: "cancel" });
        else response = { text: "Action en attente annulée. Aucun événement créé.", cards: [], context: scope.context };
      } else if (resumed && previous && !input.action && !input.taskId && !input.referenceId) {
        intent = parseCoachIntent(resumed);
        scope.text = previous.text;
        scope.selections = previous.selections;
        scope.timeZone = previous.timeZone || scope.timeZone;
      } else if (input.action) {
        if (!coachUuid(input.action.id)) throw new Error("Aperçu invalide.");
        response = await handleConnectedAction(scope,input.action);
        if (!response.changed && scope.context.current_action_id && previous?.mode === "clarification") pending = previous;
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
        scope.timeZone = previous.timeZone || scope.timeZone;
        scope.text = previous.text;
        scope.selected = { kind: previous.kind, id: selected.id };
        scope.selections = { ...previous.selections, [previous.kind]: selected.id };
      } else {
        const { data: history, error: historyError } = await db.from("coach_messages").select("text,reply").eq("conversation_id", input.conversationId).eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(8);
        if (historyError) throw historyError;
        intent = connectionCommand || emailCommand || await understandCoachMessage(scope.context, history || [], scope.text, scope.timeZone);
      }
      if (intent) {
        intent = freezeCoachDate(intent, scope.timeZone);
        if(["draft_email","reply_email","revise_email","switch_email_account","prepare_email"].includes(intent.tool))scope.context.professional_update=null;
        const preservesPending = ["answer", "get_professional_profile", "count_clients", "clarify_identity", "connect_service", "list_connections", "disconnect_account", "get_centris_status", "revise_email", "prepare_email", "switch_email_account", "propose_professional_update", "draft_email", "reply_email"].includes(intent.tool);
        if (preservesPending) pending = previous?.kind === "identity" && intent.tool === "get_professional_profile" ? null : previous;
        else if(intent.tool !== "send_email") {scope.context.email_question=null;scope.context.professional_update=null;}
        if (!preservesPending && !resumed && !selected && scope.context.current_action_id && intent.tool !== "send_email") await handleConnectedAction(scope, { id: scope.context.current_action_id, mode: "cancel" });
        if (!preservesPending && intent.tool !== "send_email") scope.context.current_action_id = null;
        const handlers = { ...coachHandlers,...connectedCoachHandlers,...relationshipCoachHandlers,...coachConnectionHandlers };
        const handler = handlers[intent.tool];
        if (!handler) throw new Error("Outil indisponible.");
        console.info("[coach.tool.start]", { tool: intent.tool, hasClientReference: Boolean(intent.query), hasTitle: Boolean(intent.title), hasDate: Boolean(intent.dateExpression) });
        response = await handler(scope, intent);
        if (response.approval && ["create_calendar_event", "update_calendar_event"].includes(intent.tool)) pending = { intent, text: scope.text, kind: "time", options: [], mode: "clarification", selections: scope.selections, timeZone: scope.timeZone, createdAt: new Date().toISOString() };
        console.info("[coach.tool.result]", { tool: intent.tool, changed: Boolean(response.changed), cardCount: response.cards.length });
      }
    } catch (error) {
      if (error instanceof CoachClarification && (intent || conversation.pending)) {
        const previous = conversation.pending as Pending | null;
        pending = { intent: intent || previous!.intent, text: intent ? scope.text : previous!.text, kind: error.kind, options: [], mode: "clarification", selections: scope.selections || previous?.selections, timeZone: scope.timeZone, createdAt: new Date().toISOString() };
        response = { text: error.message, cards: [], context: scope.context };
      } else if (error instanceof CoachChoice && intent) {
        pending = { intent, text: scope.text, kind: error.kind, options: error.options, selections: scope.selections, timeZone: scope.timeZone };
        response = { text: error.message, choices: error.options, cards: [], context: scope.context };
      } else {
        failed = true;
        const aiError = getOpenAIErrorPayload(error);
        const code = error && typeof error === "object" && "code" in error ? String(error.code).slice(0, 32) : undefined;
        console.error("[coach.tool.failed]", { tool: intent?.tool || "intent", code, type: error instanceof Error ? error.name : "database" });
        response = { text: metaPublicError(error) || (aiError ? aiError.body.error : error instanceof SyntaxError ? "Je n’ai pas compris la réponse du modèle. Peux-tu reformuler ?" : error instanceof Error ? error.message : "Je n’ai pas réussi à terminer cette action. Réessaie dans quelques instants."), cards: [], context: scope.context };
        if (intent?.tool === "create_calendar_event" && !input.action) {
          pending = { intent, text: scope.text, kind: "calendar_connection", options: [], mode: "clarification", selections: scope.selections, timeZone: scope.timeZone };
          response.text += " La demande est conservée. Corrige le problème puis écris « reprends ». Aucun événement n’a été créé par cette demande.";
        }
      }
    }
    scope.context.ai_provider = aiProvider;
    const { error: contextError } = await db.from("coach_conversations").update({ context: scope.context, pending, updated_at: new Date().toISOString() }).eq("id", input.conversationId).eq("user_id", userId);
    if (contextError) throw new Error("Le traitement a terminé, mais le contexte n’a pas pu être sauvegardé. Vérifie le CRM avant de recommencer.");
    const { error: replyError } = await db.from("coach_messages").update({ reply: response, status: failed ? "failed" : "completed" }).eq("id", input.messageId).eq("user_id", userId);
    if (replyError) throw new Error("La réponse n’a pas pu être enregistrée. Vérifie le CRM avant de recommencer.");
    return response;
    });
  } finally { await db.rpc("release_coach_lock", { lock_token: lock }); }
}
