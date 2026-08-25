import { NextResponse } from "next/server";

import { recalculateCaseOperatingState, transitionCentralCaseStage } from "@/lib/server/crm-operating-system";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PatchBody = {
  target?: "case" | "task" | "automation";
  id?: string;
  status?: string;
  pipelineStage?: string;
  nextAction?: string;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();
    await recalculateCaseOperatingState(supabase, user.id, id);

    const { data: clientCase, error: caseError } = await supabase.from("client_cases").select("*,property:properties(id,address,city,postal_code,property_type,lot_number)").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });
    if (!clientCase) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });

    const [relationsResult, documentsResult, tasksResult, automationsResult, communicationsResult, appointmentsResult, activityResult, buyerResult, sellerResult] = await Promise.all([
      supabase.from("client_case_clients").select("client_id,role").eq("case_id", id).eq("user_id", user.id),
      supabase.from("documents").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("case_id", id).eq("user_id", user.id).order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("automations").select("*").eq("case_id", id).eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("communications").select("*").eq("case_id", id).eq("user_id", user.id).order("occurred_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("case_id", id).eq("user_id", user.id).order("starts_at", { ascending: true }),
      supabase.from("activity_events").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("buyer_cases").select("*").eq("client_case_id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("seller_listings").select("*").eq("client_case_id", id).eq("user_id", user.id).maybeSingle(),
    ]);

    const firstError = relationsResult.error || documentsResult.error || tasksResult.error || automationsResult.error || communicationsResult.error || appointmentsResult.error || activityResult.error || buyerResult.error || sellerResult.error;
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

    const clientIds = Array.from(new Set([
      ...(relationsResult.data || []).map((item) => item.client_id),
      ...(clientCase.primary_client_id ? [clientCase.primary_client_id] : []),
    ]));
    const { data: clients, error: clientsError } = clientIds.length
      ? await supabase.from("clients").select("*").eq("user_id", user.id).in("id", clientIds)
      : { data: [], error: null };
    if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 });

    const [addressesResult, factsResult, conflictsResult, requirementsResult, crmEventsResult, dependenciesResult] = await Promise.all([
      clientIds.length
        ? supabase.from("client_addresses").select("*").eq("user_id", user.id).in("client_id", clientIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from("crm_facts").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(250),
      supabase.from("data_conflicts").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("case_requirements").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("crm_events").select("*").eq("case_id", id).eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(100),
      supabase.from("case_dependencies").select("*").eq("user_id", user.id).or(`predecessor_case_id.eq.${id},successor_case_id.eq.${id}`),
    ]);
    const mergeError = addressesResult.error || factsResult.error || conflictsResult.error || requirementsResult.error || crmEventsResult.error || dependenciesResult.error;
    if (mergeError) return NextResponse.json({ error: mergeError.message }, { status: 500 });

    let financing = null;
    let partners: unknown[] = [];
    if (buyerResult.data?.id) {
      const [financingResult, partnersResult] = await Promise.all([
        supabase.from("buyer_financing").select("*").eq("case_id", buyerResult.data.id).eq("user_id", user.id).maybeSingle(),
        supabase.from("buyer_case_partners").select("role,partner:partners(*)").eq("case_id", buyerResult.data.id).eq("user_id", user.id),
      ]);
      if (financingResult.error || partnersResult.error) return NextResponse.json({ error: financingResult.error?.message || partnersResult.error?.message }, { status: 500 });
      financing = financingResult.data;
      partners = partnersResult.data || [];
    }

    return NextResponse.json({
      case: clientCase,
      clients: clients || [],
      caseRoles: relationsResult.data || [],
      documents: documentsResult.data || [],
      tasks: tasksResult.data || [],
      automations: automationsResult.data || [],
      communications: communicationsResult.data || [],
      appointments: appointmentsResult.data || [],
      activity: activityResult.data || [],
      buyer: buyerResult.data,
      seller: sellerResult.data,
      financing,
      partners,
      addresses: addressesResult.data || [],
      facts: factsResult.data || [],
      conflicts: conflictsResult.data || [],
      requirements: requirementsResult.data || [],
      crmEvents: crmEventsResult.data || [],
      dependencies: dependenciesResult.data || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger le dossier." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await context.params;
    const body = await request.json() as PatchBody;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data: ownerCase } = await supabase.from("client_cases").select("id,pipeline_stage,current_stage").eq("id", caseId).eq("user_id", user.id).maybeSingle();
    if (!ownerCase) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });

    if (body.target === "case") {
      if (body.pipelineStage) {
        await transitionCentralCaseStage(supabase, { userId: user.id, caseId, pipelineStage: body.pipelineStage, status: body.status, nextAction: body.nextAction });
      } else {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.status) updates.status = body.status;
        if (typeof body.nextAction === "string") updates.next_action = body.nextAction;
        const { error } = await supabase.from("client_cases").update(updates).eq("id", caseId).eq("user_id", user.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        await recalculateCaseOperatingState(supabase, user.id, caseId);
      }
    } else if (body.target === "task" && body.id && body.status) {
      const now = new Date().toISOString();
      const { data: task, error } = await supabase.from("tasks").update({ status: body.status, completed_at: body.status === "completed" ? now : null, updated_at: now }).eq("id", body.id).eq("case_id", caseId).eq("user_id", user.id).select("legacy_source,legacy_id").maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (task?.legacy_source && task.legacy_id) {
        const table = task.legacy_source === "buyer_case_tasks" ? "buyer_case_tasks" : task.legacy_source === "seller_listing_tasks" ? "seller_listing_tasks" : null;
        if (table) await supabase.from(table).update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", task.legacy_id).eq("user_id", user.id);
      }
      await recalculateCaseOperatingState(supabase, user.id, caseId);
    } else if (body.target === "automation" && body.id && body.status) {
      const { data: automation, error } = await supabase.from("automations").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.id).eq("case_id", caseId).eq("user_id", user.id).select("legacy_source,legacy_id").maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (automation?.legacy_source && automation.legacy_id) {
        const table = automation.legacy_source === "buyer_case_automations" ? "buyer_case_automations" : automation.legacy_source === "seller_listing_automations" ? "seller_listing_automations" : null;
        if (table) await supabase.from(table).update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", automation.legacy_id).eq("user_id", user.id);
      }
      await recalculateCaseOperatingState(supabase, user.id, caseId);
    } else {
      return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: 500 });
  }
}

function expiredSession() {
  return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
}

