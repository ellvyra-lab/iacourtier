import {
  canonicalCrmStage,
  computeCrmOperatingState,
  crmPipelineStages,
  stageDefinition,
  type CrmCaseSnapshot,
  type CrmPipelineType,
} from "@/lib/crm-operating-system";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function recalculateCaseOperatingState(supabase: Supabase, userId: string, caseId: string) {
  const [caseResult, relationsResult, documentsResult, tasksResult, conflictsResult, appointmentsResult, activityResult, buyerResult, sellerResult] = await Promise.all([
    supabase.from("client_cases").select("*").eq("id", caseId).eq("user_id", userId).single(),
    supabase.from("client_case_clients").select("client_id").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("documents").select("category,analysis_metadata").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("tasks").select("title,due_at,category,status").eq("case_id", caseId).eq("user_id", userId).eq("status", "pending"),
    supabase.from("data_conflicts").select("id").eq("case_id", caseId).eq("user_id", userId).eq("status", "pending"),
    supabase.from("appointments").select("appointment_type,title,starts_at,status").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("activity_events").select("created_at").eq("case_id", caseId).eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    supabase.from("buyer_cases").select("*").eq("client_case_id", caseId).eq("user_id", userId).maybeSingle(),
    supabase.from("seller_listings").select("*").eq("client_case_id", caseId).eq("user_id", userId).maybeSingle(),
  ]);
  const firstError = caseResult.error || relationsResult.error || documentsResult.error || tasksResult.error || conflictsResult.error || appointmentsResult.error || activityResult.error || buyerResult.error || sellerResult.error;
  if (firstError) throw firstError;

  const clientIds = [...new Set([
    caseResult.data.primary_client_id,
    ...(relationsResult.data || []).map((item) => item.client_id),
  ].filter(Boolean))] as string[];
  const clientsResult = clientIds.length
    ? await supabase.from("clients").select("first_name,last_name,email,phone").eq("user_id", userId).in("id", clientIds)
    : { data: [], error: null };
  if (clientsResult.error) throw clientsResult.error;

  const financingResult = buyerResult.data?.id
    ? await supabase.from("buyer_financing").select("status,maximum_purchase_price").eq("case_id", buyerResult.data.id).eq("user_id", userId).maybeSingle()
    : { data: null, error: null };
  if (financingResult.error) throw financingResult.error;

  const type = pipelineType(String(caseResult.data.pipeline_type || caseResult.data.case_type));
  const currentStage = canonicalCrmStage(type, String(caseResult.data.current_stage || caseResult.data.pipeline_stage));
  const sellerContent = (sellerResult.data?.generated_content || {}) as Record<string, unknown>;
  const marketing = sellerContent.marketing as Record<string, unknown> | undefined;
  const listing = sellerContent.listing as Record<string, unknown> | undefined;
  const snapshot: CrmCaseSnapshot = {
    caseType: type,
    currentStage,
    clients: (clientsResult.data || []).map((client) => ({ firstName: client.first_name, lastName: client.last_name, email: client.email, phone: client.phone })),
    hasProperty: Boolean(caseResult.data.property_id),
    documentCategories: (documentsResult.data || []).map((document) => String(document.category || "")),
    openTasks: (tasksResult.data || []).map((task) => ({ title: task.title, dueAt: task.due_at, category: task.category })),
    pendingConflicts: (conflictsResult.data || []).length,
    hasFinancing: Boolean(financingResult.data && financingResult.data.status !== "missing"),
    hasBuyerContract: stageReached(type, currentStage, "buyer_brokerage_contract"),
    hasBuyerCriteria: Boolean(buyerResult.data && (buyerResult.data.budget || buyerResult.data.property_type || buyerResult.data.sectors?.length)),
    hasEvaluation: stageReached(type, currentStage, "evaluation_completed"),
    hasMandate: stageReached(type, currentStage, "mandate_signed"),
    hasListingAssets: Boolean(listing && Object.values(listing).some(Boolean)),
    hasMarketingPlan: Boolean(marketing && Object.values(marketing).some(Boolean)),
    hasOffer: stageReached(type, currentStage, "offer_received") || stageReached(type, currentStage, "offer_submitted"),
    conditionsSatisfied: stageReached(type, currentStage, "conditions_satisfied"),
    hasNotaryAppointment: (appointmentsResult.data || []).some((item) => /notaire/i.test(`${item.appointment_type} ${item.title}`)),
    transactionClosed: stageReached(type, currentStage, type === "seller" ? "sold" : "purchase_completed") || caseResult.data.status === "completed",
    lastActivityAt: activityResult.data?.[0]?.created_at || caseResult.data.last_activity_at || caseResult.data.updated_at,
  };
  const state = computeCrmOperatingState(snapshot);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("client_cases").update({
    pipeline_type: state.pipelineType,
    current_stage: state.currentStage,
    pipeline_stage: state.currentStage,
    pipeline_progress: state.pipelineProgress,
    progress: state.pipelineProgress,
    completion_score: state.completionScore,
    health_score: state.healthScore,
    priority_score: state.priorityScore,
    next_action: state.nextAction,
    next_action_reason: state.nextActionReason,
    last_activity_at: snapshot.lastActivityAt || now,
    updated_at: now,
  }).eq("id", caseId).eq("user_id", userId);
  if (updateError) throw updateError;

  const requirementRows = state.requirements.map((requirement) => ({
    user_id: userId,
    case_id: caseId,
    requirement_key: requirement.key,
    label: requirement.label,
    required_for_stage: requirement.requiredForStage,
    status: requirement.status,
    resolved_at: requirement.status === "complete" ? now : null,
    updated_at: now,
  }));
  if (requirementRows.length) {
    const { error } = await supabase.from("case_requirements").upsert(requirementRows, { onConflict: "case_id,requirement_key" });
    if (error) throw error;
  }
  return state;
}

export async function transitionCentralCaseStage(supabase: Supabase, input: {
  userId: string;
  caseId: string;
  pipelineStage: string;
  status?: string;
  nextAction?: string;
}) {
  const { data: clientCase, error } = await supabase.from("client_cases").select("case_type,pipeline_type,current_stage,pipeline_stage,primary_client_id").eq("id", input.caseId).eq("user_id", input.userId).single();
  if (error) throw error;
  const type = pipelineType(String(clientCase.pipeline_type || clientCase.case_type));
  const canonicalStage = canonicalCrmStage(type, input.pipelineStage);
  if (!crmPipelineStages(type).some((item) => item.id === canonicalStage)) throw new Error("Cette étape n’appartient pas au pipeline du dossier.");
  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("client_cases").update({
    status: input.status || "active",
    current_stage: canonicalStage,
    pipeline_stage: canonicalStage,
    stage_entered_at: now,
    ...(typeof input.nextAction === "string" ? { next_action: input.nextAction } : {}),
    updated_at: now,
  }).eq("id", input.caseId).eq("user_id", input.userId);
  if (updateError) throw updateError;

  const definition = stageDefinition(type, canonicalStage);
  if (definition.taskTemplates.length) {
    const { error: taskError } = await supabase.from("tasks").upsert(definition.taskTemplates.map((title) => ({
      user_id: input.userId,
      client_id: clientCase.primary_client_id,
      case_id: input.caseId,
      category: "pipeline",
      title,
      status: "pending",
      validation_required: false,
      stage_key: canonicalStage,
      updated_at: now,
    })), { onConflict: "case_id,title", ignoreDuplicates: true });
    if (taskError) throw taskError;
  }
  return recalculateCaseOperatingState(supabase, input.userId, input.caseId);
}

export async function emitCrmEvent(supabase: Supabase, input: {
  userId: string;
  eventType: string;
  clientId?: string | null;
  caseId?: string | null;
  propertyId?: string | null;
  documentId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  const { error } = await supabase.from("crm_events").upsert({
    user_id: input.userId,
    event_type: input.eventType,
    client_id: input.clientId || null,
    case_id: input.caseId || null,
    property_id: input.propertyId || null,
    document_id: input.documentId || null,
    payload: input.payload || {},
    idempotency_key: input.idempotencyKey || null,
    status: "recorded",
  }, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
}

function pipelineType(value: string): CrmPipelineType {
  return (["buyer", "seller", "buy_sell", "prospect", "renewal", "post_transaction", "other"].includes(value) ? value : "other") as CrmPipelineType;
}

function stageReached(type: CrmPipelineType, currentStage: string, targetStage: string) {
  const stages = crmPipelineStages(type);
  const currentIndex = stages.findIndex((item) => item.id === canonicalCrmStage(type, currentStage));
  const targetIndex = stages.findIndex((item) => item.id === targetStage);
  return targetIndex >= 0 && currentIndex >= targetIndex;
}

