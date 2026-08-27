import {
  canonicalCrmStage,
  evaluateCaseState,
  crmPipelineStages,
  stageDefinition,
  type CrmCaseSnapshot,
  type CrmPipelineMode,
  type CrmPipelineType,
} from "@/lib/crm-operating-system";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function recalculateCaseOperatingState(supabase: Supabase, userId: string, caseId: string) {
  const [caseResult, relationsResult, documentsResult, tasksResult, conflictsResult, appointmentsResult, activityResult, communicationsResult, eventsResult, buyerResult, sellerResult, conditionsResult] = await Promise.all([
    supabase.from("client_cases").select("*").eq("id", caseId).eq("user_id", userId).single(),
    supabase.from("client_case_clients").select("client_id").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("documents").select("category,document_type,analysis_metadata,extracted_facts").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("tasks").select("title,due_at,category,status,completed_at").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("data_conflicts").select("id").eq("case_id", caseId).eq("user_id", userId).eq("status", "pending"),
    supabase.from("appointments").select("appointment_type,title,starts_at,status").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("activity_events").select("event_type,title,created_at").eq("case_id", caseId).eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("communications").select("communication_type,occurred_at").eq("case_id", caseId).eq("user_id", userId).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("crm_events").select("event_type,payload,occurred_at").eq("case_id", caseId).eq("user_id", userId).order("occurred_at", { ascending: false }).limit(100),
    supabase.from("buyer_cases").select("*").eq("client_case_id", caseId).eq("user_id", userId).maybeSingle(),
    supabase.from("seller_listings").select("*").eq("client_case_id", caseId).eq("user_id", userId).maybeSingle(),
    supabase.from("case_conditions").select("title,status,due_at").eq("case_id", caseId).eq("user_id", userId),
  ]);
  const firstError = caseResult.error || relationsResult.error || documentsResult.error || tasksResult.error || conflictsResult.error || appointmentsResult.error || activityResult.error || communicationsResult.error || eventsResult.error || buyerResult.error || sellerResult.error || conditionsResult.error;
  if (firstError) throw firstError;

  const clientIds = [...new Set([caseResult.data.primary_client_id, ...(relationsResult.data || []).map((item) => item.client_id)].filter(Boolean))] as string[];
  const clientsResult = clientIds.length
    ? await supabase.from("clients").select("first_name,last_name,email,phone,last_contact_at").eq("user_id", userId).in("id", clientIds)
    : { data: [], error: null };
  if (clientsResult.error) throw clientsResult.error;

  const financingResult = buyerResult.data?.id
    ? await supabase.from("buyer_financing").select("status,maximum_purchase_price,mortgage_amount").eq("case_id", buyerResult.data.id).eq("user_id", userId).maybeSingle()
    : { data: null, error: null };
  if (financingResult.error) throw financingResult.error;

  const [factsResult, mediaResult] = sellerResult.data?.id ? await Promise.all([
    supabase.from("seller_listing_facts").select("fact_key,label,value,status").eq("listing_id", sellerResult.data.id).eq("user_id", userId),
    supabase.from("seller_listing_media").select("id,category").eq("listing_id", sellerResult.data.id).eq("user_id", userId),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (factsResult.error || mediaResult.error) throw factsResult.error || mediaResult.error;

  const type = pipelineType(String(caseResult.data.pipeline_type || caseResult.data.case_type));
  const currentStage = canonicalCrmStage(type, String(caseResult.data.current_stage || caseResult.data.pipeline_stage));
  const sellerContent = (sellerResult.data?.generated_content || {}) as Record<string, unknown>;
  const marketing = objectValue(sellerContent.marketing);
  const listing = objectValue(sellerContent.listing);
  const documents = documentsResult.data || [];
  const searchableDocuments = documents.map((document) => normalize(`${document.category} ${document.document_type} ${JSON.stringify(document.analysis_metadata || {})} ${JSON.stringify(document.extracted_facts || [])}`));
  const hasDocument = (...patterns: RegExp[]) => searchableDocuments.some((value) => patterns.some((pattern) => pattern.test(value)));
  const factMap = new Map((factsResult.data || []).map((fact) => [normalize(`${fact.fact_key} ${fact.label}`), String(fact.value || "").trim()]));
  const hasFact = (...patterns: RegExp[]) => [...factMap.entries()].some(([key, value]) => Boolean(value) && patterns.some((pattern) => pattern.test(key)));
  const appointments = appointmentsResult.data || [];
  const conditions = conditionsResult.data || [];
  const eventTypes = [
    ...(eventsResult.data || []).map((item) => item.event_type),
    ...(activityResult.data || []).map((item) => item.event_type),
    ...(tasksResult.data || []).filter((item) => item.status === "completed").map((item) => `task_completed:${item.title}`),
  ];
  const hasEvent = (...patterns: RegExp[]) => eventTypes.some((value) => patterns.some((pattern) => pattern.test(normalize(value))));
  const hasOfferAccepted = hasEvent(/offeraccepted/, /offreacceptee/) || hasDocument(/offre.*acceptee/, /promessedachat.*acceptee/);
  const hasOffer = hasOfferAccepted || hasEvent(/offerreceived/, /offersubmitted/, /offrerecue/, /offredeposee/) || hasDocument(/promessedachat/, /offredachat/, /offre/);
  const conditionsSatisfied = conditions.length > 0 && conditions.every((item) => item.status === "satisfied" || item.status === "waived");
  const hasMandate = hasEvent(/mandatesigned/, /contratcourtageventesigne/) || hasDocument(/contratdecourtage.*vente/, /ccv/, /mandatsigne/);
  const photoCount = (mediaResult.data || []).filter((item) => /photo|image|cover/i.test(String(item.category || ""))).length;
  const hasDescription = Boolean(listing.publicDescription || listing.description || listing.shortDescription || hasFact(/description/));
  const hasPrice = Boolean(listing.price || listing.askingPrice || hasFact(/price/, /prix/));
  const sellerDocumentCount = searchableDocuments.filter((value) => /declarationvendeur|dv|certificatlocalisation|actevente|contratcourtage|ccv|mo/.test(value)).length;
  const latestActivity = latestDate([
    activityResult.data?.[0]?.created_at,
    communicationsResult.data?.[0]?.occurred_at,
    eventsResult.data?.[0]?.occurred_at,
    caseResult.data.last_activity_at,
    caseResult.data.updated_at,
  ]);
  const hasQualification = type === "seller"
    ? hasFact(/motivation/, /echeancier/, /delai/, /timeline/) || hasEvent(/qualification/, /taskcompleted.*qualifier/)
    : Boolean(buyerResult.data && (buyerResult.data.budget || buyerResult.data.timeline || buyerResult.data.important_needs || buyerResult.data.property_type)) || hasEvent(/qualification/, /taskcompleted.*qualifier/);
  const snapshot: CrmCaseSnapshot = {
    caseType: type,
    currentStage,
    pipelineMode: pipelineMode(caseResult.data.pipeline_mode),
    clients: (clientsResult.data || []).map((client) => ({ firstName: client.first_name, lastName: client.last_name, email: client.email, phone: client.phone })),
    hasProperty: Boolean(caseResult.data.property_id),
    documentCategories: documents.flatMap((document) => [String(document.category || ""), String(document.document_type || "")]),
    openTasks: (tasksResult.data || []).filter((task) => task.status === "pending").map((task) => ({ title: task.title, dueAt: task.due_at, category: task.category })),
    pendingConflicts: (conflictsResult.data || []).length,
    hasContactEstablished: (communicationsResult.data || []).length > 0 || (clientsResult.data || []).some((client) => Boolean(client.last_contact_at)) || hasEvent(/contactestablished/, /contactetabli/),
    hasQualification,
    hasFinancing: Boolean(financingResult.data && !["missing", "declined"].includes(String(financingResult.data.status || ""))) || hasDocument(/preapprobation/, /prequalification/),
    hasBuyerContract: hasEvent(/buyercontractsigned/, /contratcourtageachatsigne/) || hasDocument(/contratdecourtage.*achat/, /cca/),
    hasBuyerCriteria: Boolean(buyerResult.data && (buyerResult.data.budget || buyerResult.data.property_type) && (buyerResult.data.sectors?.length || buyerResult.data.important_needs)),
    hasEvaluationAppointment: appointments.some((item) => item.status !== "cancelled" && /evaluation/.test(normalize(`${item.appointment_type} ${item.title}`))),
    hasEvaluation: hasEvent(/evaluationcompleted/, /evaluationrealisee/) || hasDocument(/evaluation/, /analysecomparative/, /acm/) || hasFact(/evaluation/, /valeurmarchande/),
    hasMandate,
    hasEssentialDocuments: hasMandate && sellerDocumentCount >= 2,
    photoCount,
    hasDescription,
    hasPrice,
    hasSellerInstructions: hasFact(/instructionvendeur/, /consignevendeur/),
    hasListingAssets: Boolean(photoCount > 0 && hasDescription && hasPrice),
    hasMarketingPlan: Boolean(marketing && Object.values(marketing).some(Boolean)),
    isPublished: sellerResult.data?.status === "published" || hasEvent(/listingpublished/, /propertypublished/),
    hasVisits: appointments.some((item) => item.status !== "cancelled" && /visit/.test(normalize(`${item.appointment_type} ${item.title}`))) || hasEvent(/visitcompleted/, /visite/),
    hasOffer,
    hasOfferAccepted,
    conditions: conditions.map((item) => ({ title: item.title, status: item.status, dueAt: item.due_at })),
    conditionsSatisfied,
    hasNotaryAppointment: appointments.some((item) => item.status !== "cancelled" && /notaire/.test(normalize(`${item.appointment_type} ${item.title}`))) || hasDocument(/notaire/),
    transactionClosed: caseResult.data.status === "completed" || hasEvent(/transactionclosed/, /transactioncompletee/, /purchasecompleted/, /sold/),
    eventTypes,
    lastContactAt: (clientsResult.data || []).map((client) => client.last_contact_at).filter(Boolean).sort().at(-1) || communicationsResult.data?.[0]?.occurred_at || null,
    lastActivityAt: latestActivity,
  };
  const state = evaluateCaseState(snapshot);
  const now = new Date().toISOString();
  const stageChanged = state.currentStage !== currentStage;
  const { error: updateError } = await supabase.from("client_cases").update({
    pipeline_type: state.pipelineType,
    pipeline_mode: state.pipelineMode,
    current_stage: state.currentStage,
    pipeline_stage: state.currentStage,
    suggested_stage: state.suggestedStage,
    suggested_stage_reason: state.suggestedStageReason,
    suggestion_confidence: state.suggestionConfidence || null,
    pipeline_progress: state.pipelineProgress,
    progress: state.pipelineProgress,
    completion_score: state.completionScore,
    health_score: state.healthScore,
    priority_score: state.priorityScore,
    priority_level: state.priorityLevel,
    next_action: state.nextAction,
    next_best_action: state.nextBestAction,
    next_action_reason: state.nextActionReason,
    next_action_due_at: state.nextActionDueAt,
    alerts: state.alerts,
    missing_items: state.missingItems,
    recommended_tasks: state.recommendedTasks,
    recommended_automations: state.recommendedAutomations,
    evaluated_at: now,
    last_activity_at: snapshot.lastActivityAt || now,
    ...(stageChanged ? { last_stage_change_cause: state.suggestedStageReason || "Preuve métier confirmée", last_stage_change_actor_type: "automation", last_stage_change_confidence: state.suggestionConfidence || 1 } : {}),
    updated_at: now,
  }).eq("id", caseId).eq("user_id", userId);
  if (updateError) throw updateError;

  const requirementRows = state.requirements.map((requirement) => ({ user_id: userId, case_id: caseId, requirement_key: requirement.key, label: requirement.label, required_for_stage: requirement.requiredForStage, status: requirement.status, resolved_at: requirement.status === "complete" ? now : null, updated_at: now }));
  if (requirementRows.length) { const { error } = await supabase.from("case_requirements").upsert(requirementRows, { onConflict: "case_id,requirement_key" }); if (error) throw error; }
  if (stageChanged) await createStageWork(supabase, { userId, caseId, clientId: caseResult.data.primary_client_id, type, stage: state.currentStage, now });
  return state;
}

export async function recalculateUserCases(supabase: Supabase, userId: string) {
  const { data, error } = await supabase.from("client_cases").select("id").eq("user_id", userId).eq("status", "active").order("updated_at", { ascending: false }).limit(250);
  if (error) throw error;
  const results = [];
  for (const item of data || []) {
    try { results.push({ id: item.id, state: await recalculateCaseOperatingState(supabase, userId, item.id) }); }
    catch (caught) { results.push({ id: item.id, error: caught instanceof Error ? caught.message : "Évaluation impossible" }); }
  }
  return results;
}

export async function transitionCentralCaseStage(supabase: Supabase, input: { userId: string; caseId: string; pipelineStage: string; status?: string; nextAction?: string; reason?: string; actorType?: "user" | "automation" | "system"; confidence?: number }) {
  const { data: clientCase, error } = await supabase.from("client_cases").select("case_type,pipeline_type,current_stage,pipeline_stage,primary_client_id").eq("id", input.caseId).eq("user_id", input.userId).single();
  if (error) throw error;
  const type = pipelineType(String(clientCase.pipeline_type || clientCase.case_type)); const stages = crmPipelineStages(type); const canonicalStage = canonicalCrmStage(type, input.pipelineStage);
  if (!stages.some((item) => item.id === canonicalStage)) throw new Error("Cette étape n’appartient pas au pipeline du dossier.");
  const previousStage = canonicalCrmStage(type, clientCase.current_stage || clientCase.pipeline_stage);
  const previousIndex = stages.findIndex((item) => item.id === previousStage); const nextIndex = stages.findIndex((item) => item.id === canonicalStage);
  if (nextIndex < previousIndex && !String(input.reason || "").trim()) throw new Error("Une raison est obligatoire pour reculer une étape du pipeline.");
  const now = new Date().toISOString(); const cause = String(input.reason || (nextIndex > previousIndex ? "Étape confirmée par le courtier" : "Étape mise à jour")).trim();
  const { error: updateError } = await supabase.from("client_cases").update({ status: input.status || "active", current_stage: canonicalStage, pipeline_stage: canonicalStage, stage_entered_at: now, suggested_stage: null, suggested_stage_reason: null, suggestion_confidence: null, last_stage_change_cause: cause, last_stage_change_actor_type: input.actorType || "user", last_stage_change_confidence: input.confidence || (input.actorType === "automation" ? 0.95 : 1), ...(typeof input.nextAction === "string" ? { next_action: input.nextAction } : {}), updated_at: now }).eq("id", input.caseId).eq("user_id", input.userId);
  if (updateError) throw updateError;
  await createStageWork(supabase, { userId: input.userId, caseId: input.caseId, clientId: clientCase.primary_client_id, type, stage: canonicalStage, now });
  return recalculateCaseOperatingState(supabase, input.userId, input.caseId);
}

export async function updateCentralCasePipelineMode(supabase: Supabase, input: { userId: string; caseId: string; mode: CrmPipelineMode }) {
  const { error } = await supabase.from("client_cases").update({ pipeline_mode: input.mode, updated_at: new Date().toISOString() }).eq("id", input.caseId).eq("user_id", input.userId);
  if (error) throw error;
  return recalculateCaseOperatingState(supabase, input.userId, input.caseId);
}

export async function emitCrmEvent(supabase: Supabase, input: { userId: string; eventType: string; clientId?: string | null; caseId?: string | null; propertyId?: string | null; documentId?: string | null; payload?: Record<string, unknown>; idempotencyKey?: string | null; cause?: string | null; actorType?: "user" | "automation" | "system"; confidence?: number | null }) {
  const { error } = await supabase.from("crm_events").upsert({ user_id: input.userId, event_type: input.eventType, client_id: input.clientId || null, case_id: input.caseId || null, property_id: input.propertyId || null, document_id: input.documentId || null, payload: input.payload || {}, idempotency_key: input.idempotencyKey || null, cause: input.cause || null, actor_type: input.actorType || "system", actor_user_id: input.actorType === "user" ? input.userId : null, confidence: input.confidence || null, status: "recorded" }, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
}

async function createStageWork(supabase: Supabase, input: { userId: string; caseId: string; clientId?: string | null; type: CrmPipelineType; stage: string; now: string }) {
  const definition = stageDefinition(input.type, input.stage);
  if (definition.taskTemplates.length) {
    const { error } = await supabase.from("tasks").upsert(definition.taskTemplates.map((title) => ({ user_id: input.userId, client_id: input.clientId || null, case_id: input.caseId, category: "pipeline", title, status: "pending", validation_required: false, stage_key: input.stage, priority_score: 60, updated_at: input.now })), { onConflict: "case_id,title", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (definition.automationTemplates.length) {
    const { error } = await supabase.from("automations").upsert(definition.automationTemplates.map((name) => ({ user_id: input.userId, client_id: input.clientId || null, case_id: input.caseId, name, status: "validation_required", external_delivery_enabled: false, updated_at: input.now })), { onConflict: "case_id,name", ignoreDuplicates: true });
    if (error) throw error;
  }
}

function pipelineType(value: string): CrmPipelineType { return (["buyer", "seller", "buy_sell", "prospect", "renewal", "post_transaction", "other"].includes(value) ? value : "other") as CrmPipelineType; }
function pipelineMode(value: unknown): CrmPipelineMode { return (["automatic", "assisted", "manual"].includes(String(value)) ? String(value) : "assisted") as CrmPipelineMode; }
function normalize(value?: string | null) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase(); }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function latestDate(values: Array<string | null | undefined>) { return values.filter(Boolean).sort().at(-1) || null; }

