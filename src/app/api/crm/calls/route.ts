import { NextResponse } from "next/server";

import { normalizePhone, telHref } from "@/lib/crm-phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expired();
    const { data: tasks, error } = await supabase.from("tasks").select("*").eq("user_id", user.id).eq("status", "pending").eq("action_type", "call").order("priority_score", { ascending: false }).order("due_at", { ascending: true, nullsFirst: false }).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const clientIds = [...new Set((tasks || []).map((task) => task.client_id).filter(Boolean))];
    const caseIds = [...new Set((tasks || []).map((task) => task.case_id).filter(Boolean))];
    const [{ data: clients, error: clientError }, { data: cases, error: caseError }, { data: communications, error: communicationError }] = await Promise.all([
      clientIds.length ? supabase.from("clients").select("id,first_name,last_name,phone,email,phone_status,do_not_contact,do_not_call,last_contact_at").eq("user_id", user.id).in("id", clientIds) : Promise.resolve({ data: [], error: null }),
      caseIds.length ? supabase.from("client_cases").select("id,title,case_type,current_stage,next_action,next_action_reason,priority_level,property_id,property:properties(address,city,property_type)").eq("user_id", user.id).in("id", caseIds) : Promise.resolve({ data: [], error: null }),
      clientIds.length ? supabase.from("communications").select("client_id,subject,body,outcome,occurred_at").eq("user_id", user.id).in("client_id", clientIds).order("occurred_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    ]);
    const firstError = clientError || caseError || communicationError;
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });
    const clientMap = Object.fromEntries((clients || []).map((item) => [item.id, item]));
    const caseMap = Object.fromEntries((cases || []).map((item) => [item.id, item]));
    const lastByClient = new Map<string, any>();
    for (const item of communications || []) if (item.client_id && !lastByClient.has(item.client_id)) lastByClient.set(item.client_id, item);
    return NextResponse.json({ calls: (tasks || []).map((task) => ({ ...task, client: clientMap[task.client_id], case: caseMap[task.case_id], lastCommunication: lastByClient.get(task.client_id) || null })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les appels." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expired();
    const body = await request.json() as { clientId?: string; caseId?: string | null; propertyId?: string | null; taskId?: string | null };
    if (!body.clientId) return NextResponse.json({ error: "Client manquant." }, { status: 400 });
    const { data: client, error: clientError } = await supabase.from("clients").select("id,first_name,last_name,phone,do_not_contact,do_not_call,phone_status").eq("id", body.clientId).eq("user_id", user.id).maybeSingle();
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    if (client.do_not_contact || client.do_not_call) return NextResponse.json({ error: "Ce client a demandé de ne plus être appelé." }, { status: 409 });
    if (client.phone_status === "invalid") return NextResponse.json({ error: "Ce numéro est marqué invalide. Corrige la fiche avant d’appeler." }, { status: 409 });
    const phone = normalizePhone(client.phone);
    if (!phone) return NextResponse.json({ error: "Ajoute un numéro de téléphone valide à la fiche client." }, { status: 400 });
    if (body.caseId && !(await ownsCase(supabase, user.id, client.id, body.caseId))) return NextResponse.json({ error: "Ce dossier n’est pas relié à ce client." }, { status: 403 });
    if (body.propertyId) {
      const { data: property } = await supabase.from("properties").select("id").eq("id", body.propertyId).eq("user_id", user.id).maybeSingle();
      if (!property) return NextResponse.json({ error: "Cette propriété n’appartient pas à ce compte." }, { status: 403 });
    }
    if (body.taskId) {
      const { data: task } = await supabase.from("tasks").select("id").eq("id", body.taskId).eq("user_id", user.id).eq("client_id", client.id).maybeSingle();
      if (!task) return NextResponse.json({ error: "Cette tâche d’appel n’est pas reliée au client." }, { status: 403 });
    }
    const { data: call, error } = await supabase.from("call_activities").insert({ user_id: user.id, client_id: client.id, case_id: body.caseId || null, property_id: body.propertyId || null, task_id: body.taskId || null, phone_used: phone, status: "started" }).select("id,started_at").single();
    if (error || !call) return NextResponse.json({ error: error?.message || "L’appel n’a pas pu être journalisé." }, { status: 500 });
    const name = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Client";
    await Promise.all([
      supabase.from("activity_events").insert({ user_id: user.id, client_id: client.id, case_id: body.caseId || null, event_type: "call_started", title: `Appel lancé — ${name}`, details: phone }),
      supabase.from("crm_events").insert({ user_id: user.id, event_type: "call_started", client_id: client.id, case_id: body.caseId || null, property_id: body.propertyId || null, payload: { call_id: call.id, phone }, idempotency_key: `call-started:${call.id}` }),
    ]);
    return NextResponse.json({ ok: true, callId: call.id, href: telHref(phone), startedAt: call.started_at });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de démarrer l’appel." }, { status: 500 }); }
}

async function ownsCase(supabase: any, userId: string, clientId: string, caseId: string) { const { data: owner } = await supabase.from("client_cases").select("id,primary_client_id").eq("id", caseId).eq("user_id", userId).maybeSingle(); if (!owner) return false; if (owner.primary_client_id === clientId) return true; const { data: relation } = await supabase.from("client_case_clients").select("id").eq("user_id", userId).eq("case_id", caseId).eq("client_id", clientId).limit(1).maybeSingle(); return Boolean(relation); }
function expired() { return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 }); }

