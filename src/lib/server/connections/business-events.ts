import "server-only";
import { emitCrmEvent } from "@/lib/server/crm-operating-system";
import type { CoachScope } from "@/lib/server/coach-tools";

export type ConnectionBusinessEvent = "email_received" | "email_reply_needed" | "email_received_from_client" | "calendar_event_created" | "calendar_event_updated";
export type ConnectionReference = { id: string; account_id: string; client_id: string | null; case_id: string | null; property_id: string | null };

export async function recordConnectionEvent(s: CoachScope, reference: ConnectionReference, eventType: ConnectionBusinessEvent, revision = "initial") {
  // References are resolved from the user's own account, never from an LLM ID.
  await emitCrmEvent(s.db, {
    userId: s.userId, eventType, clientId: reference.client_id,
    caseId: reference.case_id, propertyId: reference.property_id,
    idempotencyKey: `connection:${reference.id}:${eventType}:${revision}`,
    actorType: "system", cause: "authorized_provider_read",
    payload: { referenceId: reference.id, accountId: reference.account_id, externalDeliveryEnabled: false, requiresApproval: true },
  });
}

export async function prepareReplyFollowup(s: CoachScope, reference: ConnectionReference) {
  await recordConnectionEvent(s, reference, "email_reply_needed");
  if (!reference.client_id || !reference.case_id) return; // Ambiguous links require review first.
  const title = `Vérifier la réponse au courriel — ${reference.id}`;
  const task = await s.db.from("tasks").upsert({ user_id: s.userId, client_id: reference.client_id,
    case_id: reference.case_id, title, category: "followup", status: "pending", validation_required: true,
    priority_score: 60, due_on: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()),
  }, { onConflict: "case_id,title", ignoreDuplicates: true });
  if (task.error) throw new Error("Le courriel a été analysé, mais la tâche de suivi n’a pas pu être préparée.");
  const automation = await s.db.from("automations").upsert({ user_id: s.userId, client_id: reference.client_id,
    case_id: reference.case_id, name: title, status: "validation_required", external_delivery_enabled: false,
  }, { onConflict: "case_id,name", ignoreDuplicates: true });
  if (automation.error) throw new Error("La tâche existe, mais la proposition d’automatisation n’a pas pu être enregistrée.");
}
