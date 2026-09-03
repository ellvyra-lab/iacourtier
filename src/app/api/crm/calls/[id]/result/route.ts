import { NextResponse } from "next/server";

import { CALL_OUTCOMES, outcomeLabel, type CallOutcome } from "@/lib/crm-phone";
import { recalculateCaseOperatingState } from "@/lib/server/crm-operating-system";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const body = await request.json() as { outcome?: CallOutcome; note?: string; objection?: string; interestLevel?: string; nextContactAt?: string | null };
    if (!CALL_OUTCOMES.some((item) => item.value === body.outcome)) return NextResponse.json({ error: "Choisis le résultat de l’appel." }, { status: 400 });
    const { data: call, error: callError } = await supabase.from("call_activities").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (callError) return NextResponse.json({ error: callError.message }, { status: 500 });
    if (!call) return NextResponse.json({ error: "Appel introuvable." }, { status: 404 });
    const now = new Date();
    const nextAt = normalizeDate(body.nextContactAt) || automaticFollowUp(body.outcome!, now);
    const note = String(body.note || "").trim().slice(0, 5000);
    const objection = String(body.objection || "").trim().slice(0, 1000);
    const interest = ["hot","warm","cold","unknown"].includes(String(body.interestLevel)) ? body.interestLevel : null;
    const { error: updateError } = await supabase.from("call_activities").update({ status: "completed", outcome: body.outcome, note: note || null, objection: objection || null, interest_level: interest, next_contact_at: nextAt, completed_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", id).eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    const resultLabel = outcomeLabel(body.outcome);
    const { error: communicationError } = await supabase.from("communications").insert({ user_id: user.id, client_id: call.client_id, case_id: call.case_id, property_id: call.property_id, task_id: call.task_id, communication_type: "call", direction: "outgoing", subject: resultLabel, body: note, outcome: body.outcome, objection: objection || null, interest_level: interest, next_contact_at: nextAt, phone_used: call.phone_used, metadata: { call_id: id } });
    if (communicationError) return NextResponse.json({ error: communicationError.message }, { status: 500 });
    if (call.task_id) await supabase.from("tasks").update({ status: "completed", completed_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", call.task_id).eq("user_id", user.id);
    if (body.outcome === "invalid_number") await supabase.from("clients").update({ phone_status: "invalid", updated_at: now.toISOString() }).eq("id", call.client_id).eq("user_id", user.id);
    else if (body.outcome === "do_not_contact") await supabase.from("clients").update({ do_not_contact: true, do_not_call: true, do_not_sms: true, do_not_email: true, updated_at: now.toISOString() }).eq("id", call.client_id).eq("user_id", user.id);
    else await supabase.from("clients").update({ phone_status: "valid", last_contact_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", call.client_id).eq("user_id", user.id);
    if (nextAt && call.case_id && !["invalid_number","do_not_contact","not_interested"].includes(body.outcome!)) {
      const title = body.outcome === "appointment" ? "Préparer le rendez-vous obtenu" : `Rappeler le client — ${resultLabel}`;
      const actionType = body.outcome === "appointment" ? "appointment" : "call";
      await supabase.from("tasks").upsert({ user_id: user.id, client_id: call.client_id, case_id: call.case_id, property_id: call.property_id, category: "followup", title, description: note || `Suivi après : ${resultLabel}`, status: "pending", due_at: nextAt, validation_required: false, source: "call_result", action_type: actionType, priority_score: body.outcome === "appointment" ? 90 : 75, updated_at: now.toISOString() }, { onConflict: "case_id,title", ignoreDuplicates: false });
    }
    if (body.outcome === "appointment" && nextAt) await supabase.from("appointments").insert({ user_id: user.id, client_id: call.client_id, case_id: call.case_id, property_id: call.property_id, appointment_type: "client_appointment", title: "Rendez-vous obtenu par téléphone", starts_at: nextAt, status: "scheduled", notes: note || null });
    await Promise.all([
      supabase.from("activity_events").insert({ user_id: user.id, client_id: call.client_id, case_id: call.case_id, event_type: "call_completed", title: `Résultat d’appel — ${resultLabel}`, details: [note, objection ? `Objection : ${objection}` : "", nextAt ? `Prochain suivi : ${nextAt}` : ""].filter(Boolean).join(" · ") }),
      supabase.from("crm_events").insert({ user_id: user.id, event_type: "call_completed", client_id: call.client_id, case_id: call.case_id, property_id: call.property_id, payload: { call_id: id, outcome: body.outcome, interest_level: interest, next_contact_at: nextAt }, idempotency_key: `call-completed:${id}` }),
    ]);
    if (call.case_id) await recalculateCaseOperatingState(supabase, user.id, call.case_id);
    return NextResponse.json({ ok: true, outcome: body.outcome, nextContactAt: nextAt, followUpCreated: Boolean(nextAt), appointmentCreated: body.outcome === "appointment" && Boolean(nextAt) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Résultat impossible à enregistrer." }, { status: 500 }); }
}

function normalizeDate(value?: string | null) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function automaticFollowUp(outcome: CallOutcome, now: Date) { const days = outcome === "no_answer" ? 1 : outcome === "voicemail" ? 2 : outcome === "follow_up" ? 2 : 0; if (!days) return null; const next = new Date(now); next.setDate(next.getDate() + days); next.setHours(10, 0, 0, 0); return next.toISOString(); }

